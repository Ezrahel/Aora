// ============================================================
// Webhook Dispatcher Worker (BullMQ)
//
// Background worker that processes webhook_outbox rows:
//   1. Claims a pending outbox row
//   2. Looks up the merchant's webhook endpoint + secret
//   3. Signs the payload with HMAC-SHA256
//   4. POSTs to the merchant's endpoint (10s timeout)
//   5. On success: marks outbox as delivered
//   6. On failure: logs delivery attempt, schedules retry
//
// Exponential backoff is handled by BullMQ's built-in mechanism:
//   delay = 60s * 2^(attempt - 1), capped at ~24h total
// ============================================================

import { Worker, type Job } from "bullmq";
import { query } from "../db/pool.ts";
import { cacheClient } from "../cache/redis.ts";
import { WebhookSigner } from "./webhook-signer.ts";
import {
  webhookOutboxRepository,
} from "./webhook-outbox-repository.ts";
import type IORedis from "ioredis";

// ── Constants ──────────────────────────────────────────────

const WORKER_CONCURRENCY = 5;
const HTTP_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BODY_LENGTH = 5000;

// ── Job Data Type ─────────────────────────────────────────

interface WebhookDeliveryJob {
  outboxId: string;
}

// ── Worker Singleton ───────────────────────────────────────

let worker: Worker<WebhookDeliveryJob> | null = null;

/**
 * Start the webhook dispatcher worker.
 *
 * Call this once during application startup. The worker will
 * poll Redis for pending webhook jobs and process them with
 * up to WORKER_CONCURRENCY concurrent handlers.
 *
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function startWebhookWorker(): Worker<WebhookDeliveryJob> | null {
  if (worker) return worker;

  const redis = (cacheClient as any).redis as IORedis | undefined;
  if (!redis || !redis.options?.host) {
    console.warn(
      "[WebhookWorker] Redis not available — webhook worker cannot start. " +
      "Webhooks will remain in the outbox table.",
    );
    return null;
  }

  worker = new Worker<WebhookDeliveryJob>(
    "aora:webhooks",
    async (job: Job<WebhookDeliveryJob>) => {
      await processWebhookDelivery(job.data.outboxId);
    },
    {
      connection: redis,
      concurrency: WORKER_CONCURRENCY,
      lockDuration: 30_000,         // 30s job lock
      stalledInterval: 15_000,      // check for stalled jobs every 15s
      maxStalledCount: 3,           // retry stalled jobs 3 times
    },
  );

  worker.on("completed", (job: Job<WebhookDeliveryJob>) => {
    console.debug(`[WebhookWorker] Delivered: outbox=${job.data.outboxId}`);
  });

  worker.on("failed", (job: Job<WebhookDeliveryJob> | undefined, err: Error) => {
    if (job) {
      console.warn(
        `[WebhookWorker] Failed: outbox=${job.data.outboxId} attempt=${job.attemptsMade} error=${err.message}`,
      );
    }
  });

  worker.on("error", (err: Error) => {
    console.error("[WebhookWorker] Fatal error:", err.message);
  });

  console.log(
    `[WebhookWorker] Started with concurrency=${WORKER_CONCURRENCY}`,
  );

  return worker;
}

/**
 * Gracefully shut down the webhook worker.
 */
export async function stopWebhookWorker(): Promise<void> {
  if (!worker) return;
  await worker.close();
  worker = null;
  console.log("[WebhookWorker] Shut down.");
}

// ── Core Delivery Logic ────────────────────────────────────

async function processWebhookDelivery(outboxId: string): Promise<void> {
  // 1. Load the outbox row and its associated webhook endpoint
  const outbox = await webhookOutboxRepository.claimPending(1);
  const row = outbox.find((o) => o.id === outboxId);
  if (!row) {
    // The row may have been claimed by another worker instance.
    // BullMQ will retry — if it's already delivered this is a no-op.
    return;
  }

  // 2. Look up the webhook endpoint configuration
  const { rows: webhookRows } = await query(
    `SELECT url, secret, is_active FROM webhook_endpoints WHERE id = $1`,
    [row.webhookId],
  );

  if (webhookRows.length === 0) {
    await webhookOutboxRepository.markFailed(outboxId, "Webhook endpoint not found");
    return;
  }

  const endpoint = webhookRows[0];

  if (!endpoint.is_active) {
    await markCancelled(outboxId, "Webhook endpoint is inactive");
    return;
  }

  // 3. Sign the payload
  const signature = WebhookSigner.sign(endpoint.secret, {
    type: row.eventType,
    id: row.id,
    created: row.createdAt,
    data: row.payload,
  });

  // 4. Build the delivery payload
  const body = JSON.stringify({
    type: row.eventType,
    id: row.id,
    created: row.createdAt,
    data: row.payload,
  });

  // 5. POST to the merchant's endpoint
  const startTime = Date.now();
  let httpStatus: number | null = null;
  let responseBody: string = "";
  let responseHeaders: Record<string, string> | null = null;
  let deliveryError: string | null = null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AoraHQ-Signature": signature.header,
        "X-AoraHQ-Event-Type": row.eventType,
        "X-AoraHQ-Delivery-ID": outboxId,
        "User-Agent": "AoraHQ-Webhook/1.0",
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    httpStatus = response.status;
    responseBody = (await response.text()).slice(0, MAX_RESPONSE_BODY_LENGTH);

    // Collect a subset of response headers for debugging
    const headers: Record<string, string> = {};
    for (const [key, val] of response.headers.entries()) {
      if (["content-type", "x-request-id", "x-amzn-requestid"].includes(key)) {
        headers[key] = val;
      }
    }
    responseHeaders = Object.keys(headers).length > 0 ? headers : null;

    // 6. Handle response
    if (httpStatus >= 200 && httpStatus < 300) {
      // Success — mark delivered
      await webhookOutboxRepository.markDelivered(outboxId);
      await webhookOutboxRepository.logDelivery({
        outboxId,
        webhookId: row.webhookId,
        attemptNumber: getAttemptNumber(row),
        status: "success",
        httpStatus,
        responseBody,
        responseHeaders: responseHeaders ?? undefined,
        durationMs: Date.now() - startTime,
      });
      return;
    }

    // Non-2xx response
    deliveryError = `Merchant returned HTTP ${httpStatus}`;
  } catch (err) {
    const error = err as Error;
    if (error.name === "AbortError") {
      deliveryError = `Request timed out after ${HTTP_TIMEOUT_MS}ms`;
    } else {
      deliveryError = error.message || "Unknown network error";
    }
    responseBody = deliveryError;
  }

  // 7. Delivery failed — log and schedule retry
  const durationMs = Date.now() - startTime;
  const attemptNumber = row.retryCount + 1;

  await webhookOutboxRepository.logDelivery({
    outboxId,
    webhookId: row.webhookId,
    attemptNumber,
    status: "failed",
    httpStatus,
    responseBody,
    responseHeaders: responseHeaders ?? undefined,
    durationMs,
    errorMessage: deliveryError ?? undefined,
  });

  // Check if we've exceeded max retries
  if (attemptNumber >= row.maxRetries) {
    await webhookOutboxRepository.markFailed(outboxId, deliveryError ?? "Max retries exceeded");
    console.error(
      `[WebhookWorker] Permanently failed after ${attemptNumber} attempts: outbox=${outboxId} error=${deliveryError}`,
    );
    return;
  }

  // Schedule retry with exponential backoff
  await webhookOutboxRepository.scheduleRetry(outboxId, deliveryError ?? "Unknown error", row.retryCount);

  // Throw to let BullMQ trigger its own backoff mechanism
  throw new Error(deliveryError ?? "Webhook delivery failed");
}

// ── Helpers ────────────────────────────────────────────────

function getAttemptNumber(row: { retryCount: number }): number {
  return row.retryCount + 1;
}

async function markCancelled(id: string, reason: string): Promise<void> {
  await query(
    `UPDATE webhook_outbox SET status = 'cancelled', last_error = $2, updated_at = now() WHERE id = $1`,
    [id, reason],
  );
}
