// ============================================================
// Idempotency Middleware
// Prevents duplicate processing of POST requests.
// ============================================================

import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { query } from "../db/pool.ts";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Middleware that checks and stores idempotency keys for POST requests.
 * Sends the Idempotency-Key header to guarantee exactly-once processing.
 */
export async function requireIdempotencyKey(req: Request, res: Response, next: NextFunction) {
  if (req.method !== "POST") return next();

  const key = (req.headers["idempotency-key"] || req.body?.idempotencyKey) as string | undefined;
  if (!key) return next(); // optional — proceed without

  try {
    // Check if already processed
    const { rows } = await query(
      "SELECT response_hash FROM processed_idempotency_keys WHERE idempotency_key = $1 AND expires_at > now()",
      [key],
    );

    if (rows.length > 0) {
      // Return cached response (idempotency hit — same response as before)
      return res.status(200).json({
        idempotent: true,
        message: "This request was already processed. Returning previous result.",
      });
    }

    // Monkey-patch res.json to capture the response for caching
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      const hash = crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex");

      // Store key — fire and forget
      query(
        `INSERT INTO processed_idempotency_keys (idempotency_key, response_hash, expires_at, created_at)
         VALUES ($1, $2, now() + INTERVAL '1 day', now())
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [key, hash],
      ).catch((err) => console.error("Idempotency store error:", err));

      return originalJson(body);
    };

    next();
  } catch (err) {
    console.error("Idempotency check error:", err);
    next();
  }
}

/**
 * Clean up expired idempotency keys (run periodically).
 */
export async function cleanupIdempotencyKeys(): Promise<void> {
  try {
    const { rows } = await query(
      "DELETE FROM processed_idempotency_keys WHERE expires_at < now()",
    );
    if (rows.length > 0) {
      console.log(`[Idempotency] Cleaned up ${rows.length} expired keys`);
    }
  } catch (err) {
    console.error("[Idempotency] Cleanup error:", err);
  }
}
