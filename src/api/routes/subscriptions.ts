// @ts-nocheck

import { Router } from "express";
import {
  resolveWorkspace,
  writeAuditLog,
  genId, addMonths, addDays, toNum,
  subscriptionRepo,
  customerRepo,
  planRepo,
} from "../db.ts";
import { asyncHandler, parsePagination, badRequest, notFound, conflict } from "../middleware.ts";
import { createSubscriptionOnGateway, cancelSubscriptionOnGateway, syncSubscriptionFromGateway } from "../services/billing-sync.ts";

export const router = Router();

router.get("/", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const customers = await customerRepo.findByWorkspace(ws.id);
  const wsCustomerIds = customers.map((c) => c.id);

  let subs = await subscriptionRepo.findByCustomerIds(wsCustomerIds);
  const { status, customerId } = req.query as Record<string, string | undefined>;
  if (status) subs = subs.filter((s) => s.status === status);
  if (customerId) subs = subs.filter((s) => s.customer_id === customerId);

  const pagination = parsePagination(req);
  const sliced = subs.slice(pagination.offset, pagination.offset + pagination.limit);
  const enriched = await Promise.all(sliced.map(async (sub) => {
    const cust = customers.find((c) => c.id === sub.customer_id);
    const plan = await planRepo.findById(null as any, sub.plan_id);
    return { ...sub, customerName: cust?.name ?? "", customerEmail: cust?.email ?? "", planName: plan?.name ?? sub.plan_id };
  }));

  res.json({
    data: enriched,
    total: subs.length,
    page: pagination.page,
    limit: pagination.limit,
    hasMore: pagination.offset + pagination.limit < subs.length,
  });
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const sub = await subscriptionRepo.findById(null as any, req.params.id);
  if (!sub) return notFound(res, "Subscription");

  const customers = await customerRepo.findByWorkspace(ws.id);
  const customer = customers.find((c) => c.id === sub.customer_id);
  if (!customer) return notFound(res, "Subscription");

  const plan = await planRepo.findById(null as any, sub.plan_id);
  res.json({ ...sub, customerName: customer.name, customerEmail: customer.email, planName: plan?.name ?? sub.plan_id });
}));

router.post("/", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const { customerId, planId, seatQuantity, trialDays, metadata } = req.body as {
    customerId?: string; planId?: string; seatQuantity?: number; trialDays?: number; metadata?: Record<string, unknown>;
  };
  if (!customerId || !planId) return badRequest(res, "Fields 'customerId' and 'planId' are required.");

  const customer = await customerRepo.findById(null as any, customerId);
  if (!customer || customer.workspace_id !== ws.id) return notFound(res, "Customer");
  const plan = await planRepo.findById(null as any, planId);
  if (!plan) return notFound(res, "Plan");

  const existing = await subscriptionRepo.findActiveByCustomer(null as any, customerId);
  if (existing) return conflict(res, "Customer already has an active subscription");

  // Create on gateway if connected, then locally
  const result = await createSubscriptionOnGateway(ws.id, customerId, planId, {
    trialDays: toNum(trialDays, 0),
    seatQuantity: toNum(seatQuantity, 1) || 1,
  });

  const newSub = result.local;

  await customerRepo.update(null as any, customerId, { planId, status: newSub.status as any });
  await writeAuditLog(ws.id, "System", "CREATE", "SUBSCRIPTION", newSub.id, null, {
    ...newSub,
    gateway_subscription_id: result.gateway?.gatewayId,
    gateway_synced: !!result.gateway,
  });

  res.status(201).json({
    ...newSub,
    gateway_synced: !!result.gateway,
    gateway_subscription_id: result.gateway?.gatewayId,
  });
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const sub = await subscriptionRepo.findById(null as any, req.params.id);
  if (!sub) return notFound(res, "Subscription");

  const customers = await customerRepo.findByWorkspace(ws.id);
  const customer = customers.find((c) => c.id === sub.customer_id);
  if (!customer) return notFound(res, "Subscription");

  const before = { ...sub };
  const { planId, seatQuantity, metadata, cancelAtPeriodEnd } = req.body;

  if (planId !== undefined && planId !== sub.plan_id) {
    sub.plan_id = planId;
    await customerRepo.update(null as any, customer.id, { planId });
    await customerRepo.addNote(null as any, customer.id, {
      id: "note_" + Date.now(), timestamp: new Date().toISOString(),
      text: `Subscription plan updated to: ${planId}`, author: "System",
    });
  }

  const updated = await subscriptionRepo.update(null as any, sub.id, {
    planId: planId !== undefined ? planId : undefined,
    seatQuantity: seatQuantity !== undefined ? toNum(seatQuantity, sub.seat_quantity) : undefined,
    metadata: metadata !== undefined ? metadata : undefined,
    cancelAtPeriodEnd: cancelAtPeriodEnd !== undefined ? cancelAtPeriodEnd : undefined,
  });

  if (!updated) return notFound(res, "Subscription");
  await writeAuditLog(ws.id, "System", "UPDATE", "SUBSCRIPTION", sub.id, before, updated);
  res.json(updated);
}));

router.post("/:id/cancel", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const sub = await subscriptionRepo.findById(null as any, req.params.id);
  if (!sub) return notFound(res, "Subscription");

  const customers = await customerRepo.findByWorkspace(ws.id);
  const customer = customers.find((c) => c.id === sub.customer_id);
  if (!customer) return notFound(res, "Subscription");

  if (sub.status !== "active" && sub.status !== "paused") {
    return conflict(res, `Cannot cancel a subscription with status '${sub.status}'.`);
  }

  const before = { ...sub };
  const { immediately = false, reason } = req.body as { immediately?: boolean; reason?: string };
  const now = new Date().toISOString();

  // Cancel on gateway if connected
  if (sub.gateway_subscription_id) {
    try {
      await cancelSubscriptionOnGateway(ws.id, sub.id, immediately);
    } catch (err) {
      console.error("Gateway cancellation failed:", err);
    }
  }

  if (immediately) {
    await subscriptionRepo.update(null as any, sub.id, { status: "canceled", canceledAt: now });
    await customerRepo.update(null as any, customer.id, { status: "canceled" });
  } else {
    await subscriptionRepo.update(null as any, sub.id, { cancelAtPeriodEnd: true });
  }

  await customerRepo.addNote(null as any, customer.id, {
    id: "note_" + Date.now(), timestamp: now,
    text: `Subscription canceled. Reason: ${reason ?? "Not provided"}`, author: "System",
  });

  await writeAuditLog(ws.id, "System", "UPDATE", "SUBSCRIPTION", sub.id, before, sub);
  const updated = await subscriptionRepo.findById(null as any, sub.id);
  res.json(updated);
}));

router.post("/:id/pause", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const sub = await subscriptionRepo.findById(null as any, req.params.id);
  if (!sub) return notFound(res, "Subscription");
  const customers = await customerRepo.findByWorkspace(ws.id);
  const customer = customers.find((c) => c.id === sub.customer_id);
  if (!customer) return notFound(res, "Subscription");
  if (sub.status !== "active") return conflict(res, `Cannot pause a subscription with status '${sub.status}'.`);

  const before = { ...sub };
  const now = new Date().toISOString();
  await subscriptionRepo.update(null as any, sub.id, { status: "paused", pausedAt: now });
  await customerRepo.update(null as any, customer.id, { status: "paused" });
  await writeAuditLog(ws.id, "System", "UPDATE", "SUBSCRIPTION", sub.id, before, { ...sub, status: "paused" });
  const updated = await subscriptionRepo.findById(null as any, sub.id);
  res.json(updated);
}));

router.post("/:id/resume", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const sub = await subscriptionRepo.findById(null as any, req.params.id);
  if (!sub) return notFound(res, "Subscription");
  const customers = await customerRepo.findByWorkspace(ws.id);
  const customer = customers.find((c) => c.id === sub.customer_id);
  if (!customer) return notFound(res, "Subscription");
  if (sub.status !== "paused") return conflict(res, `Cannot resume a subscription with status '${sub.status}'.`);

  const before = { ...sub };
  const now = new Date().toISOString();
  await subscriptionRepo.update(null as any, sub.id, {
    status: "active", pausedAt: null, currentPeriodStart: now, currentPeriodEnd: addMonths(now, 1),
  });
  await customerRepo.update(null as any, customer.id, { status: "active" });
  await writeAuditLog(ws.id, "System", "UPDATE", "SUBSCRIPTION", sub.id, before, { ...sub, status: "active" });
  const updated = await subscriptionRepo.findById(null as any, sub.id);
  res.json(updated);
}));

router.post("/:id/convert-trial", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const sub = await subscriptionRepo.findById(null as any, req.params.id);
  if (!sub) return notFound(res, "Subscription");
  const customers = await customerRepo.findByWorkspace(ws.id);
  const customer = customers.find((c) => c.id === sub.customer_id);
  if (!customer) return notFound(res, "Subscription");
  if (sub.status !== "trial") return conflict(res, "Subscription is not in trial");

  const before = { ...sub };
  const { planId } = req.body as { planId?: string };
  const now = new Date().toISOString();

  await subscriptionRepo.update(null as any, sub.id, {
    status: "active", trialEnd: now, currentPeriodStart: now, currentPeriodEnd: addMonths(now, 1),
    planId: planId !== undefined ? planId : undefined,
  });
  await customerRepo.update(null as any, customer.id, {
    status: "active",
    planId: planId !== undefined ? planId : undefined,
  });
  await customerRepo.addNote(null as any, customer.id, {
    id: "note_" + Date.now(), timestamp: now, text: "Trial successfully converted to paid subscription.", author: "System",
  });
  await writeAuditLog(ws.id, "System", "ADJUST", "SUBSCRIPTION", sub.id, before, { ...sub, status: "active" });
  const updated = await subscriptionRepo.findById(null as any, sub.id);
  res.json(updated);
}));

router.post("/:id/upgrade", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const sub = await subscriptionRepo.findById(null as any, req.params.id);
  if (!sub) return notFound(res, "Subscription");
  const customers = await customerRepo.findByWorkspace(ws.id);
  const customer = customers.find((c) => c.id === sub.customer_id);
  if (!customer) return notFound(res, "Subscription");
  const { planId } = req.body as { planId?: string };
  if (!planId) return badRequest(res, "Field 'planId' is required.");
  const newPlan = await planRepo.findById(null as any, planId);
  if (!newPlan) return notFound(res, "Plan");
  if (sub.status !== "active" && sub.status !== "trial") return conflict(res, `Cannot upgrade a subscription with status '${sub.status}'.`);

  const before = { ...sub };
  const now = new Date().toISOString();
  await subscriptionRepo.update(null as any, sub.id, { planId });
  await customerRepo.update(null as any, customer.id, { planId });
  await customerRepo.addNote(null as any, customer.id, {
    id: "note_" + Date.now(), timestamp: now, text: `Plan upgraded to: ${newPlan.name}`, author: "System",
  });
  await writeAuditLog(ws.id, "System", "UPDATE", "SUBSCRIPTION", sub.id, before, { ...sub, plan_id: planId });
  const updated = await subscriptionRepo.findById(null as any, sub.id);
  res.json(updated);
}));

router.post("/:id/downgrade", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const sub = await subscriptionRepo.findById(null as any, req.params.id);
  if (!sub) return notFound(res, "Subscription");
  const customers = await customerRepo.findByWorkspace(ws.id);
  const customer = customers.find((c) => c.id === sub.customer_id);
  if (!customer) return notFound(res, "Subscription");
  const { planId } = req.body as { planId?: string };
  if (!planId) return badRequest(res, "Field 'planId' is required.");
  const newPlan = await planRepo.findById(null as any, planId);
  if (!newPlan) return notFound(res, "Plan");
  if (sub.status !== "active" && sub.status !== "trial") return conflict(res, `Cannot downgrade a subscription with status '${sub.status}'.`);

  const before = { ...sub };
  const now = new Date().toISOString();
  await subscriptionRepo.update(null as any, sub.id, { planId });
  await customerRepo.update(null as any, customer.id, { planId });
  await customerRepo.addNote(null as any, customer.id, {
    id: "note_" + Date.now(), timestamp: now, text: `Plan downgraded to: ${newPlan.name}`, author: "System",
  });
  await writeAuditLog(ws.id, "System", "UPDATE", "SUBSCRIPTION", sub.id, before, { ...sub, plan_id: planId });
  const updated = await subscriptionRepo.findById(null as any, sub.id);
  res.json(updated);
}));

router.post("/:id/sync-gateway", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const sub = await subscriptionRepo.findById(null as any, req.params.id);
  if (!sub) return notFound(res, "Subscription");

  const customers = await customerRepo.findByWorkspace(ws.id);
  const customer = customers.find((c) => c.id === sub.customer_id);
  if (!customer) return notFound(res, "Subscription");

  const result = await syncSubscriptionFromGateway(ws.id, sub.id);
  await writeAuditLog(ws.id, "System", "ACCESS_VERIFY", "SUBSCRIPTION", sub.id, null, { synced: !!result });
  res.json({ synced: !!result, subscription: result });
}));

export default router;
