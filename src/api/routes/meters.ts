import { Router } from "express";
import {
  resolveWorkspace,
  writeAuditLog,
  genId,
  meterRepo,
  customerRepo,
  query,
} from "../db.ts";
import { asyncHandler, badRequest, notFound } from "../middleware.ts";

export const router = Router();

router.get("/meters", asyncHandler(async (req, res) => {
  const showArchived = req.query.archived !== "false";
  const meters = await meterRepo.findAll(showArchived);
  res.json(meters);
}));

router.get("/meters/:id", asyncHandler(async (req, res) => {
  const meter = await meterRepo.findById(null as any, req.params.id);
  if (!meter) return notFound(res, "Meter");
  res.json(meter);
}));

router.post("/meters", asyncHandler(async (req, res) => {
  const { name, description, aggregationType, targetField, slug, unit } = req.body as {
    name?: string; description?: string; aggregationType?: string; targetField?: string; slug?: string; unit?: string;
  };
  if (!name?.trim()) return badRequest(res, "name is required.");
  if (!aggregationType?.trim()) return badRequest(res, "aggregationType is required.");
  if (!targetField?.trim()) return badRequest(res, "targetField is required.");

  const id = name.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_meter";
  const existing = await meterRepo.findById(null as any, id);
  if (existing) {
    return res.status(409).json({ error: `Meter with id '${id}' already exists.`, code: "CONFLICT" });
  }

  const meter = await meterRepo.create(null as any, {
    id,
    name: name.trim(),
    description,
    aggregationType: aggregationType as any,
    targetField: targetField.trim(),
    slug: slug ?? id,
    unit,
  });

  const ws = await resolveWorkspace(req);
  await writeAuditLog(ws.id, "Admin", "CREATE", "METER", meter.id, null, meter);
  res.status(201).json(meter);
}));

router.put("/meters/:id", asyncHandler(async (req, res) => {
  const meter = await meterRepo.findById(null as any, req.params.id);
  if (!meter) return notFound(res, "Meter");

  const { name, description, aggregationType, targetField, unit, status } = req.body;
  const before = { ...meter };
  const updated = await meterRepo.update(null as any, meter.id, {
    name, description, aggregationType, targetField, unit, status,
  });
  if (!updated) return notFound(res, "Meter");

  const ws = await resolveWorkspace(req);
  await writeAuditLog(ws.id, "Admin", "UPDATE", "METER", meter.id, before, updated);
  res.json(updated);
}));

router.delete("/meters/:id", asyncHandler(async (req, res) => {
  const meter = await meterRepo.findById(null as any, req.params.id);
  if (!meter) return notFound(res, "Meter");
  const before = { ...meter };
  await meterRepo.softDelete(null as any, meter.id);

  const ws = await resolveWorkspace(req);
  await writeAuditLog(ws.id, "Admin", "DELETE", "METER", meter.id, before, { ...meter, status: "archived" });
  res.json({ deleted: true, id: meter.id });
}));

router.get("/meters/:id/usage", asyncHandler(async (req, res) => {
  const meter = await meterRepo.findById(null as any, req.params.id);
  if (!meter) return notFound(res, "Meter");

  const { customerId, from, to } = req.query as { customerId?: string; from?: string; to?: string };
  const conditions: string[] = ["meter_id = $1"];
  const params: any[] = [meter.id];
  let idx = 2;

  if (customerId) { conditions.push(`customer_id = $${idx++}`); params.push(customerId); }
  if (from) { conditions.push(`timestamp >= $${idx++}`); params.push(from); }
  if (to) { conditions.push(`timestamp <= $${idx++}`); params.push(to); }

  const { rows: events } = await query(
    `SELECT id, customer_id, meter_id, timestamp, value, metadata FROM usage_events WHERE ${conditions.join(" AND ")} ORDER BY timestamp DESC`,
    params,
  );

  const totalEvents = events.length;
  const totalValue = events.reduce((sum: number, e: any) => sum + Number(e.value), 0);
  const averageValue = totalEvents > 0 ? totalValue / totalEvents : 0;
  const maxValue = totalEvents > 0 ? Math.max(...events.map((e: any) => Number(e.value))) : 0;
  const nonZero = events.filter((e: any) => Number(e.value) !== 0);
  const minValue = nonZero.length > 0 ? Math.min(...nonZero.map((e: any) => Number(e.value))) : 0;

  const customerMap = new Map<string, { totalValue: number; eventCount: number }>();
  for (const e of events) {
    const entry = customerMap.get(e.customer_id) ?? { totalValue: 0, eventCount: 0 };
    entry.totalValue += Number(e.value);
    entry.eventCount += 1;
    customerMap.set(e.customer_id, entry);
  }

  const byCustomer = await Promise.all(Array.from(customerMap.entries()).map(async ([cId, stats]) => {
    const cust = await customerRepo.findById(null as any, cId);
    return { customerId: cId, customerName: cust?.name ?? cId, totalValue: stats.totalValue, eventCount: stats.eventCount };
  }));

  const recentEvents = events.slice(0, 20);

  res.json({
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
}));

export default router;
