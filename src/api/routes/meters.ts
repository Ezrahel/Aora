// ============================================================
// Aora Billing OS — Meters & Usage Stats Routes
// GET /meters, POST /meters, PUT /meters/:id, DELETE /meters/:id
// GET /meters/:id/usage
// ============================================================

import { Router } from "express";
import { db, saveDatabase, writeAuditLog, resolveWorkspace, nanoid } from "../db.ts";
import { parsePagination, paginateArray, badRequest, notFound, genId, toNum } from "../middleware.ts";
import type { MeterDefinition, UsageEvent, Quota, CreditLedgerEntry, Entitlement, ClientEntitlement, Invoice } from "../types.ts";

export const router = Router();

// GET /meters
// Returns all meters; if ?archived=false, excludes archived meters.
router.get("/meters", (req, res) => {
  const { archived } = req.query as { archived?: string };
  let meters = [...db.meters];
  if (archived === "false") {
    meters = meters.filter((m) => m.status !== "archived");
  }
  return res.json(meters);
});

// GET /meters/:id
router.get("/meters/:id", (req, res) => {
  const meter = db.meters.find((m) => m.id === req.params.id);
  if (!meter) return notFound(res, "Meter");
  return res.json(meter);
});

// POST /meters
router.post("/meters", (req, res) => {
  const { name, description, aggregationType, targetField, slug, unit } = req.body as {
    name?: string;
    description?: string;
    aggregationType?: string;
    targetField?: string;
    slug?: string;
    unit?: string;
  };

  if (!name?.trim()) return badRequest(res, "name is required.");
  if (!aggregationType?.trim()) return badRequest(res, "aggregationType is required.");
  if (!targetField?.trim()) return badRequest(res, "targetField is required.");

  const id = name.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_meter";

  if (db.meters.find((m) => m.id === id)) {
    return res.status(409).json({
      error: `Meter with id '${id}' already exists.`,
      code: "CONFLICT",
    });
  }

  const meter: MeterDefinition = {
    id,
    name: name.trim(),
    description: description ?? "",
    aggregationType: aggregationType as MeterDefinition["aggregationType"],
    targetField: targetField.trim(),
    slug: slug ?? id,
    unit,
    status: "active",
  };

  db.meters.push(meter);
  saveDatabase();

  const ws = resolveWorkspace(req);
  writeAuditLog(ws.id, "Admin", "CREATE", "METER", meter.id, null, meter);
  return res.status(201).json(meter);
});

// PUT /meters/:id
router.put("/meters/:id", (req, res) => {
  const meter = db.meters.find((m) => m.id === req.params.id);
  if (!meter) return notFound(res, "Meter");

  const { name, description, aggregationType, targetField, unit, status } = req.body as {
    name?: string;
    description?: string;
    aggregationType?: MeterDefinition["aggregationType"];
    targetField?: string;
    unit?: string;
    status?: MeterDefinition["status"];
  };

  const before = { ...meter };
  if (name !== undefined) meter.name = name.trim();
  if (description !== undefined) meter.description = description;
  if (aggregationType !== undefined) meter.aggregationType = aggregationType;
  if (targetField !== undefined) meter.targetField = targetField.trim();
  if (unit !== undefined) meter.unit = unit;
  if (status !== undefined) meter.status = status;

  saveDatabase();
  const ws = resolveWorkspace(req);
  writeAuditLog(ws.id, "Admin", "UPDATE", "METER", meter.id, before, meter);
  return res.json(meter);
});

// DELETE /meters/:id — soft delete (archive)
router.delete("/meters/:id", (req, res) => {
  const meter = db.meters.find((m) => m.id === req.params.id);
  if (!meter) return notFound(res, "Meter");

  const before = { ...meter };
  meter.status = "archived";

  saveDatabase();
  const ws = resolveWorkspace(req);
  writeAuditLog(ws.id, "Admin", "DELETE", "METER", meter.id, before, meter);
  return res.json({ deleted: true, id: meter.id });
});

// GET /meters/:id/usage
// Aggregated usage stats for a specific meter, with optional filters.
router.get("/meters/:id/usage", (req, res) => {
  const meter = db.meters.find((m) => m.id === req.params.id);
  if (!meter) return notFound(res, "Meter");

  const { customerId, from, to } = req.query as {
    customerId?: string;
    from?: string;
    to?: string;
  };

  let events = db.usageEvents.filter((e) => e.meterId === meter.id);

  if (customerId) {
    events = events.filter((e) => e.customerId === customerId);
  }
  if (from) {
    const fromMs = new Date(from).getTime();
    events = events.filter((e) => new Date(e.timestamp).getTime() >= fromMs);
  }
  if (to) {
    const toMs = new Date(to).getTime();
    events = events.filter((e) => new Date(e.timestamp).getTime() <= toMs);
  }

  const totalEvents = events.length;
  const totalValue = events.reduce((sum, e) => sum + e.value, 0);
  const averageValue = totalEvents > 0 ? totalValue / totalEvents : 0;
  const maxValue = totalEvents > 0 ? Math.max(...events.map((e) => e.value)) : 0;
  const nonZero = events.filter((e) => e.value !== 0);
  const minValue = nonZero.length > 0 ? Math.min(...nonZero.map((e) => e.value)) : 0;

  // Aggregate by customer
  const customerMap = new Map<string, { totalValue: number; eventCount: number }>();
  for (const e of events) {
    const entry = customerMap.get(e.customerId) ?? { totalValue: 0, eventCount: 0 };
    entry.totalValue += e.value;
    entry.eventCount += 1;
    customerMap.set(e.customerId, entry);
  }

  const byCustomer = Array.from(customerMap.entries()).map(([cId, stats]) => {
    const cust = db.customers.find((c) => c.id === cId);
    return {
      customerId: cId,
      customerName: cust?.name ?? cId,
      totalValue: stats.totalValue,
      eventCount: stats.eventCount,
    };
  });

  const recentEvents = [...events]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 20);

  return res.json({
    meterId: meter.id,
    meterName: meter.name,
    aggregationType: meter.aggregationType,
    totalEvents,
    totalValue,
    averageValue,
    maxValue,
    minValue,
    byCustomer,
    recentEvents,
  });
});

export default router;
