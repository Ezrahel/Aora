// ============================================================
// Aora Billing OS — Usage Events, Quotas, Credits & Can-Consume
// POST /usage-events, GET /usage-events, POST /usage-events/bulk
// POST /usage-events/import, POST /events/replay
// GET /quotas, POST /quotas, DELETE /quotas/:id
// GET /credits/ledger, POST /credits/ledger
// GET /can-consume
// ============================================================

import { Router } from "express";
import { db, saveDatabase, writeAuditLog, resolveWorkspace, nanoid } from "../db.ts";
import { parsePagination, paginateArray, badRequest, notFound, genId, toNum } from "../middleware.ts";
import type { MeterDefinition, UsageEvent, Quota, CreditLedgerEntry, Entitlement, ClientEntitlement, Invoice } from "../types.ts";

export const router = Router();

// ── Internal helper ────────────────────────────────────────────
// Accumulate a usage event's value onto the customer and matching quota.
function applyUsage(customerId: string, meterId: string, value: number): void {
  const customer = db.customers.find((c) => c.id === customerId);
  if (customer && meterId === "compute_meter") {
    customer.usageUnits += value;
  }
  const quota = db.quotas.find(
    (q) => q.customerId === customerId && q.meterId === meterId,
  );
  if (quota) {
    quota.usedValue += value;
  }
}

// ── Usage Events ───────────────────────────────────────────────

// GET /usage-events
router.get("/usage-events", (req, res) => {
  const ws = resolveWorkspace(req);
  const tenantIds = new Set(
    db.customers.filter((c) => c.workspaceId === ws.id).map((c) => c.id),
  );

  const { customerId, meterId, from, to, q } = req.query as {
    customerId?: string;
    meterId?: string;
    from?: string;
    to?: string;
    q?: string;
  };

  let events = db.usageEvents.filter((e) => tenantIds.has(e.customerId));

  if (customerId) events = events.filter((e) => e.customerId === customerId);
  if (meterId) events = events.filter((e) => e.meterId === meterId);
  if (from) {
    const fromMs = new Date(from).getTime();
    events = events.filter((e) => new Date(e.timestamp).getTime() >= fromMs);
  }
  if (to) {
    const toMs = new Date(to).getTime();
    events = events.filter((e) => new Date(e.timestamp).getTime() <= toMs);
  }
  if (q) {
    const lower = q.toLowerCase();
    events = events.filter((e) =>
      JSON.stringify(e.metadata).toLowerCase().includes(lower),
    );
  }

  const opts = parsePagination(req);
  return res.json(paginateArray(events, opts));
});

// GET /usage-events/:id
router.get("/usage-events/:id", (req, res) => {
  const event = db.usageEvents.find((e) => e.id === req.params.id);
  if (!event) return notFound(res, "UsageEvent");
  return res.json(event);
});

// POST /usage-events
router.post("/usage-events", (req, res) => {
  const ws = resolveWorkspace(req);
  const { customerId, meterId, value, metadata, timestamp } = req.body as {
    customerId?: string;
    meterId?: string;
    value?: any;
    metadata?: Record<string, any>;
    timestamp?: string;
  };

  if (!customerId) return badRequest(res, "customerId is required.");
  if (!meterId) return badRequest(res, "meterId is required.");
  if (value === undefined || value === null) return badRequest(res, "value is required.");

  const customer = db.customers.find((c) => c.id === customerId);
  if (!customer) return notFound(res, "Customer");

  const event: UsageEvent = {
    id: "evt_" + genId(),
    customerId,
    meterId,
    timestamp: timestamp || new Date().toISOString(),
    value: toNum(value, 1),
    metadata: metadata ?? {},
  };

  db.usageEvents.unshift(event);
  applyUsage(customerId, meterId, event.value);

  saveDatabase();
  writeAuditLog(ws.id, "System", "CREATE", "EVENT", event.id, null, event);
  return res.status(201).json(event);
});

// POST /usage-events/bulk
// NOTE: must be declared before /usage-events/:id to avoid path conflict.
router.post("/usage-events/bulk", (req, res) => {
  const ws = resolveWorkspace(req);
  const body = req.body;

  if (!Array.isArray(body)) {
    return badRequest(res, "Expected an array of usage events.");
  }

  let processed = 0;
  let skipped = 0;

  for (const item of body as Array<{
    customerId?: string;
    meterId?: string;
    value?: any;
    metadata?: Record<string, any>;
    timestamp?: string;
    idempotencyKey?: string;
  }>) {
    const { customerId, meterId, value, metadata, timestamp, idempotencyKey } = item;

    const customer = db.customers.find((c) => c.id === customerId);
    if (!customer) continue;

    // Resolve dedupe key from top-level field or embedded in metadata
    const dedupeKey = idempotencyKey || metadata?.idempotencyKey;
    if (dedupeKey) {
      const isDuplicate = db.usageEvents.some(
        (e) =>
          e.metadata?.idempotencyKey === dedupeKey ||
          e.metadata?.dedupeId === dedupeKey,
      );
      if (isDuplicate) {
        skipped++;
        continue;
      }
    }

    const event: UsageEvent = {
      id: "evt_" + genId(),
      customerId: customerId!,
      meterId: meterId || "compute_meter",
      timestamp: timestamp || new Date().toISOString(),
      value: toNum(value, 1),
      metadata: {
        ...(metadata ?? {}),
        ...(dedupeKey ? { idempotencyKey: dedupeKey } : {}),
      },
    };

    db.usageEvents.unshift(event);
    applyUsage(event.customerId, event.meterId, event.value);
    processed++;
  }

  saveDatabase();

  return res.json({ processed, skipped, total: (body as any[]).length });
});

// POST /usage-events/import — historical batch ingest (no duplicate check)
router.post("/usage-events/import", (req, res) => {
  const ws = resolveWorkspace(req);
  const body = req.body;

  if (!Array.isArray(body)) {
    return badRequest(res, "Expected an array of usage events for import.");
  }

  let imported = 0;

  for (const item of body as Array<{
    customerId?: string;
    meterId?: string;
    value?: any;
    metadata?: Record<string, any>;
    timestamp?: string;
  }>) {
    const { customerId, meterId, value, metadata, timestamp } = item;

    const customer = db.customers.find((c) => c.id === customerId);
    if (!customer) continue;

    const event: UsageEvent = {
      id: "evt_import_" + genId(),
      customerId: customerId!,
      meterId: meterId || "compute_meter",
      timestamp: timestamp || new Date().toISOString(),
      value: toNum(value, 1),
      metadata: { ...(metadata ?? {}), imported: true },
    };

    db.usageEvents.push(event); // append to preserve chronological order
    applyUsage(event.customerId, event.meterId, event.value);
    imported++;
  }

  saveDatabase();
  writeAuditLog(
    ws.id,
    "Imports Ingestion Engine",
    "CREATE",
    "EVENT",
    "import_" + Date.now(),
    null,
    { imported },
  );

  return res.json({ imported });
});

// ── Events Replay ──────────────────────────────────────────────

// POST /events/replay
router.post("/events/replay", (req, res) => {
  const ws = resolveWorkspace(req);
  const { eventId } = req.body as { eventId?: string };

  if (!eventId) return badRequest(res, "eventId is required.");

  const event = db.usageEvents.find((e) => e.id === eventId);
  if (!event) return notFound(res, "Event");

  // Re-apply the event value to customer usage and matching quota
  applyUsage(event.customerId, event.meterId, event.value);

  const now = new Date().toISOString();
  writeAuditLog(
    ws.id,
    "Reprocessor Daemon",
    "UPDATE",
    "EVENT",
    event.id,
    { reason: "replay" },
    { ...event, reprocessedAt: now },
  );

  saveDatabase();

  return res.json({ status: "replayed", eventId: event.id, reprocessedAt: now });
});

// ── Quotas ─────────────────────────────────────────────────────

// GET /quotas
router.get("/quotas", (req, res) => {
  const ws = resolveWorkspace(req);
  const tenantIds = new Set(
    db.customers.filter((c) => c.workspaceId === ws.id).map((c) => c.id),
  );

  const { customerId } = req.query as { customerId?: string };

  let quotas = db.quotas.filter((q) => tenantIds.has(q.customerId));
  if (customerId) quotas = quotas.filter((q) => q.customerId === customerId);

  return res.json(quotas);
});

// POST /quotas — upsert by customerId+meterId
router.post("/quotas", (req, res) => {
  const ws = resolveWorkspace(req);
  const { customerId, meterId, limitValue, period } = req.body as {
    customerId?: string;
    meterId?: string;
    limitValue?: any;
    period?: Quota["period"];
  };

  if (!customerId) return badRequest(res, "customerId is required.");
  if (!meterId) return badRequest(res, "meterId is required.");

  const customer = db.customers.find((c) => c.id === customerId);
  if (!customer) return notFound(res, "Customer");

  const existingIdx = db.quotas.findIndex(
    (q) => q.customerId === customerId && q.meterId === meterId,
  );
  const beforeState =
    existingIdx > -1
      ? JSON.parse(JSON.stringify(db.quotas[existingIdx]))
      : null;

  const quota: Quota = {
    id:
      existingIdx > -1
        ? db.quotas[existingIdx].id
        : "q_" + customerId + "_" + meterId,
    customerId,
    meterId,
    limitValue: toNum(limitValue, 10000),
    usedValue: existingIdx > -1 ? db.quotas[existingIdx].usedValue : 0,
    period: period || "monthly",
    createdAt:
      existingIdx > -1
        ? db.quotas[existingIdx].createdAt
        : new Date().toISOString(),
  };

  if (existingIdx > -1) {
    db.quotas[existingIdx] = quota;
  } else {
    db.quotas.push(quota);
  }

  saveDatabase();
  writeAuditLog(
    ws.id,
    "Admin",
    existingIdx > -1 ? "UPDATE" : "CREATE",
    "QUOTA",
    quota.id,
    beforeState,
    quota,
  );

  return res.status(201).json(quota);
});

// DELETE /quotas/:id
router.delete("/quotas/:id", (req, res) => {
  const idx = db.quotas.findIndex((q) => q.id === req.params.id);
  if (idx === -1) return notFound(res, "Quota");

  db.quotas.splice(idx, 1);
  saveDatabase();

  return res.json({ deleted: true });
});

// ── Credits Ledger ─────────────────────────────────────────────

const VALID_CREDIT_TYPES: CreditLedgerEntry["type"][] = [
  "credit_issued",
  "credit_consumed",
  "credit_expired",
  "credit_reversed",
];

// GET /credits/ledger
router.get("/credits/ledger", (req, res) => {
  const ws = resolveWorkspace(req);
  const tenantIds = new Set(
    db.customers.filter((c) => c.workspaceId === ws.id).map((c) => c.id),
  );

  const { customerId } = req.query as { customerId?: string };

  let ledger = db.creditLedger.filter((e) => tenantIds.has(e.customerId));
  if (customerId) ledger = ledger.filter((e) => e.customerId === customerId);

  const opts = parsePagination(req);
  return res.json(paginateArray(ledger, opts));
});

// POST /credits/ledger
router.post("/credits/ledger", (req, res) => {
  const ws = resolveWorkspace(req);
  const { customerId, amount, type, description, expireAt } = req.body as {
    customerId?: string;
    amount?: any;
    type?: string;
    description?: string;
    expireAt?: string;
  };

  if (!customerId) return badRequest(res, "customerId is required.");
  if (amount === undefined || amount === null) return badRequest(res, "amount is required.");
  if (!type) return badRequest(res, "type is required.");
  if (!VALID_CREDIT_TYPES.includes(type as CreditLedgerEntry["type"])) {
    return badRequest(
      res,
      `type must be one of: ${VALID_CREDIT_TYPES.join(", ")}`,
      "VALIDATION_ERROR",
    );
  }

  const customer = db.customers.find((c) => c.id === customerId);
  if (!customer) return notFound(res, "Customer");

  const entry: CreditLedgerEntry = {
    id: "cred_" + genId(),
    customerId,
    amount: toNum(amount),
    type: type as CreditLedgerEntry["type"],
    description: description ?? "",
    createdAt: new Date().toISOString(),
    expireAt,
  };

  db.creditLedger.push(entry);
  saveDatabase();
  writeAuditLog(ws.id, "Admin", "CREATE", "CREDIT", entry.id, null, entry);

  return res.status(201).json(entry);
});

// ── Can Consume ────────────────────────────────────────────────

// GET /can-consume
router.get("/can-consume", (req, res) => {
  const { customerId, meterId, amount } = req.query as {
    customerId?: string;
    meterId?: string;
    amount?: string;
  };

  if (!customerId) return badRequest(res, "customerId is required.");
  if (!meterId) return badRequest(res, "meterId is required.");

  const meterIdStr = meterId;
  const numAmount = toNum(amount, 1);

  const customer = db.customers.find((c) => c.id === customerId);
  if (!customer) return notFound(res, "Customer");

  const quota = db.quotas.find(
    (q) => q.customerId === customerId && q.meterId === meterIdStr,
  );

  const limitVal = quota ? quota.limitValue : 100000;
  const usedVal = quota
    ? quota.usedValue
    : meterIdStr === "compute_meter"
      ? customer.usageUnits
      : 0;

  const isOverage = usedVal + numAmount > limitVal;

  // Sum all credit ledger entries for this customer (positive = issued/reversed)
  const creditBalance = db.creditLedger
    .filter((e) => e.customerId === customerId)
    .reduce((sum, e) => sum + e.amount, 0);

  const overage = usedVal + numAmount - limitVal;
  const canOffset = creditBalance > 0 && creditBalance >= overage;

  if (isOverage) {
    if (canOffset) {
      return res.json({
        allowed: true,
        reason: "quota_exceeded_with_credit_offset",
        details: {
          limitValue: limitVal,
          currentUsed: usedVal,
          requested: numAmount,
          creditBalance,
          canOffset: true,
        },
      });
    }

    return res.json({
      allowed: false,
      reason: "quota_exceeded",
      details: {
        limitValue: limitVal,
        currentUsed: usedVal,
        requested: numAmount,
        creditBalance,
        canOffset: false,
      },
    });
  }

  return res.json({
    allowed: true,
    reason: "quota_available",
    details: {
      limitValue: limitVal,
      currentUsed: usedVal,
      requested: numAmount,
      creditBalance,
      canOffset: true,
    },
  });
});

export default router;
