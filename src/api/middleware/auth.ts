// ============================================================
// Authentication & Rate Limiting Middleware
// ============================================================

import type { Request, Response, NextFunction } from "express";
import { query } from "../db/pool.ts";
import type { Workspace } from "../types.ts";

// Extend Express Request to include workspace
declare global {
  namespace Express {
    interface Request {
      workspace?: Workspace;
      requestId?: string;
    }
  }
}

// ── API Key Authentication ──────────────────────────────────

export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const authHeader = (req.headers["authorization"] || req.headers["x-api-key"] || "") as string;
  const apiKey = authHeader.replace("Bearer ", "").trim();

  if (!apiKey) {
    // Skip auth for webhook endpoints (they verify via signature)
    if (req.path.includes("/gateways/webhooks/") || req.path === "/health") {
      return next();
    }
    return res.status(401).json({ error: "API key required. Provide via Authorization: Bearer <key> header.", code: "UNAUTHORIZED" });
  }

  try {
    const result = await query(
      `SELECT w.id, w.organization_id, w.name, w.environment, w.api_keys, w.profile, w.settings, w.created_at
       FROM workspaces w
       WHERE $1 = ANY(w.api_keys) AND w.environment = 'production'
       LIMIT 1`,
      [apiKey],
    );
    const rows = result.rows;

    if (rows.length === 0) {
      return res.status(403).json({ error: "Invalid API key.", code: "FORBIDDEN" });
    }

    req.workspace = rows[0] as any;
    next();
  } catch (err) {
    console.error("Auth error:", err);
    return res.status(500).json({ error: "Authentication service unavailable.", code: "AUTH_ERROR" });
  }
}

export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = (req.headers["authorization"] || req.headers["x-api-key"] || "") as string;
  const apiKey = authHeader.replace("Bearer ", "").trim();

  if (apiKey) {
    try {
      const result = await query(
        "SELECT w.id, w.organization_id, w.name, w.environment, w.api_keys, w.profile, w.settings, w.created_at FROM workspaces w WHERE $1 = ANY(w.api_keys) LIMIT 1",
        [apiKey],
      );
      if (result.rows.length > 0) req.workspace = result.rows[0] as any;
    } catch { /* ignore auth failures on optional auth */ }
  }

  next();
}

// ── Workspace Rate Limiter ──────────────────────────────────

interface WsRateBucket {
  count: number;
  resetAt: number;
}

const wsRateBuckets = new Map<string, WsRateBucket>();
const WS_RATE_LIMIT = parseInt(process.env.WORKSPACE_RATE_LIMIT || "1000", 10);
const WS_RATE_WINDOW_MS = 60_000;

export function workspaceRateLimit(req: Request, res: Response, next: NextFunction) {
  const wsId = req.workspace?.id || req.ip || "unknown";
  const now = Date.now();
  let bucket = wsRateBuckets.get(wsId);

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 1, resetAt: now + WS_RATE_WINDOW_MS };
    wsRateBuckets.set(wsId, bucket);
    return next();
  }

  bucket.count += 1;
  if (bucket.count > WS_RATE_LIMIT) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    res.setHeader("Retry-After", String(retryAfter));
    res.setHeader("X-RateLimit-Limit", String(WS_RATE_LIMIT));
    res.setHeader("X-RateLimit-Remaining", "0");
    return res.status(429).json({
      error: "Workspace rate limit exceeded. Slow down.",
      code: "RATE_LIMITED",
      retryAfterSeconds: retryAfter,
    });
  }

  res.setHeader("X-RateLimit-Limit", String(WS_RATE_LIMIT));
  res.setHeader("X-RateLimit-Remaining", String(WS_RATE_LIMIT - bucket.count));

  next();
}

// Clean up stale buckets every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of wsRateBuckets) {
    if (now > bucket.resetAt) wsRateBuckets.delete(key);
  }
}, 300_000);
