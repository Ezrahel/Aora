// ============================================================
// AoraHQ Fair Ingress Ingestion Metering Service
//
// Measures, deduplicates, and bills for usage event ingestion
// at the API edge. Uses Redis for high-throughput dedup and
// counter buffering, with async flush to PostgreSQL.
//
// Billing Rules:
//   1 Event Unit = Up to 64 KB JSON payload (ceil(size / 65536))
//   24h dedup via event_id / idempotency_key (SETNX + TTL)
//   Batch discount multiplier for array payloads (default 0.7x)
// ============================================================

import { query, withTransaction } from "../db/pool.ts";
import { cacheClient } from "../cache/redis.ts";

// ── Constants ──────────────────────────────────────────────

/** Size of one billable unit in bytes (64 KB) */
const UNIT_SIZE_BYTES = 65_536;

/** Default batch discount multiplier (0.7x of raw billable units) */
const DEFAULT_BATCH_DISCOUNT = 0.7;

/** Redis key prefix for deduplication entries */
const DEDUP_KEY_PREFIX = "dedup";

/** Redis key prefix for ingress counter buffers */
const INGRESS_KEY_PREFIX = "ingress";

/** TTL for deduplication entries (24 hours in seconds) */
const DEDUP_TTL_SECONDS = 86_400;

/** Interval for flushing buffered counters to Postgres (seconds) */
const FLUSH_INTERVAL_SECONDS = 60;

// ── Types ──────────────────────────────────────────────────

export interface IngressMeasurement {
  billableUnits: number;
  isDuplicate: boolean;
  payloadSizeBytes: number;
}

export interface UsageEventPayload {
  customerId: string;
  meterId: string;
  value: number;
  timestamp?: string;
  metadata?: Record<string, unknown>;
  eventId?: string;
  idempotencyKey?: string;
}

export interface IngressBatchResult {
  totalRawUnits: number;
  totalBillableUnits: number;
  totalDiscountedUnits: number;
  duplicateCount: number;
  batchCount: number;
  events: Array<{
    index: number;
    billableUnits: number;
    isDuplicate: boolean;
    eventId?: string;
    error?: string;
  }>;
}

export interface IngressLedgerRow {
  tenantId: string;
  hourBucket: string;
  eventCount: bigint;
  billableUnits: bigint;
  batchCount: bigint;
}

// ── Core Service ──────────────────────────────────────────

/**
 * Validate and measure a single ingress payload for billing.
 *
 * 1. Calculates byte size of raw payload → billable units (ceil(size / 64KB))
 * 2. Checks Redis SETNX for 24h dedup (if eventId provided)
 * 3. Returns billable units, dedup status, and size
 */
export async function validateAndMeasureIngress(
  tenantId: string,
  rawPayload: string,
  eventId?: string,
  isTest: boolean = false,
): Promise<IngressMeasurement> {
  // Size calculation
  const payloadSizeBytes = Buffer.byteLength(rawPayload, "utf-8");
  const billableUnits = Math.ceil(payloadSizeBytes / UNIT_SIZE_BYTES);

  // Deduplication check (test/live prefix keeps sandbox isolated)
  let isDuplicate = false;
  if (eventId) {
    const env = isTest ? "test" : "live";
    const dedupKey = `${DEDUP_KEY_PREFIX}:${env}:${tenantId}:${eventId}`;
    isDuplicate = !(await cacheClient.setNx(dedupKey, DEDUP_TTL_SECONDS));
  }

  // Sandbox events are metered for analytics but NOT billed
  const effectiveUnits = isTest ? 0 : (isDuplicate ? 0 : billableUnits);

  return {
    billableUnits: effectiveUnits,
    isDuplicate,
    payloadSizeBytes,
  };
}

/**
 * Compute the hour-bucket key for Redis counter buffering.
 * Format: ingress:{tenantId}:2026-07-15T14:00:00Z
 */
function hourBucketKey(tenantId: string, date: Date = new Date()): string {
  const bucket = new Date(date);
  bucket.setMinutes(0, 0, 0);
  return `${INGRESS_KEY_PREFIX}:${tenantId}:${bucket.toISOString()}`;
}

/**
 * Increment ingress counters in Redis for a tenant.
 * Uses HINCRBY on a hash keyed by hour bucket.
 * Fields: event_count, billable_units, batch_count
 */
async function bufferIngressCounters(
  tenantId: string,
  billableUnits: number,
  isBatch: boolean,
): Promise<void> {
  const bucketKey = hourBucketKey(tenantId);
  await cacheClient.batchHIncrBy([
    { key: bucketKey, field: "event_count", increment: 1 },
    { key: bucketKey, field: "billable_units", increment: billableUnits },
    { key: bucketKey, field: "batch_count", increment: isBatch ? 1 : 0 },
  ]);
}

// ── Batch Handler ──────────────────────────────────────────

/**
 * Handle a batch of usage events for fair ingress metering.
 *
 * 1. Validates the raw JSON input (avoiding huge parse in memory)
 * 2. Runs dedup + sizing on each event (pipelined Redis)
 * 3. Computes batch discount on total billable units
 * 4. Buffers counters in Redis for async Postgres flush
 *
 * @param tenantId - The tenant/workspace identifier
 * @param rawBody  - The raw JSON string from the HTTP request body
 * @returns Batch result with per-event and aggregate metrics
 */
export async function handleBatchIngress(
  tenantId: string,
  rawBody: string,
  isTest: boolean = false,
): Promise<IngressBatchResult> {
  // 1. Parse the JSON array — use streaming parse if available
  let events: any[];
  try {
    events = JSON.parse(rawBody);
    if (!Array.isArray(events)) {
      // Single event wrapped as batch
      events = [events];
    }
  } catch (err) {
    throw new Error("Invalid JSON payload: " + (err as Error).message);
  }

  if (events.length === 0) {
    return {
      totalRawUnits: 0,
      totalBillableUnits: 0,
      totalDiscountedUnits: 0,
      duplicateCount: 0,
      batchCount: 0,
      events: [],
    };
  }

  // 2. Process each event with dedup + sizing
  const batchDedupOps: Array<{ key: string; ttlSeconds: number }> = [];
  const eventIds: Array<string | undefined> = [];
  const payloadSizes: number[] = [];

  const env = isTest ? "test" : "live";

  for (const event of events) {
    const eventId = event.eventId || event.idempotencyKey;
    eventIds.push(eventId);
    payloadSizes.push(measurePayloadSize(event));

    if (eventId) {
      batchDedupOps.push({
        key: `${DEDUP_KEY_PREFIX}:${env}:${tenantId}:${eventId}`,
        ttlSeconds: DEDUP_TTL_SECONDS,
      });
    }
  }

  // Pipeline all dedup SETNX checks
  let dedupResults: boolean[];
  if (batchDedupOps.length > 0) {
    dedupResults = await cacheClient.batchSetNx(batchDedupOps);
  } else {
    dedupResults = [];
  }

  // Compute per-event measurements
  let dedupIdx = 0;
  let totalRawUnits = 0;
  let totalBillableUnits = 0;
  let duplicateCount = 0;

  const eventResults = events.map((event, i) => {
    const eventId = eventIds[i];
    const sizeBytes = payloadSizes[i];
    const rawUnits = Math.ceil(sizeBytes / UNIT_SIZE_BYTES);
    totalRawUnits += rawUnits;

    let isDuplicate = false;
    if (eventId) {
      isDuplicate = !dedupResults[dedupIdx++];
    }

    const billableUnits = isDuplicate ? 0 : rawUnits;
    totalBillableUnits += billableUnits;
    if (isDuplicate) duplicateCount++;

    return {
      index: i,
      billableUnits,
      isDuplicate,
      eventId,
    };
  });

  // 3. Apply batch discount (zero for sandbox — metered but not billed)
  const batchDiscount = isTest ? 0 : DEFAULT_BATCH_DISCOUNT;
  const totalDiscountedUnits = isTest ? 0 : Math.ceil(totalBillableUnits * batchDiscount);
  const isBatch = events.length > 1;

  // 4. Buffer counters in Redis
  await bufferIngressCounters(tenantId, totalDiscountedUnits, isBatch);

  return {
    totalRawUnits,
    totalBillableUnits,
    totalDiscountedUnits,
    duplicateCount,
    batchCount: events.length,
    events: eventResults,
  };
}

/**
 * Measure the approximate JSON byte size of a single event object
 * without fully serializing the batch. More accurate than string
 * length for UTF-8 multi-byte characters.
 */
function measurePayloadSize(obj: unknown): number {
  const json = JSON.stringify(obj);
  return Buffer.byteLength(json, "utf-8");
}

// ── Postgres Flush ──────────────────────────────────────────

/**
 * Flush aggregated ingress counters from Redis to the ingress_ledger
 * table in PostgreSQL. Called periodically by a background timer.
 *
 * For each buffered tenant+hour bucket found in Redis:
 *   1. Read all fields from the Redis hash
 *   2. UPSERT into ingress_ledger (append to existing counters)
 *   3. Delete the Redis hash to reset counters
 *
 * Returns the number of ledger rows upserted.
 */
export async function flushIngressCounters(): Promise<number> {
  // Scan for all ingress counter keys
  const pattern = `${INGRESS_KEY_PREFIX}:*`;
  const keys = await cacheClient.scanKeys(pattern);

  if (keys.length === 0) return 0;

  let flushed = 0;

  await withTransaction(async (client) => {
    for (const fullKey of keys) {
      // Parse tenantId and hourBucket from the key
      // Key format: aora:ingress:{tenantId}:{hourBucket}
      const prefix = cacheClient["keyPrefix"] || "aora:";
      const suffix = fullKey.slice(prefix.length + INGRESS_KEY_PREFIX.length + 1);
      const colonIdx = suffix.indexOf(":");
      if (colonIdx === -1) continue;

      const tenantId = suffix.slice(0, colonIdx);
      const hourBucket = suffix.slice(colonIdx + 1);

      // Read buffered counters
      const fields = await cacheClient.hGetAll(
        `${INGRESS_KEY_PREFIX}:${tenantId}:${hourBucket}`,
      );

      const eventCount = BigInt(fields.event_count ?? 0);
      const billableUnits = BigInt(fields.billable_units ?? 0);
      const batchCount = BigInt(fields.batch_count ?? 0);

      if (eventCount === 0n) continue;

      // UPSERT into ingress_ledger
      await client.query(
        `UPSERT INTO ingress_ledger (tenant_id, hour_bucket, event_count, billable_units, batch_count, is_test, created_at)
         VALUES ($1, $2, $3, $4, $5, false, now())`,
        [tenantId, hourBucket, eventCount, billableUnits, batchCount],
      );

      flushed++;
    }

    // Delete all processed keys from Redis
    if (keys.length > 0) {
      // Delete each hash key (keys contain the hash key, not individual fields)
      // Reset by deleting the hash keys
      for (const fullKey of keys) {
        const prefix = cacheClient["keyPrefix"] || "aora:";
        const unprefixed = fullKey.slice(prefix.length);
        await cacheClient.del(unprefixed);
      }
    }
  });

  return flushed;
}

/**
 * Start the background flush loop. Runs every FLUSH_INTERVAL_SECONDS.
 * In production, this would be a separate worker process or CRON job.
 */
export function startIngressFlushLoop(): ReturnType<typeof setInterval> {
  const intervalMs = FLUSH_INTERVAL_SECONDS * 1000;

  const loop = setInterval(async () => {
    try {
      const count = await flushIngressCounters();
      if (count > 0) {
        console.log(
          `[IngressMeter] Flushed ${count} ingress ledger rows`,
        );
      }
    } catch (err) {
      console.error("[IngressMeter] Flush error:", err);
    }
  }, intervalMs);

  // Prevent the timer from keeping the process alive
  if (typeof loop.unref === "function") {
    loop.unref();
  }

  console.log(
    `[IngressMeter] Flush loop started (interval: ${FLUSH_INTERVAL_SECONDS}s)`,
  );
  return loop;
}

// ── Query Helpers ──────────────────────────────────────────

/**
 * Query ingress ledger for a tenant within a time range.
 */
export async function getIngressUsage(
  tenantId: string,
  from: Date,
  to: Date,
  isTest: boolean = false,
): Promise<IngressLedgerRow[]> {
  const { rows } = await query(
    `SELECT tenant_id, hour_bucket, event_count, billable_units, batch_count
     FROM ingress_ledger
     WHERE tenant_id = $1
       AND hour_bucket >= $2
       AND hour_bucket < $3
       AND is_test = $4
     ORDER BY hour_bucket DESC`,
    [tenantId, from.toISOString(), to.toISOString(), isTest],
  );

  return rows.map((r: any) => ({
    tenantId: r.tenant_id,
    hourBucket: r.hour_bucket,
    eventCount: BigInt(r.event_count),
    billableUnits: BigInt(r.billable_units),
    batchCount: BigInt(r.batch_count),
  }));
}
