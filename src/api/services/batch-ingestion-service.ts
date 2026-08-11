// ============================================================
// AoraHQ Batch Ingestion Service
//
// Handles bulk event arrays with size-based billing, Redis
// pipelined deduplication, and batch discount computation.
// Writes aggregated results directly to PostgreSQL.
//
// Batch Pricing:
//   Base:    1 unit per 64 KB per event (ceil)
//   Dedup:   Duplicate events contribute 0 units
//   Discount: Batch multiplier (default 0.8x) on total unique units
// ============================================================

import { query, withTransaction } from "../db/pool.ts";
import { dedupService } from "./deduplication-service.ts";

// ── Constants ──────────────────────────────────────────────

/** Max events per batch */
const MAX_BATCH_SIZE = 1000;

/** Size of one billable unit in bytes (64 KB) */
const UNIT_SIZE_BYTES = 65_536;

/** Default batch discount multiplier */
const DEFAULT_BATCH_DISCOUNT = 0.8;

// ── Types ──────────────────────────────────────────────────

export interface BatchEventResult {
  index: number;
  eventId?: string;
  payloadSizeBytes: number;
  baseUnits: number;
  isDuplicate: boolean;
  accepted: boolean;
  error?: string;
}

export interface BatchIngestionResult {
  status: "processed" | "partial" | "rejected";
  totalReceived: number;
  successfullyMetered: number;
  duplicatesIgnored: number;
  baseUnits: number;
  chargedUnits: number;
  batchDiscount: number;
  events: BatchEventResult[];
}

// ── Service ────────────────────────────────────────────────

export class BatchIngestionService {
  private batchDiscount: number;

  constructor(discount?: number) {
    this.batchDiscount = discount ?? DEFAULT_BATCH_DISCOUNT;
  }

  /**
   * Process a batch of usage events.
   *
   * Steps:
   *   1. Validate the payload (non-empty array, max 1000)
   *   2. Measure each event's JSON byte size
   *   3. Run pipelined Redis dedup for all event IDs
   *   4. Compute base units and charged units
   *   5. Write aggregated result to PostgreSQL
   *
   * @param tenantId - The tenant/workspace identifier
   * @param events   - Parsed array of event objects
   * @returns Detailed batch result
   */
  async processBatch(
    tenantId: string,
    events: Record<string, unknown>[],
    isTest: boolean = false,
  ): Promise<BatchIngestionResult> {
    // 1. Validate
    if (!Array.isArray(events) || events.length === 0) {
      return {
        status: "rejected",
        totalReceived: 0,
        successfullyMetered: 0,
        duplicatesIgnored: 0,
        baseUnits: 0,
        chargedUnits: 0,
        batchDiscount: this.batchDiscount,
        events: [],
      };
    }

    if (events.length > MAX_BATCH_SIZE) {
      throw new Error(
        `Batch exceeds maximum size of ${MAX_BATCH_SIZE} events (received ${events.length})`,
      );
    }

    // 2. Measure payload sizes and collect event IDs
    const eventIds: Array<string | undefined> = [];
    const payloadSizes: number[] = [];

    for (const event of events) {
      const eventId = (event.eventId ?? event.idempotencyKey ?? event.event_id ?? event.idempotency_key) as string | undefined;
      eventIds.push(eventId);

      // Measure the individual event's JSON byte size
      payloadSizes.push(measureJsonBytes(event));
    }

    // 3. Run dedup via Redis pipeline
    const validEventIds: string[] = [];
    const eventIdIndexMap = new Map<number, number>(); // eventIndex -> dedupResultIndex

    for (let i = 0; i < eventIds.length; i++) {
      if (eventIds[i]) {
        validEventIds.push(eventIds[i]!);
        eventIdIndexMap.set(validEventIds.length - 1, i);
      }
    }

    let dedupResults: boolean[] = []; // isNew flags, parallel to validEventIds
    if (validEventIds.length > 0) {
      const results = await dedupService.batchCheckAndMark(tenantId, validEventIds, isTest);
      dedupResults = results.map((r) => !r.isDuplicate); // true = new, false = duplicate
    }

    // Build a dedup lookup: eventIndex -> isDuplicate
    const isDuplicateMap = new Map<number, boolean>();
    for (let i = 0; i < validEventIds.length; i++) {
      const eventIdx = eventIdIndexMap.get(i)!;
      isDuplicateMap.set(eventIdx, !dedupResults[i]);
    }

    // 4. Compute per-event and aggregate metrics
    let baseUnits = 0;
    let successfullyMetered = 0;
    let duplicatesIgnored = 0;
    const eventResults: BatchEventResult[] = [];

    for (let i = 0; i < events.length; i++) {
      const sizeBytes = payloadSizes[i];
      const rawUnits = Math.ceil(sizeBytes / UNIT_SIZE_BYTES);
      const isDuplicate = isDuplicateMap.get(i) ?? false;
      const eventUnits = isDuplicate ? 0 : rawUnits;

      baseUnits += eventUnits;
      if (isDuplicate) {
        duplicatesIgnored++;
      } else {
        successfullyMetered++;
      }

      eventResults.push({
        index: i,
        eventId: eventIds[i],
        payloadSizeBytes: sizeBytes,
        baseUnits: rawUnits,
        isDuplicate,
        accepted: !isDuplicate,
      });
    }

    // Apply batch discount (zero for sandbox — metered but not billed)
    const effectiveDiscount = isTest ? 0 : this.batchDiscount;
    const chargedUnits = isTest ? 0 : roundToNearest(baseUnits * effectiveDiscount, 0.0001);

    // 5. Write aggregated result to PostgreSQL
    await this.writeToLedger(tenantId, events.length, baseUnits, chargedUnits, isTest);

    return {
      status: duplicatesIgnored > 0 ? "partial" : "processed",
      totalReceived: events.length,
      successfullyMetered,
      duplicatesIgnored,
      baseUnits,
      chargedUnits,
      batchDiscount: this.batchDiscount,
      events: eventResults,
    };
  }

  /**
   * Write aggregated batch counters to the ingress_ledger table.
   * Uses UPSERT (ON CONFLICT) to safely increment hourly buckets.
   *
   * charged_units is stored as DECIMAL(18,4) for fractional precision.
   */
  private async writeToLedger(
    tenantId: string,
    eventCount: number,
    billableUnits: number,
    chargedUnits: number,
    isTest: boolean = false,
  ): Promise<void> {
    const hourBucket = hourBucketISO();

    try {
      const { rowCount } = await query(
        `UPSERT INTO ingress_ledger (tenant_id, hour_bucket, event_count, billable_units, charged_units, is_test, batch_count, created_at)
         VALUES ($1, $2,
           COALESCE((SELECT event_count FROM ingress_ledger WHERE tenant_id = $1 AND hour_bucket = $2), 0) + $3,
           COALESCE((SELECT billable_units FROM ingress_ledger WHERE tenant_id = $1 AND hour_bucket = $2), 0) + $4,
           COALESCE((SELECT charged_units FROM ingress_ledger WHERE tenant_id = $1 AND hour_bucket = $2), 0) + $5,
           $6,
           COALESCE((SELECT batch_count FROM ingress_ledger WHERE tenant_id = $1 AND hour_bucket = $2), 0) + 1,
           now())`,
        [tenantId, hourBucket, eventCount, billableUnits, chargedUnits, isTest],
      );

      if (rowCount === 0) {
        // Fallback: initial insert
        await query(
          `INSERT INTO ingress_ledger (tenant_id, hour_bucket, event_count, billable_units, charged_units, is_test, batch_count, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, 1, now())
           ON CONFLICT (tenant_id, hour_bucket) DO NOTHING`,
          [tenantId, hourBucket, eventCount, billableUnits, chargedUnits, isTest],
        );
      }
    } catch (err) {
      console.error("[BatchIngestion] Failed to write to ingress_ledger:", err);
      throw err;
    }
  }
}

// ── Helpers ────────────────────────────────────────────────

/**
 * Measure the UTF-8 byte size of a JSON-serialized object.
 * Uses Buffer.byteLength for correct multi-byte character sizing.
 */
function measureJsonBytes(obj: unknown): number {
  const json = JSON.stringify(obj);
  return Buffer.byteLength(json, "utf-8");
}

/**
 * Truncate the current time to the hour and return an ISO string.
 * All events in the same clock hour share the same bucket.
 */
function hourBucketISO(date?: Date): string {
  const d = date ?? new Date();
  d.setMinutes(0, 0, 0);
  return d.toISOString();
}

/**
 * Round a number to a given precision (e.g., 0.0001 for 4 decimal places).
 * Prevents floating-point accumulation errors on high-volume billing.
 */
function roundToNearest(value: number, precision: number): number {
  const factor = 1 / precision;
  return Math.round(value * factor) / factor;
}

export const batchIngestionService = new BatchIngestionService();
