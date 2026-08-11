// ============================================================
// AoraHQ Fair Ingress Ingestion Routes
//
// Provides the POST /ingress endpoint for usage event ingestion
// with built-in size-based billing, deduplication, and batch
// discount calculation.
//
// Routes:
//   POST /ingress       — Ingest a single event or batch array
//   GET  /ingress/usage — Query ingress billing usage for a tenant
// ============================================================

import { Router, Request, Response } from "express";
import { asyncHandler, badRequest, notFound } from "../middleware.ts";
import { resolveWorkspace } from "../db.ts";
import {
  handleBatchIngress,
  validateAndMeasureIngress,
  getIngressUsage,
  flushIngressCounters,
} from "../services/ingress-meter.ts";
import { batchIngestionService } from "../services/batch-ingestion-service.ts";

const router = Router();

/**
 * POST /ingress
 *
 * Ingest usage events with fair metering:
 *  - Accepts a single event object OR an array of events
 *  - Applies size-based billing (1 unit = 64 KB)
 *  - Deduplicates by eventId / idempotencyKey (24h window)
 *  - Applies batch discount (0.7x) for array payloads
 *
 * Request body (single):
 *   { customerId, meterId, value, timestamp?, metadata?, eventId? }
 *
 * Request body (batch):
 *   [{ customerId, meterId, value, ... }, ...]
 *
 * Headers:
 *   Authorization: Bearer <api_key>  | x-api-key: <key>
 *   Content-Type: application/json
 *
 * Response:
 *   { accepted, billableUnits, discountedUnits, duplicateCount,
 *     batchCount, events: [{ index, billableUnits, isDuplicate }] }
 */
router.post(
  "/ingress",
  asyncHandler(async (req: Request, res: Response) => {
    // 1. Resolve tenant from API key or workspace header
    const workspace = (req as any).workspace || (await resolveWorkspace(req));
    if (!workspace) {
      return badRequest(res, "Unknown tenant — valid API key or workspace ID required");
    }
    const tenantId = workspace.id;

    // 2. Check sandbox mode
    const isTest = (req as any).context?.isTest ?? false;

    // 3. Get raw body for accurate byte measurement
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    // 4. Process through ingress metering
    const result = await handleBatchIngress(tenantId, rawBody, isTest);

    // 4. Return result
    res.status(200).json({
      accepted: true,
      tenantId,
      billableUnits: result.totalBillableUnits,
      discountedUnits: result.totalDiscountedUnits,
      duplicateCount: result.duplicateCount,
      batchCount: result.batchCount,
      events: result.events.map((e) => ({
        index: e.index,
        billableUnits: e.billableUnits,
        isDuplicate: e.isDuplicate,
        eventId: e.eventId,
        error: e.error,
      })),
    });
  }),
);

/**
 * POST /ingress/batch
 *
 * Ingest a batch of usage events with batch discount pricing.
 *
 * Request body: array of event objects, max 1000
 *   [{ customerId, meterId, value, eventId?, timestamp?, metadata? }, ...]
 *
 * Response:
 *   {
 *     status: "processed" | "partial",
 *     total_received: 100,
 *     successfully_metered: 92,
 *     duplicates_ignored: 8,
 *     base_units: 92,
 *     charged_units: 73.6,
 *     batch_discount: 0.8,
 *     events: [{ index, eventId, isDuplicate, accepted }]
 *   }
 */
router.post(
  "/ingress/batch",
  asyncHandler(async (req: Request, res: Response) => {
    const workspace = (req as any).workspace || (await resolveWorkspace(req));
    if (!workspace) {
      return badRequest(res, "Unknown tenant — valid API key or workspace ID required");
    }
    const tenantId = workspace.id;

    const isTest = (req as any).context?.isTest ?? false;

    const events = req.body;
    if (!Array.isArray(events)) {
      return badRequest(res, "Request body must be a non-empty array of event objects");
    }

    const result = await batchIngestionService.processBatch(tenantId, events, isTest);

    res.status(result.status === "rejected" ? 400 : 200).json({
      status: result.status,
      total_received: result.totalReceived,
      successfully_metered: result.successfullyMetered,
      duplicates_ignored: result.duplicatesIgnored,
      base_units: result.baseUnits,
      charged_units: result.chargedUnits,
      batch_discount: result.batchDiscount,
      events: result.events.map((e) => ({
        index: e.index,
        event_id: e.eventId,
        payload_bytes: e.payloadSizeBytes,
        base_units: e.baseUnits,
        is_duplicate: e.isDuplicate,
        accepted: e.accepted,
        error: e.error,
      })),
    });
  }),
);

/**
 * GET /ingress/usage
 *
 * Query ingress billing usage for a tenant.
 *
 * Query params:
 *   tenantId — optional, defaults to resolved workspace
 *   from     — ISO date string (default: 7 days ago)
 *   to       — ISO date string (default: now)
 */
router.get(
  "/ingress/usage",
  asyncHandler(async (req: Request, res: Response) => {
    const workspace = (req as any).workspace || (await resolveWorkspace(req));
    if (!workspace) {
      return badRequest(res, "Unknown tenant");
    }
    const tenantId = (req.query.tenantId as string) || workspace.id;
    const isTest = (req as any).context?.isTest ?? false;

    const to = req.query.to ? new Date(req.query.to as string) : new Date();
    const from = req.query.from
      ? new Date(req.query.from as string)
      : new Date(to.getTime() - 7 * 86_400_000);

    const rows = await getIngressUsage(tenantId, from, to, isTest);

    const totalEvents = rows.reduce((a, r) => a + Number(r.eventCount), 0);
    const totalBillable = rows.reduce((a, r) => a + Number(r.billableUnits), 0);

    res.json({
      tenantId,
      from: from.toISOString(),
      to: to.toISOString(),
      totalEvents,
      totalBillableUnits: totalBillable,
      hourly: rows.map((r) => ({
        hourBucket: r.hourBucket,
        eventCount: Number(r.eventCount),
        billableUnits: Number(r.billableUnits),
        batchCount: Number(r.batchCount),
      })),
    });
  }),
);

/**
 * POST /ingress/flush
 *
 * Manually trigger a flush of buffered Redis counters to the
 * ingress_ledger table. In production, the background loop
 * handles this automatically.
 */
router.post(
  "/ingress/flush",
  asyncHandler(async (_req: Request, res: Response) => {
    const count = await flushIngressCounters();
    res.json({ flushed: count });
  }),
);

export default router;
