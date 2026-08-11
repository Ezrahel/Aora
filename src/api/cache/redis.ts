// ============================================================
// AoraHQ Redis Cache Layer
// Provides high-throughput, pipelined Redis operations for:
//   - Deduplication (SETNX with TTL)
//   - Ingress counter buffering (HINCRBY)
//   - Background flush to PostgreSQL
// Falls back to an in-memory Map when Redis is unavailable
// (development/sandbox environments).
// ============================================================

// In-memory fallback for when Redis is not configured
interface MemoryEntry {
  value: number;
  expiresAt: number;
}

const memoryStore = new Map<string, MemoryEntry>();
const TTL_SWEEP_INTERVAL = 60_000; // sweep expired keys every 60s

// Periodic TTL sweep for in-memory store
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore) {
      if (entry.expiresAt <= now) memoryStore.delete(key);
    }
  }, TTL_SWEEP_INTERVAL);
}

export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

// ── Redis Client Abstraction ──────────────────────────────

/**
 * A high-throughput cache abstraction that supports both Redis
 * and an in-memory fallback. When REDIS_URL is set, it connects
 * to Redis and uses pipelined operations. Otherwise, it uses
 * an in-memory Map with TTL expiration.
 */
export class CacheClient {
  private redis: any | null = null;
  private memoryOnly: boolean;
  private keyPrefix: string;

  constructor(config?: Partial<CacheConfig>) {
    this.keyPrefix = config?.keyPrefix ?? "aora:";
    this.memoryOnly = true;

    const redisUrl = process.env.REDIS_URL || config?.host;
    if (redisUrl) {
      // Attempt Redis connection (lazy, on first use)
      this.memoryOnly = false;
    }
  }

  /**
   * Attempt to initialize the Redis connection.
   * Returns true if Redis is available, false if falling back to memory.
   */
  private async ensureRedis(): Promise<boolean> {
    if (this.redis) return true;
    if (this.memoryOnly) return false;

    try {
      // Dynamic import to avoid hard dependency
      const { default: IORedis } = await import("ioredis");
      this.redis = new IORedis(process.env.REDIS_URL!, {
        maxRetriesPerRequest: 3,
        retryStrategy(times: number) {
          if (times > 5) return null; // stop retrying
          return Math.min(times * 200, 2000);
        },
        lazyConnect: true,
        enableAutoPipelining: true,
        keepAlive: 5000,
      });
      await this.redis.connect();
      this.memoryOnly = false;
      return true;
    } catch {
      console.warn(
        "[CacheClient] Redis unavailable — falling back to in-memory store",
      );
      this.memoryOnly = true;
      return false;
    }
  }

  private prefixed(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * SETNX with TTL: set a key only if it does not already exist.
   * Returns true if the key was set (first time), false if it already existed.
   */
  async setNx(key: string, ttlSeconds: number): Promise<boolean> {
    const fullKey = this.prefixed(key);

    if (!this.memoryOnly) {
      await this.ensureRedis();
    }

    if (this.redis) {
      const result = await this.redis.set(fullKey, "1", "NX", "EX", ttlSeconds);
      return result === "OK";
    }

    // In-memory fallback
    const now = Date.now();
    const existing = memoryStore.get(fullKey);
    if (existing && existing.expiresAt > now) return false;

    memoryStore.set(fullKey, { value: 1, expiresAt: now + ttlSeconds * 1000 });
    return true;
  }

  /**
   * Increment a hash field by a given amount.
   * Used for buffering ingress counters before flushing to Postgres.
   */
  async hIncrBy(key: string, field: string, increment: number): Promise<number> {
    const fullKey = this.prefixed(key);

    if (!this.memoryOnly) {
      await this.ensureRedis();
    }

    if (this.redis) {
      return Number(await this.redis.hincrby(fullKey, field, increment));
    }

    // In-memory fallback
    const memKey = `${fullKey}:${field}`;
    const now = Date.now();
    const existing = memoryStore.get(memKey);
    const newValue = (existing ? existing.value : 0) + increment;
    memoryStore.set(memKey, {
      value: newValue,
      expiresAt: now + 86_400_000, // 24h TTL
    });
    return newValue;
  }

  /**
   * Get all fields and values from a hash.
   * Used by the flush mechanism to read buffered counters.
   */
  async hGetAll(key: string): Promise<Record<string, number>> {
    const fullKey = this.prefixed(key);

    if (!this.memoryOnly) {
      await this.ensureRedis();
    }

    if (this.redis) {
      const result = await this.redis.hgetall(fullKey);
      const parsed: Record<string, number> = {};
      for (const [k, v] of Object.entries(result)) {
        parsed[k] = Number(v);
      }
      return parsed;
    }

    // In-memory fallback — scan for prefixed keys
    const prefix = `${fullKey}:`;
    const result: Record<string, number> = {};
    const now = Date.now();
    for (const [k, v] of memoryStore) {
      if (k.startsWith(prefix) && v.expiresAt > now) {
        result[k.slice(prefix.length)] = v.value;
      }
    }
    return result;
  }

  /**
   * Delete a key. Returns the number of keys deleted.
   */
  async del(key: string): Promise<number> {
    const fullKey = this.prefixed(key);

    if (!this.memoryOnly) {
      await this.ensureRedis();
    }

    if (this.redis) {
      return await this.redis.del(fullKey);
    }

    const memKeyPrefix = `${fullKey}:`;
    let deleted = 0;
    for (const k of memoryStore.keys()) {
      if (k === fullKey || k.startsWith(memKeyPrefix)) {
        memoryStore.delete(k);
        deleted++;
      }
    }
    return deleted;
  }

  /**
   * Pipeline multiple SETNX operations for batch dedup.
   * Returns an array of booleans in the same order as keys.
   */
  async batchSetNx(
    entries: Array<{ key: string; ttlSeconds: number }>,
  ): Promise<boolean[]> {
    if (entries.length === 0) return [];

    if (!this.memoryOnly) {
      await this.ensureRedis();
    }

    if (this.redis) {
      const pipeline = this.redis.pipeline();
      for (const { key, ttlSeconds } of entries) {
        const fullKey = this.prefixed(key);
        pipeline.set(fullKey, "1", "NX", "EX", ttlSeconds);
      }
      const results = await pipeline.exec();
      return results.map(([err, result]: [Error | null, any]) => {
        if (err) {
          console.error("[CacheClient] pipeline error:", err);
          return false;
        }
        return result === "OK";
      });
    }

    // In-memory fallback
    return entries.map(({ key, ttlSeconds }) => this.setNx(key, ttlSeconds)) as any;
  }

  /**
   * Pipeline multiple HINCRBY operations for batch counter updates.
   */
  async batchHIncrBy(
    operations: Array<{ key: string; field: string; increment: number }>,
  ): Promise<number[]> {
    if (operations.length === 0) return [];

    if (!this.memoryOnly) {
      await this.ensureRedis();
    }

    if (this.redis) {
      const pipeline = this.redis.pipeline();
      for (const { key, field, increment } of operations) {
        pipeline.hincrby(this.prefixed(key), field, increment);
      }
      const results = await pipeline.exec();
      return results.map(([err, result]: [Error | null, any]) => {
        if (err) {
          console.error("[CacheClient] pipeline error:", err);
          return 0;
        }
        return Number(result);
      });
    }

    // In-memory fallback
    return Promise.all(
      operations.map(({ key, field, increment }) =>
        this.hIncrBy(key, field, increment),
      ),
    );
  }

  /**
   * Scan for keys matching a pattern (for flush discovery).
   * IMPORTANT: Redis SCAN is O(1) per call with COUNT hint.
   * In-memory fallback does a linear scan of the Map.
   */
  async scanKeys(pattern: string): Promise<string[]> {
    const fullPattern = this.prefixed(pattern);

    if (!this.memoryOnly) {
      await this.ensureRedis();
    }

    if (this.redis) {
      const stream = this.redis.scanStream({
        match: fullPattern,
        count: 1000,
      });
      const keys: string[] = [];
      for await (const batch of stream) {
        keys.push(...batch);
      }
      return keys;
    }

    // In-memory fallback
    const regex = new RegExp(
      "^" + fullPattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
    );
    const keys: string[] = [];
    const now = Date.now();
    for (const [k, v] of memoryStore) {
      if (regex.test(k) && v.expiresAt > now) {
        keys.push(k);
      }
    }
    return keys;
  }

  /**
   * Check if Redis is actively connected.
   */
  isConnected(): boolean {
    return this.redis?.status === "ready";
  }

  /**
   * Gracefully close the Redis connection.
   */
  async quit(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }
}

// Singleton
export const cacheClient = new CacheClient();
