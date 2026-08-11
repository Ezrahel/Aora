// ============================================================
// Webhook Transactional Outbox Repository
//
// Writes webhook events to the outbox table INSIDE the same
// database transaction as the state change that triggered the
// event. This guarantees that if the subscription/customer
// update succeeds, the webhook event is durably persisted.
//
// A background worker (WebhookDispatcherWorker) picks up
// pending outbox rows, signs them with HMAC-SHA256, and
// delivers them to the merchant's webhook endpoint.
// ============================================================

import { query, withTransaction, type Client } from "../db/pool.ts";

// ── Types ──────────────────────────────────────────────────

export type OutboxStatus = "pending" | "processing" | "delivered" | "failed" | "cancelled";

export interface WebhookOutboxRow {
  id: string;
  tenantId: string;
  workspaceId: string;
  webhookId: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  retryCount: number;
  maxRetries: number;
  nextAttemptAt: string;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OutboxInput {
  tenantId: string;
  workspaceId: string;
  webhookId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export interface DeliveryLogInput {
  outboxId: string;
  webhookId: string;
  attemptNumber: number;
  status: "success" | "failed";
  httpStatus: number | null;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
  durationMs: number;
  errorMessage?: string;
}

export interface DeliveryLogRow {
  id: string;
  outboxId: string;
  webhookId: string;
  attemptNumber: number;
  status: "success" | "failed";
  httpStatus: number | null;
  responseBody: string | null;
  responseHeaders: Record<string, string> | null;
  durationMs: number;
  errorMessage: string | null;
  createdAt: string;
}

// ── Repository ─────────────────────────────────────────────

export class WebhookOutboxRepository {
  /**
   * Insert a webhook event into the outbox.
   *
   * This method is designed to be called inside an existing
   * transaction (the same transaction that modifies the
   * subscription/customer state). Pass the `client` from
   * withTransaction to ensure atomicity.
   */
  async insert(
    client: Client,
    input: OutboxInput,
  ): Promise<WebhookOutboxRow> {
    const { rows } = await client.query(
      `INSERT INTO webhook_outbox
        (tenant_id, workspace_id, webhook_id, event_type, payload, next_attempt_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, now(), now(), now())
       RETURNING *`,
      [
        input.tenantId,
        input.workspaceId,
        input.webhookId,
        input.eventType,
        JSON.stringify(input.payload),
      ],
    );

    return mapOutboxRow(rows[0]);
  }

  /**
   * Insert a webhook event with an auto-managed transaction.
   * Use this when you don't already have a transaction open.
   */
  async insertWithTransaction(input: OutboxInput): Promise<WebhookOutboxRow> {
    return withTransaction(async (client) => {
      return this.insert(client, input);
    });
  }

  /**
   * Claim the next batch of pending outbox rows for processing.
   * Uses SELECT ... FOR UPDATE SKIP LOCKED to safely claim
   * rows across concurrent worker instances.
   */
  async claimPending(batchSize: number = 10): Promise<WebhookOutboxRow[]> {
    const { rows } = await query(
      `UPDATE webhook_outbox
       SET status = 'processing', updated_at = now()
       WHERE id IN (
         SELECT id FROM webhook_outbox
         WHERE status = 'pending'
           AND next_attempt_at <= now()
         ORDER BY next_attempt_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING *`,
      [batchSize],
    );

    return rows.map(mapOutboxRow);
  }

  /**
   * Mark an outbox row as delivered.
   */
  async markDelivered(id: string): Promise<void> {
    await query(
      `UPDATE webhook_outbox
       SET status = 'delivered', updated_at = now()
       WHERE id = $1`,
      [id],
    );
  }

  /**
   * Mark an outbox row as failed (permanently).
   */
  async markFailed(id: string, error: string): Promise<void> {
    await query(
      `UPDATE webhook_outbox
       SET status = 'failed', last_error = $2, updated_at = now()
       WHERE id = $1`,
      [id, error],
    );
  }

  /**
   * Schedule a retry for a failed delivery.
   * Increments retry_count and sets next_attempt_at using
   * exponential backoff: 2^retry_count minutes, capped at 24h.
   */
  async scheduleRetry(
    id: string,
    error: string,
    currentRetryCount: number,
  ): Promise<void> {
    // Exponential backoff: 2^retry minutes, max 24 hours (1440 min)
    const delayMinutes = Math.min(Math.pow(2, currentRetryCount + 1), 1440);
    const delayMs = delayMinutes * 60 * 1000;

    await query(
      `UPDATE webhook_outbox
       SET status = 'pending',
           retry_count = retry_count + 1,
           last_error = $2,
           next_attempt_at = now() + ($3 || ' milliseconds')::INTERVAL,
           updated_at = now()
       WHERE id = $1`,
      [id, error, String(delayMs)],
    );
  }

  /**
   * Log a delivery attempt.
   */
  async logDelivery(input: DeliveryLogInput): Promise<DeliveryLogRow> {
    const { rows } = await query(
      `INSERT INTO webhook_delivery_logs
        (outbox_id, webhook_id, attempt_number, status, http_status,
         response_body, response_headers, duration_ms, error_message, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
       RETURNING *`,
      [
        input.outboxId,
        input.webhookId,
        input.attemptNumber,
        input.status,
        input.httpStatus,
        input.responseBody ?? null,
        input.responseHeaders ? JSON.stringify(input.responseHeaders) : null,
        input.durationMs,
        input.errorMessage ?? null,
      ],
    );

    return mapDeliveryLogRow(rows[0]);
  }

  /**
   * Find outbox rows for a workspace (for debugging/admin).
   */
  async findByWorkspace(
    workspaceId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<WebhookOutboxRow[]> {
    const { rows } = await query(
      `SELECT * FROM webhook_outbox
       WHERE workspace_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [workspaceId, limit, offset],
    );
    return rows.map(mapOutboxRow);
  }

  /**
   * Get delivery logs for an outbox row.
   */
  async getDeliveryLogs(outboxId: string): Promise<DeliveryLogRow[]> {
    const { rows } = await query(
      `SELECT * FROM webhook_delivery_logs
       WHERE outbox_id = $1
       ORDER BY attempt_number ASC`,
      [outboxId],
    );
    return rows.map(mapDeliveryLogRow);
  }

  /**
   * Count pending outbox rows (for monitoring).
   */
  async countPending(): Promise<number> {
    const { rows } = await query(
      `SELECT COUNT(*) as count FROM webhook_outbox
       WHERE status = 'pending' AND next_attempt_at <= now()`,
    );
    return parseInt(rows[0].count, 10);
  }
}

// ── Row Mappers ────────────────────────────────────────────

function mapOutboxRow(row: any): WebhookOutboxRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    workspaceId: row.workspace_id,
    webhookId: row.webhook_id,
    eventType: row.event_type,
    payload: typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload,
    status: row.status,
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
    nextAttemptAt: row.next_attempt_at,
    lastError: row.last_error ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDeliveryLogRow(row: any): DeliveryLogRow {
  return {
    id: row.id,
    outboxId: row.outbox_id,
    webhookId: row.webhook_id,
    attemptNumber: row.attempt_number,
    status: row.status,
    httpStatus: row.http_status ?? null,
    responseBody: row.response_body ?? null,
    responseHeaders: row.response_headers
      ? (typeof row.response_headers === "string"
          ? JSON.parse(row.response_headers)
          : row.response_headers)
      : null,
    durationMs: row.duration_ms,
    errorMessage: row.error_message ?? null,
    createdAt: row.created_at,
  };
}

export const webhookOutboxRepository = new WebhookOutboxRepository();
