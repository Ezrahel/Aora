// ============================================================
// BullMQ Webhook Queue
//
// Defines the BullMQ queue used to enqueue webhook delivery
// jobs after they are written to the transactional outbox.
// The queue is backed by Redis (the same Redis connection
// used by the cache layer) and provides:
//   - At-least-once delivery guarantees
//   - Exponential backoff (2^attempt minutes, 24h max)
//   - Concurrent processing across multiple worker instances
// ============================================================

import { Queue, type QueueOptions } from "bullmq";
import { cacheClient } from "../cache/redis.ts";
import type IORedis from "ioredis";

// ── Queue Name ─────────────────────────────────────────────

const WEBHOOK_QUEUE_NAME = "aora:webhooks";

// ── Queue Singleton ────────────────────────────────────────

let webhookQueue: Queue | null = null;

/**
 * Get or create the BullMQ webhook queue.
 *
 * Uses the same Redis connection as the cache layer. If Redis
 * is unavailable (in-memory fallback mode), the queue will not
 * function — webhooks will remain in the outbox table and be
 * delivered when Redis is restored.
 */
export function getWebhookQueue(): Queue | null {
  if (webhookQueue) return webhookQueue;

  // Check if we have a real Redis connection
  const redis = (cacheClient as any).redis as IORedis | undefined;
  if (!redis || !redis.options?.host) {
    console.warn(
      "[WebhookQueue] Redis not available — webhooks will not be queued. " +
      "They will remain in the outbox table for later delivery.",
    );
    return null;
  }

  const opts: QueueOptions = {
    connection: redis,
    defaultJobOptions: {
      // At least once delivery: remove on success, keep on failure
      removeOnComplete: { age: 3600 * 24 },   // keep successes 24h
      removeOnFail: { age: 3600 * 24 * 7 },   // keep failures 7d
      attempts: 48,  // max 48 retries (~24h with exponential backoff)
      backoff: {
        type: "exponential",
        delay: 60_000,  // first retry after 1 minute
      },
    },
  };

  webhookQueue = new Queue(WEBHOOK_QUEUE_NAME, opts);

  return webhookQueue;
}

/**
 * Enqueue a webhook delivery job.
 *
 * @param outboxId - The ID of the outbox row to deliver
 */
export async function enqueueWebhookDelivery(outboxId: string): Promise<void> {
  const queue = getWebhookQueue();
  if (!queue) return; // No Redis — outbox rows stay pending for later

  await queue.add(
    "webhook:deliver",
    { outboxId },
    {
      jobId: outboxId,  // deduplicate by outbox ID
      // BullMQ exponential backoff: delays are computed as:
      //   delay = backoff.delay * 2^(attempt - 1)
      // So: 1m, 2m, 4m, 8m, 16m, 32m, 64m, 128m, 256m, 512m, 1024m (~17h)
      // The 11th retry exceeds 24h, so max 10 actual retries (11 attempts total)
      attempts: 48,
      backoff: { type: "exponential", delay: 60_000 },
    },
  );
}
