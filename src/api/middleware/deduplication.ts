// ============================================================
// AoraHQ 24-Hour Event Deduplication Middleware
//
// Express middleware that checks every incoming usage event for
// duplicate processing within a 24-hour rolling window.
//
// Usage:
//   router.post("/ingest", deduplicateEvent, handler);
//
// The middleware sets req.isDuplicate so downstream handlers
// and billing pipelines can skip counting for billing purposes.
// ============================================================

import type { Request, Response, NextFunction } from "express";
import { dedupService } from "../services/deduplication-service.ts";
import { badRequest } from "../middleware.ts";

// Extend Express Request to include dedup flag
declare global {
  namespace Express {
    interface Request {
      /** Set by deduplicateEvent middleware. True if this event
       *  is a duplicate within the 24-hour window. Downstream
       *  handlers should process business logic but NOT count
       *  this event toward billing usage limits. */
      isDuplicate?: boolean;

      /** The dedup result details if checked */
      dedupResult?: {
        isDuplicate: boolean;
        source: "redis" | "postgres" | "new";
      };
    }
  }
}

// ── Helpers ────────────────────────────────────────────────

/**
 * Extract tenant ID from the request context.
 * Priority: req.workspace > X-Workspace-Id header > query param
 */
function extractTenantId(req: Request): string | null {
  // From auth middleware (requireApiKey / optionalAuth)
  const ws = (req as any).workspace;
  if (ws?.id) return ws.id;

  // From resolveWorkspace header/query
  const headerId = req.headers["x-workspace-id"] as string | undefined;
  if (headerId) return headerId;

  const queryId = req.query.workspace as string | undefined;
  if (queryId) return queryId;

  return null;
}

/**
 * Extract event identifier from the request.
 * Priority: body.eventId > body.idempotencyKey > Idempotency-Key header
 */
function extractEventId(req: Request): string | null {
  const body = req.body || {};

  const eventId = body.eventId || body.event_id;
  if (eventId && typeof eventId === "string") return eventId;

  const idempotencyKey = body.idempotencyKey || body.idempotency_key;
  if (idempotencyKey && typeof idempotencyKey === "string") return idempotencyKey;

  const headerKey = req.headers["idempotency-key"] as string | undefined;
  if (headerKey) return headerKey;

  return null;
}

// ── Middleware ─────────────────────────────────────────────

/**
 * Express middleware that deduplicates incoming events using
 * a 24-hour sliding window backed by Redis (primary) and
 * PostgreSQL (fallback).
 *
 * Requires either:
 *   - `req.workspace.id` (set by requireApiKey middleware)
 *   - `X-Workspace-Id` header
 *   - `workspace` query parameter
 *
 * And one of:
 *   - `req.body.eventId` / `req.body.event_id`
 *   - `req.body.idempotencyKey` / `req.body.idempotency_key`
 *   - `Idempotency-Key` header
 *
 * Behavior:
 *   - Missing tenantId or eventId → 400 Bad Request
 *   - Duplicate event → req.isDuplicate = true (request proceeds)
 *   - New event → req.isDuplicate = false (request proceeds)
 */
export async function deduplicateEvent(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Only apply to POST/PUT/PATCH requests
  if (!["POST", "PUT", "PATCH"].includes(req.method)) {
    return next();
  }

  // 1. Extract tenant ID
  const tenantId = extractTenantId(req);
  if (!tenantId) {
    badRequest(
      res,
      "Missing tenant identifier — provide API key, X-Workspace-Id header, or workspace query param",
    );
    return;
  }

  // 2. Extract event ID
  const eventId = extractEventId(req);
  if (!eventId) {
    badRequest(
      res,
      "Missing event identifier — provide eventId, idempotencyKey in body, or Idempotency-Key header",
    );
    return;
  }

  try {
    // Check if this is a sandbox request
    const isTest = (req as any).context?.isTest ?? false;

    // 3. Perform dedup check
    const result = await dedupService.checkAndMark(tenantId, eventId, isTest);

    // 4. Attach result to request context
    req.isDuplicate = result.isDuplicate;
    req.dedupResult = {
      isDuplicate: result.isDuplicate,
      source: result.source,
    };

    // 5. Log dedup event (debug only)
    if (result.isDuplicate) {
      console.debug(
        `[Dedup] Duplicate event: tenant=${tenantId} event=${eventId} source=${result.source}`,
      );
    }
  } catch (err) {
    // Fail-safe: if dedup service throws, allow the request through
    // and log aggressively. Never crash ingestion due to dedup failure.
    console.error("[Dedup] Unexpected error, allowing event through:", err);
    req.isDuplicate = false;
    req.dedupResult = { isDuplicate: false, source: "postgres" };
  }

  next();
}
