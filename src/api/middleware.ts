// ============================================================
// Aora Billing OS — Shared Middleware
// Rate limiter · Error handler · Pagination · Validators
// ============================================================

import type { Request, Response, NextFunction } from "express";
import type { PaginatedResponse } from "./types.ts";

// ── Rate Limiter ───────────────────────────────────────────────
// Simple in-memory sliding-window counter per IP.
// 200 req / 60 s in production; 1000 req / 60 s in development.

interface RateBucket {
  count: number;
  resetAt: number;
}

const rateBuckets = new Map<string, RateBucket>();
const RATE_LIMIT = process.env.NODE_ENV === "production" ? 200 : 1000;
const RATE_WINDOW_MS = 60_000;

export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    ?? req.socket.remoteAddress
    ?? "unknown";

  const now = Date.now();
  let bucket = rateBuckets.get(ip);

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 1, resetAt: now + RATE_WINDOW_MS };
    rateBuckets.set(ip, bucket);
    return next();
  }

  bucket.count += 1;
  if (bucket.count > RATE_LIMIT) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    res.setHeader("Retry-After", String(retryAfter));
    return res.status(429).json({
      error: "Too many requests. Please slow down.",
      code: "RATE_LIMITED",
      retryAfterSeconds: retryAfter,
    });
  }

  next();
}

// Purge stale buckets every 5 min to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of rateBuckets) {
    if (now > bucket.resetAt) rateBuckets.delete(ip);
  }
}, 300_000);


// ── Global Error Handler ───────────────────────────────────────

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  console.error(`[${new Date().toISOString()}] Unhandled error on ${req.method} ${req.path}:`, err);

  if (res.headersSent) return next(err);

  const status = err.statusCode ?? err.status ?? 500;
  res.status(status).json({
    error: err.message ?? "An unexpected server error occurred.",
    code: err.code ?? "INTERNAL_ERROR",
  });
}


// ── Pagination ─────────────────────────────────────────────────

export interface PaginationOpts {
  page: number;
  limit: number;
  offset: number;
}

export function parsePagination(req: Request, defaultLimit = 50): PaginationOpts {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(
    500,
    Math.max(1, parseInt(String(req.query.limit ?? String(defaultLimit)), 10) || defaultLimit),
  );
  return { page, limit, offset: (page - 1) * limit };
}

export function paginateArray<T>(
  items: T[],
  opts: PaginationOpts,
): PaginatedResponse<T> {
  const sliced = items.slice(opts.offset, opts.offset + opts.limit);
  return {
    data: sliced,
    total: items.length,
    page: opts.page,
    limit: opts.limit,
    hasMore: opts.offset + opts.limit < items.length,
  };
}


// ── Validation Helpers ─────────────────────────────────────────

/** Throws a 400-shaped Error if `value` is falsy/undefined/blank. */
export function requireField(value: any, fieldName: string): void {
  if (value === undefined || value === null || value === "") {
    const err: any = new Error(`Required field missing: '${fieldName}'.`);
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
}

/** Returns a typed error response helper for use inside route handlers. */
export function badRequest(res: Response, message: string, code = "BAD_REQUEST") {
  return res.status(400).json({ error: message, code });
}

export function notFound(res: Response, resource = "Resource") {
  return res.status(404).json({ error: `${resource} not found.`, code: "NOT_FOUND" });
}

export function conflict(res: Response, message: string) {
  return res.status(409).json({ error: message, code: "CONFLICT" });
}


// ── HMAC Signing (for webhooks) ────────────────────────────────

import { createHmac } from "crypto";

export function signWebhookPayload(payload: string, secret: string): string {
  return "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");
}

export function generateWebhookSecret(): string {
  return createHmac("sha256", String(Date.now()))
    .update(Math.random().toString(36))
    .digest("hex");
}


// ── Misc helpers ───────────────────────────────────────────────

/** Generate a random alphanumeric ID with an optional prefix. */
export function genId(prefix = ""): string {
  return (
    prefix +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 6)
  );
}

/** Advance an ISO date by N months. */
export function addMonths(isoDate: string, months: number): string {
  const d = new Date(isoDate);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

/** Advance an ISO date by N days. */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** Safely parse a JSON body field into a number; return fallback if invalid. */
export function toNum(val: any, fallback = 0): number {
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}
