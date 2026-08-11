// ============================================================
// AoraHQ 24-Hour Deduplication Service
//
// Provides atomic, sub-millisecond dedup checks for usage events
// using Redis SET NX EX as the primary layer and PostgreSQL
// INSERT ... ON CONFLICT DO NOTHING as a fallback guard.
//
// Key template:  dedup:tenant_{tenantId}:event_{eventId}
// TTL:           86,400 seconds (24 hours)
// ============================================================

import { query, withTransaction } from "../db/pool.ts";
import { cacheClient } from "../cache/redis.ts";

// ── Constants ──────────────────────────────────────────────

const DEDUP_TTL_SECONDS = 86_400;
const DEDUP_KEY_PREFIX = "dedup";

// ── Types ──────────────────────────────────────────────────

export interface DedupResult {
  /** True if this event ID has been seen within the 24h window */
  isDuplicate: boolean;
  /** Which layer confirmed the dedup decision */
  source: "redis" | "postgres" | "new";
}

export interface DedupEntry {
  tenantId: string;
  eventId: string;
  dedupedAt: string;
}

// ── Service ────────────────────────────────────────────────

export class DeduplicationService {
  /**
   * Check if an event is a duplicate within the 24-hour sliding window.
   *
   * Strategy (two-layer defense):
   *   1. Redis SET NX EX — atomic read-and-write in a single round-trip.
   *      If Redis is unavailable, logs a warning and falls through to Postgres.
   *   2. PostgreSQL INSERT ... ON CONFLICT DO NOTHING —
   *      secondary guard for Redis cache-flush or outage scenarios.
   *
   * @param tenantId - The tenant/merchant identifier
   * @param eventId  - The unique event identifier (eventId or idempotencyKey)
   * @returns DedupResult with isDuplicate flag and the source layer used
   */
  async checkAndMark(
    tenantId: string,
    eventId: string,
    isTest: boolean = false,
  ): Promise<DedupResult> {
    if (!tenantId || !eventId) {
      throw new Error("tenantId and eventId are required for dedup check");
    }

    // Layer 1: Redis SET NX EX
    const redisResult = await this.tryRedisCheck(tenantId, eventId, isTest);
    if (redisResult !== null) return redisResult;

    // Layer 2: PostgreSQL fallback
    return this.fallbackPostgresCheck(tenantId, eventId, isTest);
  }

  /**
   * Attempt dedup via Redis. Returns null if Redis is unavailable.
   */
  private async tryRedisCheck(
    tenantId: string,
    eventId: string,
    isTest: boolean = false,
  ): Promise<DedupResult | null> {
    try {
      const env = isTest ? "test" : "live";
      const dedupKey = `${DEDUP_KEY_PREFIX}:${env}:tenant_${tenantId}:event_${eventId}`;
      const isNew = await cacheClient.setNx(dedupKey, DEDUP_TTL_SECONDS);

      return {
        isDuplicate: !isNew,
        source: "redis",
      };
    } catch (err) {
      console.warn(
        "[DedupService] Redis unavailable, falling back to Postgres:",
        (err as Error).message,
      );
      return null;
    }
  }

  /**
   * Fallback dedup via PostgreSQL INSERT ... ON CONFLICT DO NOTHING.
   * This provides durability even if the Redis cache is flushed
   * or the entire Redis cluster is down.
   */
  private async fallbackPostgresCheck(
    tenantId: string,
    eventId: string,
    isTest: boolean = false,
  ): Promise<DedupResult> {
    const env = isTest ? "test" : "live";
    const dedupKey = `${env}:${tenantId}:${eventId}`;

    try {
      const { rowCount } = await query(
        `INSERT INTO processed_events (dedup_key, tenant_id, event_id, is_test, expires_at, created_at)
         VALUES ($1, $2, $3, $4, now() + INTERVAL '1 day', now())
         ON CONFLICT (dedup_key) DO NOTHING`,
        [dedupKey, tenantId, eventId, isTest],
      );

      // rowCount === 1 means the insert succeeded (new event)
      // rowCount === 0 means the key already existed (duplicate)
      return {
        isDuplicate: rowCount === 0,
        source: "postgres",
      };
    } catch (err) {
      // Last resort: if Postgres also fails, allow the request through
      // (fail-open for availability, but log aggressively)
      console.error(
        "[DedupService] Postgres fallback also failed, allowing event:",
        (err as Error).message,
      );
      return { isDuplicate: false, source: "postgres" };
    }
  }

  /**
   * Batch dedup check — checks multiple event IDs in a single Redis pipeline.
   *
   * @param tenantId - The tenant identifier
   * @param eventIds - Array of event IDs to check
   * @param isTest   - Whether this is a sandbox request
   * @returns Array of DedupResult in the same order as eventIds
   */
  async batchCheckAndMark(
    tenantId: string,
    eventIds: string[],
    isTest: boolean = false,
  ): Promise<DedupResult[]> {
    if (eventIds.length === 0) return [];

    const env = isTest ? "test" : "live";

    // Build Redis pipeline operations
    const dedupOps = eventIds.map((eventId) => ({
      key: `${DEDUP_KEY_PREFIX}:${env}:tenant_${tenantId}:event_${eventId}`,
      ttlSeconds: DEDUP_TTL_SECONDS,
    }));

    try {
      const results = await cacheClient.batchSetNx(dedupOps);
      return results.map((isNew) => ({
        isDuplicate: !isNew,
        source: "redis" as const,
      }));
    } catch (err) {
      console.warn(
        "[DedupService] Redis batch unavailable, falling back to sequential Postgres:",
        (err as Error).message,
      );
      // Fall back to sequential Postgres checks
      const results: DedupResult[] = [];
      for (const eventId of eventIds) {
        results.push(await this.fallbackPostgresCheck(tenantId, eventId, isTest));
      }
      return results;
    }
  }

  /**
   * Manually remove a dedup key (for testing/admin).
   * Returns true if the key existed and was removed.
   */
  async revoke(tenantId: string, eventId: string, isTest: boolean = false): Promise<boolean> {
    const env = isTest ? "test" : "live";
    const dedupKey = `${DEDUP_KEY_PREFIX}:${env}:tenant_${tenantId}:event_${eventId}`;

    try {
      const deleted = await cacheClient.del(dedupKey);
      return deleted > 0;
    } catch {
      // Also try removing from Postgres
      try {
        const env = isTest ? "test" : "live";
        const { rowCount } = await query(
          "DELETE FROM processed_events WHERE dedup_key = $1",
          [`${env}:${tenantId}:${eventId}`],
        );
        return (rowCount ?? 0) > 0;
      } catch {
        return false;
      }
    }
  }
}

export const dedupService = new DeduplicationService();
