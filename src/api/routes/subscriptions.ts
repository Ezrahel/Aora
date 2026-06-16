// ============================================================
// Aora Billing OS — Subscriptions Route
// Full subscription lifecycle: create, update, cancel, pause,
// resume, trial conversion, upgrade, and downgrade.
// State machine enforced with 409 on invalid transitions.
// ============================================================

import { Router } from "express";
import { db, saveDatabase, writeAuditLog, resolveWorkspace, nanoid } from "../db.ts";
import {
  parsePagination, paginateArray, badRequest, notFound, conflict,
  genId, addMonths, addDays, toNum,
} from "../middleware.ts";
import type { Customer, Subscription, Invoice } from "../types.ts";

export const router = Router();

// ── GET /subscriptions ─────────────────────────────────────────
router.get("/", (req, res) => {
  const ws = resolveWorkspace(req);
  const wsCustomerIds = db.customers
    .filter((c) => c.workspaceId === ws.id && !c.isDeleted)
    .map((c) => c.id);

  let subs = db.subscriptions.filter((s) => wsCustomerIds.includes(s.customerId));

  const { status, customerId } = req.query as Record<string, string | undefined>;
  if (status) subs = subs.filter((s) => s.status === status);
  if (customerId) subs = subs.filter((s) => s.customerId === customerId);

  const pagination = parsePagination(req);
  return res.json(paginateArray(subs, pagination));
});

// ── GET /subscriptions/:id ─────────────────────────────────────
router.get("/:id", (req, res) => {
  const ws = resolveWorkspace(req);
  const sub = db.subscriptions.find((s) => s.id === req.params.id);
  if (!sub) return notFound(res, "Subscription");

  const customer = db.customers.find(
    (c) => c.id === sub.customerId && c.workspaceId === ws.id && !c.isDeleted,
  );
  if (!customer) return notFound(res, "Subscription");

  const plan = db.plans.find((p) => p.id === sub.planId);

  return res.json({
    ...sub,
    customerName: customer.name,
    customerEmail: customer.email,
    planName: plan?.name ?? sub.planId,
  });
});

// ── POST /subscriptions ────────────────────────────────────────
router.post("/", (req, res) => {
  const ws = resolveWorkspace(req);
  const { customerId, planId, seatQuantity, trialDays, metadata } = req.body as {
    customerId?: string;
    planId?: string;
    seatQuantity?: number;
    trialDays?: number;
    metadata?: Record<string, unknown>;
  };

  if (!customerId || !planId) {
    return badRequest(res, "Fields 'customerId' and 'planId' are required.");
  }

  const customer = db.customers.find(
    (c) => c.id === customerId && c.workspaceId === ws.id && !c.isDeleted,
  );
  if (!customer) return notFound(res, "Customer");

  const plan = db.plans.find((p) => p.id === planId);
  if (!plan) return notFound(res, "Plan");

  const existing = db.subscriptions.find(
    (s) =>
      s.customerId === customerId &&
      (s.status === "active" || s.status === "trial"),
  );
  if (existing) return conflict(res, "Customer already has an active subscription");

  const now = new Date().toISOString();
  const trialDaysNum = toNum(trialDays, 0);

  const newSub: Subscription = {
    id: "sub_" + genId(),
    customerId,
    planId,
    status: trialDaysNum > 0 ? "trial" : "active",
    currentPeriodStart: now,
    currentPeriodEnd: addMonths(now, 1),
    ...(trialDaysNum > 0 && { trialEnd: addDays(now, trialDaysNum) }),
    seatQuantity: toNum(seatQuantity, 1) || 1,
    metadata,
    createdAt: now,
  };

  db.subscriptions.push(newSub);

  // Keep customer in sync
  customer.planId = planId;
  customer.status = newSub.status;

  saveDatabase();
  writeAuditLog(ws.id, "System", "CREATE", "SUBSCRIPTION", newSub.id, null, newSub);

  return res.status(201).json(newSub);
});

// ── PUT /subscriptions/:id ─────────────────────────────────────
router.put("/:id", (req, res) => {
  const ws = resolveWorkspace(req);
  const sub = db.subscriptions.find((s) => s.id === req.params.id);
  if (!sub) return notFound(res, "Subscription");

  const customer = db.customers.find(
    (c) => c.id === sub.customerId && c.workspaceId === ws.id && !c.isDeleted,
  );
  if (!customer) return notFound(res, "Subscription");

  const before = { ...sub };
  const { planId, seatQuantity, metadata, cancelAtPeriodEnd } = req.body as {
    planId?: string;
    seatQuantity?: number;
    metadata?: Record<string, unknown>;
    cancelAtPeriodEnd?: boolean;
  };

  if (planId !== undefined && planId !== sub.planId) {
    sub.planId = planId;
    customer.planId = planId;
    customer.notes.push({
      id: "note_" + Date.now(),
      timestamp: new Date().toISOString(),
      text: `Subscription plan updated to: ${planId}`,
      author: "System",
    });
  }
  if (seatQuantity !== undefined) sub.seatQuantity = toNum(seatQuantity, sub.seatQuantity);
  if (metadata !== undefined) sub.metadata = metadata;
  if (cancelAtPeriodEnd !== undefined) sub.cancelAtPeriodEnd = cancelAtPeriodEnd;
  sub.updatedAt = new Date().toISOString();

  saveDatabase();
  writeAuditLog(ws.id, "System", "UPDATE", "SUBSCRIPTION", sub.id, before, sub);
  return res.json(sub);
});

// ── POST /subscriptions/:id/cancel ────────────────────────────
// Allowed from: active, paused
router.post("/:id/cancel", (req, res) => {
  const ws = resolveWorkspace(req);
  const sub = db.subscriptions.find((s) => s.id === req.params.id);
  if (!sub) return notFound(res, "Subscription");

  const customer = db.customers.find(
    (c) => c.id === sub.customerId && c.workspaceId === ws.id && !c.isDeleted,
  );
  if (!customer) return notFound(res, "Subscription");

  if (sub.status !== "active" && sub.status !== "paused") {
    return conflict(res, `Cannot cancel a subscription with status '${sub.status}'.`);
  }

  const before = { ...sub };
  const { immediately = false, reason } = req.body as {
    immediately?: boolean;
    reason?: string;
  };
  const now = new Date().toISOString();

  if (immediately) {
    sub.status = "canceled";
    sub.canceledAt = now;
    customer.status = "canceled";
  } else {
    sub.cancelAtPeriodEnd = true;
  }

  customer.notes.push({
    id: "note_" + Date.now(),
    timestamp: now,
    text: `Subscription canceled. Reason: ${reason ?? "Not provided"}`,
    author: "System",
  });

  saveDatabase();
  writeAuditLog(ws.id, "System", "UPDATE", "SUBSCRIPTION", sub.id, before, sub);
  return res.json(sub);
});

// ── POST /subscriptions/:id/pause ─────────────────────────────
// Allowed from: active
router.post("/:id/pause", (req, res) => {
  const ws = resolveWorkspace(req);
  const sub = db.subscriptions.find((s) => s.id === req.params.id);
  if (!sub) return notFound(res, "Subscription");

  const customer = db.customers.find(
    (c) => c.id === sub.customerId && c.workspaceId === ws.id && !c.isDeleted,
  );
  if (!customer) return notFound(res, "Subscription");

  if (sub.status !== "active") {
    return conflict(res, `Cannot pause a subscription with status '${sub.status}'.`);
  }

  const before = { ...sub };
  const now = new Date().toISOString();
  sub.status = "paused";
  sub.pausedAt = now;
  customer.status = "paused";

  saveDatabase();
  writeAuditLog(ws.id, "System", "UPDATE", "SUBSCRIPTION", sub.id, before, sub);
  return res.json(sub);
});

// ── POST /subscriptions/:id/resume ────────────────────────────
// Allowed from: paused
router.post("/:id/resume", (req, res) => {
  const ws = resolveWorkspace(req);
  const sub = db.subscriptions.find((s) => s.id === req.params.id);
  if (!sub) return notFound(res, "Subscription");

  const customer = db.customers.find(
    (c) => c.id === sub.customerId && c.workspaceId === ws.id && !c.isDeleted,
  );
  if (!customer) return notFound(res, "Subscription");

  if (sub.status !== "paused") {
    return conflict(res, `Cannot resume a subscription with status '${sub.status}'.`);
  }

  const before = { ...sub };
  const now = new Date().toISOString();
  sub.status = "active";
  sub.pausedAt = undefined;
  sub.currentPeriodStart = now;
  sub.currentPeriodEnd = addMonths(now, 1);
  customer.status = "active";

  saveDatabase();
  writeAuditLog(ws.id, "System", "UPDATE", "SUBSCRIPTION", sub.id, before, sub);
  return res.json(sub);
});

// ── POST /subscriptions/:id/convert-trial ─────────────────────
// Allowed from: trial
router.post("/:id/convert-trial", (req, res) => {
  const ws = resolveWorkspace(req);
  const sub = db.subscriptions.find((s) => s.id === req.params.id);
  if (!sub) return notFound(res, "Subscription");

  const customer = db.customers.find(
    (c) => c.id === sub.customerId && c.workspaceId === ws.id && !c.isDeleted,
  );
  if (!customer) return notFound(res, "Subscription");

  if (sub.status !== "trial") {
    return conflict(res, "Subscription is not in trial");
  }

  const before = { ...sub };
  const { planId } = req.body as { planId?: string };
  const now = new Date().toISOString();

  sub.status = "active";
  sub.trialEnd = now;
  sub.currentPeriodStart = now;
  sub.currentPeriodEnd = addMonths(now, 1);

  if (planId !== undefined) {
    sub.planId = planId;
    customer.planId = planId;
  }

  customer.status = "active";
  customer.notes.push({
    id: "note_" + Date.now(),
    timestamp: now,
    text: "Trial successfully converted to paid subscription.",
    author: "System",
  });

  saveDatabase();
  writeAuditLog(ws.id, "System", "ADJUST", "SUBSCRIPTION", sub.id, before, sub);
  return res.json(sub);
});

// ── POST /subscriptions/:id/upgrade ───────────────────────────
// Allowed from: active, trial
router.post("/:id/upgrade", (req, res) => {
  const ws = resolveWorkspace(req);
  const sub = db.subscriptions.find((s) => s.id === req.params.id);
  if (!sub) return notFound(res, "Subscription");

  const customer = db.customers.find(
    (c) => c.id === sub.customerId && c.workspaceId === ws.id && !c.isDeleted,
  );
  if (!customer) return notFound(res, "Subscription");

  const { planId } = req.body as { planId?: string };
  if (!planId) return badRequest(res, "Field 'planId' is required.");

  const newPlan = db.plans.find((p) => p.id === planId);
  if (!newPlan) return notFound(res, "Plan");

  if (sub.status !== "active" && sub.status !== "trial") {
    return conflict(res, `Cannot upgrade a subscription with status '${sub.status}'.`);
  }

  const before = { ...sub };
  const now = new Date().toISOString();
  sub.planId = planId;
  sub.updatedAt = now;
  customer.planId = planId;
  customer.notes.push({
    id: "note_" + Date.now(),
    timestamp: now,
    text: `Plan upgraded to: ${newPlan.name}`,
    author: "System",
  });

  saveDatabase();
  writeAuditLog(ws.id, "System", "UPDATE", "SUBSCRIPTION", sub.id, before, sub);
  return res.json(sub);
});

// ── POST /subscriptions/:id/downgrade ─────────────────────────
// Allowed from: active, trial
router.post("/:id/downgrade", (req, res) => {
  const ws = resolveWorkspace(req);
  const sub = db.subscriptions.find((s) => s.id === req.params.id);
  if (!sub) return notFound(res, "Subscription");

  const customer = db.customers.find(
    (c) => c.id === sub.customerId && c.workspaceId === ws.id && !c.isDeleted,
  );
  if (!customer) return notFound(res, "Subscription");

  const { planId } = req.body as { planId?: string };
  if (!planId) return badRequest(res, "Field 'planId' is required.");

  const newPlan = db.plans.find((p) => p.id === planId);
  if (!newPlan) return notFound(res, "Plan");

  if (sub.status !== "active" && sub.status !== "trial") {
    return conflict(res, `Cannot downgrade a subscription with status '${sub.status}'.`);
  }

  const before = { ...sub };
  const now = new Date().toISOString();
  sub.planId = planId;
  sub.updatedAt = now;
  customer.planId = planId;
  customer.notes.push({
    id: "note_" + Date.now(),
    timestamp: now,
    text: `Plan downgraded to: ${newPlan.name}`,
    author: "System",
  });

  saveDatabase();
  writeAuditLog(ws.id, "System", "UPDATE", "SUBSCRIPTION", sub.id, before, sub);
  return res.json(sub);
});

export default router;
