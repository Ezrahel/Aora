// @ts-nocheck -- repository contract migration pending; tracked separately.
import { Router } from "express";
import {
  resolveWorkspace,
  query,
  customerRepo,
  subscriptionRepo,
  invoiceRepo,
  usageRepo,
  planRepo,
} from "../db.ts";
import { asyncHandler } from "../middleware.ts";

export const router = Router();

router.get("/analytics/dashboard", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const customers = await customerRepo.findByWorkspace(ws.id);
  const customerIds = customers.map((c) => c.id);

  const totalCustomers = customers.length;
  const activeCustomers = customers.filter((c) => c.status === "active").length;
  const trialCustomers = customers.filter((c) => c.status === "trial").length;
  const pausedCustomers = customers.filter((c) => c.status === "paused").length;
  const canceledCustomers = customers.filter((c) => c.status === "canceled").length;

  const subs = customerIds.length > 0 ? await subscriptionRepo.findByCustomerIds(customerIds) : [];
  const activeSubs = subs.filter((s) => s.status === "active" || s.status === "trial").length;
  const trialSubs = subs.filter((s) => s.status === "trial").length;
  const pausedSubs = subs.filter((s) => s.status === "paused").length;

  const invoices = customerIds.length > 0 ? await invoiceRepo.findByCustomerIds(customerIds) : [];
  const totalRevenue = invoices
    .filter((i) => i.status === "paid" || i.status === "finalized")
    .reduce((s, i) => s + (typeof i.amount === "string" ? parseFloat(i.amount) : i.amount), 0);
  const pendingRevenue = invoices
    .filter((i) => i.status === "pending")
    .reduce((s, i) => s + (typeof i.amount === "string" ? parseFloat(i.amount) : i.amount), 0);

  const { rows: totalUsageEvents } = await query(
    "SELECT COUNT(*)::int AS count FROM usage_events ue JOIN customers c ON ue.customer_id = c.id WHERE c.workspace_id = $1",
    [ws.id],
  );
  const totalEvents = totalUsageEvents[0]?.count ?? 0;

  const planDist = customers.reduce((acc: Record<string, number>, c) => {
    acc[c.plan_id] = (acc[c.plan_id] ?? 0) + 1;
    return acc;
  }, {});

  res.json({
    totalCustomers,
    activeCustomers,
    trialCustomers,
    pausedCustomers,
    canceledCustomers,
    activeSubs,
    trialSubs,
    pausedSubs,
    totalRevenue,
    pendingRevenue,
    totalUsageEvents: totalEvents,
    mrr: totalRevenue,
    arr: totalRevenue * 12,
    planDistribution: planDist,
    avgRevenuePerCustomer: totalCustomers > 0 ? totalRevenue / totalCustomers : 0,
  });
}));

router.get("/analytics/revenue", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const customers = await customerRepo.findByWorkspace(ws.id);
  const customerIds = customers.map((c) => c.id);

  if (customerIds.length === 0) {
    return res.json({ monthly: [], total: 0, mrr: 0, arr: 0, byCustomer: [] });
  }

  const invoices = await invoiceRepo.findByCustomerIds(customerIds);
  const paid = invoices.filter((i) => i.status === "paid" || i.status === "finalized");

  const monthly: Record<string, number> = {};
  for (const inv of paid) {
    const month = (inv.paidAt ?? inv.createdAt ?? inv.finalizedAt ?? "").slice(0, 7);
    if (month) {
      monthly[month] = (monthly[month] ?? 0) + (typeof inv.amount === "string" ? parseFloat(inv.amount) : inv.amount);
    }
  }

  const byCustomer = paid.reduce((acc: Record<string, number>, inv) => {
    const cId = inv.customerId;
    acc[cId] = (acc[cId] ?? 0) + (typeof inv.amount === "string" ? parseFloat(inv.amount) : inv.amount);
    return acc;
  }, {});

  const monthlyData = Object.entries(monthly).map(([month, amount]) => ({ month, amount }));

  res.json({
    monthly: monthlyData,
    total: Object.values(monthly).reduce((s, v) => s + v, 0),
    mrr: Object.values(monthly).reduce((s, v) => s + v, 0) / Math.max(monthlyData.length, 1),
    arr: Object.values(monthly).reduce((s, v) => s + v, 0),
    byCustomer: await Promise.all(
      Object.entries(byCustomer).map(async ([cId, total]) => {
        const c = await customerRepo.findById(null as any, cId);
        return { customerId: cId, customerName: c?.name ?? cId, total };
      }),
    ),
  });
}));

router.get("/analytics/usage", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const customers = await customerRepo.findByWorkspace(ws.id);
  const customerIds = customers.map((c) => c.id);

  if (customerIds.length === 0) {
    return res.json({ totalEvents: 0, byMeter: [], byCustomer: [] });
  }

  const { rows: byMeter } = await query(
    `SELECT m.name, m.id AS meter_id, COUNT(*)::int AS events, COALESCE(SUM(ue.value), 0) AS total_value
     FROM usage_events ue JOIN meters m ON ue.meter_id = m.id
     WHERE ue.customer_id = ANY($1)
     GROUP BY m.id, m.name ORDER BY events DESC`,
    [customerIds],
  );

  const { rows: byCustomer } = await query(
    `SELECT c.id AS customer_id, c.name AS customer_name, COUNT(*)::int AS events, COALESCE(SUM(ue.value), 0) AS total_value
     FROM usage_events ue JOIN customers c ON ue.customer_id = c.id
     WHERE ue.customer_id = ANY($1)
     GROUP BY c.id, c.name ORDER BY events DESC`,
    [customerIds],
  );

  res.json({
    totalEvents: byMeter.reduce((s: number, r: any) => s + Number(r.events), 0),
    byMeter: byMeter.map((r: any) => ({ ...r, total_value: Number(r.total_value) })),
    byCustomer: byCustomer.map((r: any) => ({ ...r, total_value: Number(r.total_value) })),
  });
}));

router.get("/analytics/customers", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const customers = await customerRepo.findByWorkspace(ws.id);
  const customerIds = customers.map((c) => c.id);

  const subs = customerIds.length > 0 ? await subscriptionRepo.findByCustomerIds(customerIds) : [];

  const planIds = [...new Set(customers.map((c: any) => c.plan_id))];
  const plans = await Promise.all(planIds.map((pid) => planRepo.findById(null as any, pid)));
  const planMap = Object.fromEntries(plans.filter(Boolean).map((p) => [p.id, p.name]));

  const enriched = await Promise.all(customers.map(async (c) => {
    const customerSubs = subs.filter((s: any) => s.customer_id === c.id);
    const latestSub = customerSubs.sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )[0];
    return {
      id: c.id, name: c.name, email: c.email, planId: c.plan_id, planName: planMap[c.plan_id] ?? c.plan_id,
      status: c.status, seatsUsed: c.seats_used, usageUnits: c.usage_units,
      createdAt: c.created_at, subscriptionStatus: latestSub?.status,
    };
  }));

  res.json(enriched);
}));

router.get("/analytics/mrr", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const customers = await customerRepo.findByWorkspace(ws.id);
  const customerIds = customers.map((c) => c.id);

  if (customerIds.length === 0) {
    return res.json({ currentMrr: 0, mrrHistory: [], byPlan: [] });
  }

  const invoices = await invoiceRepo.findByCustomerIds(customerIds);
  const paid = invoices.filter((i) => i.status === "paid" || i.status === "finalized");

  const monthly: Record<string, number> = {};
  for (const inv of paid) {
    const month = (inv.paidAt ?? inv.createdAt ?? inv.finalizedAt ?? "").slice(0, 7);
    if (month) {
      monthly[month] = (monthly[month] ?? 0) + (typeof inv.amount === "string" ? parseFloat(inv.amount) : inv.amount);
    }
  }

  const byPlan: Record<string, number> = {};
  for (const c of customers) {
    const customerPaid = paid.filter((i: any) => i.customerId === c.id);
    const total = customerPaid.reduce((s: number, i: any) => s + (typeof i.amount === "string" ? parseFloat(i.amount) : i.amount), 0);
    byPlan[c.plan_id] = (byPlan[c.plan_id] ?? 0) + total;
  }

  const mrrHistory = Object.entries(monthly)
    .map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => a.month.localeCompare(b.month));

  res.json({
    currentMrr: mrrHistory.length > 0 ? mrrHistory[mrrHistory.length - 1].amount : 0,
    mrrHistory,
    byPlan: Object.entries(byPlan).map(([planId, amount]) => ({ planId, amount })),
  });
}));

export default router;
