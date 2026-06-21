// @ts-nocheck
import { Router } from "express";
import {
  resolveWorkspace,
  writeAuditLog,
  genId,
  toNum,
  query,
  usageRepo,
  meterRepo,
  quotaRepo,
  creditRepo,
  customerRepo,
  planRepo,
} from "../db.ts";
import { asyncHandler, parsePagination, badRequest, notFound, conflict } from "../middleware.ts";

export const router = Router();

router.get("/usage", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const customers = await customerRepo.findByWorkspace(ws.id);
  const customerIds = customers.map((c) => c.id);

  if (customerIds.length === 0) {
    return res.json({ data: [], total: 0, page: 1, limit: 50, hasMore: false });
  }

  const { meterId, customerId, from, to } = req.query as Record<string, string | undefined>;

  const conditions = [`customer_id = ANY($1)`];
  const params: any[] = [customerIds];
  let idx = 2;

  if (meterId) { conditions.push(`meter_id = $${idx++}`); params.push(meterId); }
  if (customerId) { conditions.push(`customer_id = $${idx++}`); params.push(customerId); }
  if (from) { conditions.push(`timestamp >= $${idx++}`); params.push(from); }
  if (to) { conditions.push(`timestamp <= $${idx++}`); params.push(to); }

  const { rows: events } = await query(
    `SELECT id, customer_id, meter_id, timestamp, value, metadata FROM usage_events WHERE ${conditions.join(" AND ")} ORDER BY timestamp DESC`,
    params,
  );

  const pagination = parsePagination(req);
  const sliced = events.slice(pagination.offset, pagination.offset + pagination.limit);
  res.json({
    data: sliced,
    total: events.length,
    page: pagination.page,
    limit: pagination.limit,
    hasMore: pagination.offset + pagination.limit < events.length,
  });
}));

router.post("/usage/ingest", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const { customerId, meterId, value, metadata, timestamp: eventTimestamp } = req.body as {
    customerId?: string; meterId?: string; value?: number; metadata?: Record<string, unknown>; timestamp?: string;
  };

  if (!customerId) return badRequest(res, "customerId is required");
  if (!meterId) return badRequest(res, "meterId is required");
  if (value === undefined || value === null) return badRequest(res, "value is required");

  const customer = await customerRepo.findById(null as any, customerId);
  if (!customer || customer.workspace_id !== ws.id) return notFound(res, "Customer");
  const meter = await meterRepo.findById(null as any, meterId);
  if (!meter) return notFound(res, "Meter");

  const now = new Date().toISOString();
  const event = await usageRepo.report(null as any, {
    customerId,
    meterId,
    value: toNum(value, 0),
    timestamp: eventTimestamp ?? now,
    metadata,
  });

  await customerRepo.update(null as any, customerId, {
    usageUnits: (customer.usage_units ?? 0) + 1,
  });

  if (meter.aggregation_type === "sum" || meter.aggregation_type === "count") {
    const period = now.slice(0, 7);
    await query(
      `UPSERT INTO usage_aggregates (customer_id, meter_id, period, value)
       VALUES ($1, $2, $3, (
         SELECT COALESCE(SUM(value), 0) FROM usage_events
         WHERE customer_id = $1 AND meter_id = $2 AND timestamp >= $4 AND timestamp < $5
       ))`,
      [customerId, meterId, period, period + "-01", new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()],
    );
  }

  await writeAuditLog(ws.id, "System", "INGEST", "USAGE", event.id, null, {
    customerId, meterId, value, timestamp: event.timestamp,
  });
  res.status(201).json(event);
}));

router.post("/usage/bulk-ingest", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const { events } = req.body as { events?: Array<{customerId: string; meterId: string; value: number; timestamp?: string; metadata?: Record<string, unknown>}> };
  if (!events || !Array.isArray(events) || events.length === 0) {
    return badRequest(res, "events array is required with at least one event");
  }

  const results: Array<{customerId: string; meterId: string; status: string; error?: string}> = [];
  for (const evt of events) {
    try {
      const customer = await customerRepo.findById(null as any, evt.customerId);
      if (!customer || customer.workspace_id !== ws.id) {
        results.push({ customerId: evt.customerId, meterId: evt.meterId, status: "error", error: "Customer not found" });
        continue;
      }
      const meter = await meterRepo.findById(null as any, evt.meterId);
      if (!meter) {
        results.push({ customerId: evt.customerId, meterId: evt.meterId, status: "error", error: "Meter not found" });
        continue;
      }
      const now = new Date().toISOString();
      await usageRepo.report(null as any, {
        customerId: evt.customerId,
        meterId: evt.meterId,
        value: toNum(evt.value, 0),
        timestamp: evt.timestamp ?? now,
        metadata: evt.metadata,
      });
      results.push({ customerId: evt.customerId, meterId: evt.meterId, status: "success" });
    } catch (err: any) {
      results.push({ customerId: evt.customerId, meterId: evt.meterId, status: "error", error: err.message });
    }
  }

  res.status(201).json({ ingested: results.filter((r) => r.status === "success").length, failed: results.filter((r) => r.status === "error").length, results });
}));

router.get("/usage/aggregates", asyncHandler(async (req, res) => {
  const { customerId, meterId, from, to } = req.query as Record<string, string | undefined>;

  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (customerId) { conditions.push(`customer_id = $${idx++}`); params.push(customerId); }
  if (meterId) { conditions.push(`meter_id = $${idx++}`); params.push(meterId); }
  if (from) { conditions.push(`period >= $${idx++}`); params.push(from.slice(0, 7)); }
  if (to) { conditions.push(`period <= $${idx++}`); params.push(to.slice(0, 7)); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await query(`SELECT customer_id, meter_id, period, value FROM usage_aggregates ${where} ORDER BY period DESC`, params);
  res.json(rows.map((r: any) => ({ ...r, value: Number(r.value) })));
}));

router.get("/usage/quotas", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const customers = await customerRepo.findByWorkspace(ws.id);
  const customerIds = customers.map((c) => c.id);

  if (customerIds.length === 0) return res.json([]);

  const quotas = await quotaRepo.findByCustomerIds(customerIds);
  const enriched = await Promise.all(quotas.map(async (q) => {
    const cust = customers.find((c) => c.id === q.customerId);
    const usage = await usageRepo.getAggregate(null as any, q.customerId, q.meterId);
    const remaining = q.limit - usage;
    return { ...q, customerName: cust?.name ?? q.customerId, usage, remaining, exceeded: remaining < 0 };
  }));

  res.json(enriched);
}));

router.get("/usage/quotas/:customerId", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const customer = await customerRepo.findById(null as any, req.params.customerId);
  if (!customer || customer.workspace_id !== ws.id) return notFound(res, "Customer");

  const quotas = await quotaRepo.findByCustomerIds([customer.id]);
  const enriched = await Promise.all(quotas.map(async (q) => {
    const usage = await usageRepo.getAggregate(null as any, q.customerId, q.meterId);
    const remaining = q.limit - usage;
    return { ...q, usage, remaining, exceeded: remaining < 0 };
  }));
  res.json(enriched);
}));

router.post("/usage/quotas", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const { customerId, meterId, limit, period } = req.body as {
    customerId?: string; meterId?: string; limit?: number; period?: string;
  };
  if (!customerId || !meterId || limit === undefined) return badRequest(res, "customerId, meterId, and limit are required");

  const customer = await customerRepo.findById(null as any, customerId);
  if (!customer || customer.workspace_id !== ws.id) return notFound(res, "Customer");
  const meter = await meterRepo.findById(null as any, meterId);
  if (!meter) return notFound(res, "Meter");

  const quota = await quotaRepo.setQuota(null as any, {
    customerId,
    meterId,
    limit: toNum(limit, 0),
    period: (period ?? "monthly") as any,
  });

  await writeAuditLog(ws.id, "System", "CREATE", "QUOTA", `${customerId}:${meterId}`, null, quota);
  res.status(201).json(quota);
}));

router.put("/usage/quotas/:customerId/:meterId", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const { customerId, meterId } = req.params;
  const customer = await customerRepo.findById(null as any, customerId);
  if (!customer || customer.workspace_id !== ws.id) return notFound(res, "Customer");

  const { limit, period } = req.body as { limit?: number; period?: string };
  if (limit === undefined) return badRequest(res, "limit is required");

  const updated = await quotaRepo.setQuota(null as any, {
    customerId, meterId,
    limit: toNum(limit, 0),
    period: (period ?? "monthly") as any,
  });

  await writeAuditLog(ws.id, "System", "UPDATE", "QUOTA", `${customerId}:${meterId}`, null, updated);
  res.json(updated);
}));

router.delete("/usage/quotas/:customerId/:meterId", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const { customerId, meterId } = req.params;
  const customer = await customerRepo.findById(null as any, customerId);
  if (!customer || customer.workspace_id !== ws.id) return notFound(res, "Customer");
  await quotaRepo.remove(null as any, customerId, meterId);
  await writeAuditLog(ws.id, "System", "DELETE", "QUOTA", `${customerId}:${meterId}`, null, null);
  res.json({ deleted: true });
}));

router.get("/usage/credits", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const customers = await customerRepo.findByWorkspace(ws.id);
  const customerIds = customers.map((c) => c.id);

  const allEntries: any[] = [];
  for (const cId of customerIds) {
    const entries = await creditRepo.findByCustomerIds([cId], cId);
    const balance = await creditRepo.getBalance(cId);
    allEntries.push(...entries.map((e: any) => ({ ...e, balance })));
  }
  res.json(allEntries);
}));

router.get("/usage/credits/:customerId", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const customer = await customerRepo.findById(null as any, req.params.customerId);
  if (!customer || customer.workspace_id !== ws.id) return notFound(res, "Customer");

  const entries = await creditRepo.findByCustomerIds([customer.id], customer.id);
  const balance = await creditRepo.getBalance(customer.id);
  res.json({ customerId: customer.id, customerName: customer.name, balance, entries });
}));

router.post("/usage/credits/grant", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const { customerId, amount, reason, expiresAt } = req.body as {
    customerId?: string; amount?: number; reason?: string; expiresAt?: string;
  };
  if (!customerId || amount === undefined || amount <= 0) return badRequest(res, "customerId and amount (positive) are required");

  const customer = await customerRepo.findById(null as any, customerId);
  if (!customer || customer.workspace_id !== ws.id) return notFound(res, "Customer");

  const entry = await creditRepo.grant(null as any, {
    customerId,
    amount: toNum(amount, 0),
    reason: reason ?? "Manual grant",
    expiresAt,
  });

  await writeAuditLog(ws.id, "System", "GRANT", "CREDIT", customerId, null, entry);
  res.status(201).json(entry);
}));

router.post("/usage/credits/deduct", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const { customerId, amount, reason, metadata } = req.body as {
    customerId?: string; amount?: number; reason?: string; metadata?: Record<string, unknown>;
  };
  if (!customerId || amount === undefined || amount <= 0) return badRequest(res, "customerId and amount (positive) are required");

  const customer = await customerRepo.findById(null as any, customerId);
  if (!customer || customer.workspace_id !== ws.id) return notFound(res, "Customer");

  const balance = await creditRepo.getBalance(customerId);
  if (balance < amount) return conflict(res, `Insufficient credit balance: ${balance} < ${amount}`);

  const entry = await creditRepo.deduct(null as any, {
    customerId,
    amount: toNum(amount, 0),
    reason: reason ?? "Usage deduction",
    metadata,
  });

  await writeAuditLog(ws.id, "System", "DEDUCT", "CREDIT", customerId, null, entry);
  res.status(201).json(entry);
}));

router.get("/usage/credits/:customerId/balance", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const customer = await customerRepo.findById(null as any, req.params.customerId);
  if (!customer || customer.workspace_id !== ws.id) return notFound(res, "Customer");
  const balance = await creditRepo.getBalance(customer.id);
  res.json({ customerId: customer.id, customerName: customer.name, balance });
}));

export default router;
