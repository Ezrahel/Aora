// ============================================================
// Aora Billing OS — Customers Route
// Full CRUD, notes, plan adjustment, invoices, subscriptions,
// usage summary, and credit balance for a workspace's customers.
// ============================================================

import { Router } from "express";
import { db, saveDatabase, writeAuditLog, resolveWorkspace, nanoid } from "../db.ts";
import {
  parsePagination, paginateArray, badRequest, notFound, conflict,
  genId, addMonths, addDays, toNum,
} from "../middleware.ts";
import type { Customer, Subscription, Invoice } from "../types.ts";

export const router = Router();

// ── GET /customers ─────────────────────────────────────────────
router.get("/", (req, res) => {
  const ws = resolveWorkspace(req);
  let customers = db.customers.filter(
    (c) => c.workspaceId === ws.id && !c.isDeleted,
  );

  const { status, planId, q } = req.query as Record<string, string | undefined>;

  if (status) {
    customers = customers.filter((c) => c.status === status);
  }
  if (planId) {
    customers = customers.filter((c) => c.planId === planId);
  }
  if (q) {
    const lower = q.toLowerCase();
    customers = customers.filter(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        c.email.toLowerCase().includes(lower) ||
        (c.domain && c.domain.toLowerCase().includes(lower)),
    );
  }

  const pagination = parsePagination(req);
  return res.json(paginateArray(customers, pagination));
});

// ── GET /customers/:id ─────────────────────────────────────────
router.get("/:id", (req, res) => {
  const ws = resolveWorkspace(req);
  const customer = db.customers.find(
    (c) => c.id === req.params.id && c.workspaceId === ws.id && !c.isDeleted,
  );
  if (!customer) return notFound(res, "Customer");
  return res.json(customer);
});

// ── POST /customers ────────────────────────────────────────────
router.post("/", (req, res) => {
  const ws = resolveWorkspace(req);
  const { name, email, domain, planId, logoColor } = req.body as {
    name?: string;
    email?: string;
    domain?: string;
    planId?: string;
    logoColor?: string;
  };

  if (!name || !email) {
    return badRequest(res, "Fields 'name' and 'email' are required.");
  }

  const now = new Date().toISOString();
  const id =
    name.toLowerCase().replace(/[^a-z0-9]/g, "-") +
    "_" +
    Math.floor(Math.random() * 100);

  const newCustomer: Customer = {
    id,
    workspaceId: ws.id,
    name,
    email,
    domain: domain ?? "",
    logoColor: logoColor ?? "#6366f1",
    createdDate: now,
    planId: planId ?? "free",
    status: "trial",
    paymentMethod: null,
    seatsUsed: 1,
    usageUnits: 0,
    notes: [
      {
        id: "note_" + Date.now(),
        timestamp: now,
        text: `Welcome to Aora, ${name}! Your trial has started.`,
        author: "System",
      },
    ],
    invoices: [],
    contracts: [],
  };

  const newSub: Subscription = {
    id: "sub_" + genId(),
    customerId: id,
    planId: planId ?? "free",
    status: "trial",
    currentPeriodStart: now,
    currentPeriodEnd: addMonths(now, 1),
    seatQuantity: 1,
    createdAt: now,
  };

  db.customers.push(newCustomer);
  db.subscriptions.push(newSub);
  saveDatabase();
  writeAuditLog(ws.id, "System", "CREATE", "CUSTOMER", id, null, newCustomer);

  return res.status(201).json(newCustomer);
});

// ── PUT /customers/:id ─────────────────────────────────────────
router.put("/:id", (req, res) => {
  const ws = resolveWorkspace(req);
  const customer = db.customers.find(
    (c) => c.id === req.params.id && c.workspaceId === ws.id && !c.isDeleted,
  );
  if (!customer) return notFound(res, "Customer");

  const before = { ...customer };
  const { name, email, domain, planId, logoColor, paymentMethod } = req.body as {
    name?: string;
    email?: string;
    domain?: string;
    planId?: string;
    logoColor?: string;
    paymentMethod?: Customer["paymentMethod"];
  };

  if (name !== undefined) customer.name = name;
  if (email !== undefined) customer.email = email;
  if (domain !== undefined) customer.domain = domain;
  if (logoColor !== undefined) customer.logoColor = logoColor;
  if (paymentMethod !== undefined) customer.paymentMethod = paymentMethod;

  if (planId !== undefined && planId !== customer.planId) {
    customer.planId = planId;
    // Keep the active/trial subscription in sync
    const sub = db.subscriptions.find(
      (s) =>
        s.customerId === customer.id &&
        (s.status === "active" || s.status === "trial"),
    );
    if (sub) sub.planId = planId;
  }

  saveDatabase();
  writeAuditLog(ws.id, "System", "UPDATE", "CUSTOMER", customer.id, before, customer);
  return res.json(customer);
});

// ── DELETE /customers/:id (soft delete) ────────────────────────
router.delete("/:id", (req, res) => {
  const ws = resolveWorkspace(req);
  const customer = db.customers.find(
    (c) => c.id === req.params.id && c.workspaceId === ws.id && !c.isDeleted,
  );
  if (!customer) return notFound(res, "Customer");

  const before = { ...customer };
  const now = new Date().toISOString();
  customer.isDeleted = true;
  customer.deletedAt = now;

  // Cancel any non-terminal subscriptions
  db.subscriptions
    .filter(
      (s) =>
        s.customerId === customer.id &&
        (s.status === "active" || s.status === "trial" || s.status === "paused"),
    )
    .forEach((s) => {
      s.status = "canceled";
      s.canceledAt = now;
    });

  saveDatabase();
  writeAuditLog(ws.id, "System", "DELETE", "CUSTOMER", customer.id, before, customer);
  return res.json({ deleted: true, id: customer.id });
});

// ── GET /customers/:id/notes ───────────────────────────────────
router.get("/:id/notes", (req, res) => {
  const ws = resolveWorkspace(req);
  const customer = db.customers.find(
    (c) => c.id === req.params.id && c.workspaceId === ws.id && !c.isDeleted,
  );
  if (!customer) return notFound(res, "Customer");

  const sorted = [...customer.notes].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  return res.json(sorted);
});

// ── POST /customers/:id/notes ──────────────────────────────────
router.post("/:id/notes", (req, res) => {
  const ws = resolveWorkspace(req);
  const customer = db.customers.find(
    (c) => c.id === req.params.id && c.workspaceId === ws.id && !c.isDeleted,
  );
  if (!customer) return notFound(res, "Customer");

  const { text, author } = req.body as { text?: string; author?: string };
  if (!text) return badRequest(res, "Field 'text' is required.");

  const now = new Date().toISOString();
  const newNote = {
    id: "note_" + Date.now(),
    timestamp: now,
    text,
    author: author ?? "Admin",
  };

  customer.notes.push(newNote);
  saveDatabase();
  writeAuditLog(ws.id, "System", "UPDATE", "CUSTOMER", customer.id, null, newNote);
  return res.status(201).json(newNote);
});

// ── POST /customers/:id/adjustPlan ─────────────────────────────
router.post("/:id/adjustPlan", (req, res) => {
  const ws = resolveWorkspace(req);
  const customer = db.customers.find(
    (c) => c.id === req.params.id && c.workspaceId === ws.id && !c.isDeleted,
  );
  if (!customer) return notFound(res, "Customer");

  const before = { ...customer };
  const { planId, status } = req.body as {
    planId?: string;
    status?: Customer["status"];
  };

  const now = new Date().toISOString();
  const planChanged = planId !== undefined && planId !== customer.planId;

  if (planId !== undefined) customer.planId = planId;
  if (status !== undefined) customer.status = status;

  // Keep the most-recent subscription in sync
  const sub = db.subscriptions
    .filter((s) => s.customerId === customer.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  if (sub) {
    if (planId !== undefined) sub.planId = planId;
    if (status !== undefined) sub.status = status as Subscription["status"];
  }

  if (planChanged) {
    customer.notes.push({
      id: "note_" + Date.now(),
      timestamp: now,
      text: `Plan modified to: ${planId}`,
      author: "System",
    });
  }

  saveDatabase();
  writeAuditLog(ws.id, "System", "ADJUST", "CUSTOMER", customer.id, before, customer);
  return res.json(customer);
});

// ── GET /customers/:id/invoices ────────────────────────────────
router.get("/:id/invoices", (req, res) => {
  const ws = resolveWorkspace(req);
  const customer = db.customers.find(
    (c) => c.id === req.params.id && c.workspaceId === ws.id && !c.isDeleted,
  );
  if (!customer) return notFound(res, "Customer");

  let invoices: Invoice[] = [...customer.invoices].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const { status } = req.query as { status?: string };
  if (status) invoices = invoices.filter((inv) => inv.status === status);

  return res.json(invoices);
});

// ── GET /customers/:id/subscriptions ──────────────────────────
router.get("/:id/subscriptions", (req, res) => {
  const ws = resolveWorkspace(req);
  const customer = db.customers.find(
    (c) => c.id === req.params.id && c.workspaceId === ws.id && !c.isDeleted,
  );
  if (!customer) return notFound(res, "Customer");

  const subs = db.subscriptions.filter((s) => s.customerId === customer.id);
  return res.json(subs);
});

// ── GET /customers/:id/usage ───────────────────────────────────
router.get("/:id/usage", (req, res) => {
  const ws = resolveWorkspace(req);
  const customer = db.customers.find(
    (c) => c.id === req.params.id && c.workspaceId === ws.id && !c.isDeleted,
  );
  if (!customer) return notFound(res, "Customer");

  const quota = db.quotas.find((q) => q.customerId === customer.id) ?? null;

  // Return last 10 events, most-recent first
  const recentEvents = db.usageEvents
    .filter((e) => e.customerId === customer.id)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);

  return res.json({
    customerId: customer.id,
    usageUnits: customer.usageUnits,
    quota,
    recentEvents,
  });
});

// ── GET /customers/:id/credits ─────────────────────────────────
router.get("/:id/credits", (req, res) => {
  const ws = resolveWorkspace(req);
  const customer = db.customers.find(
    (c) => c.id === req.params.id && c.workspaceId === ws.id && !c.isDeleted,
  );
  if (!customer) return notFound(res, "Customer");

  const entries = db.creditLedger.filter((e) => e.customerId === customer.id);
  const balance = entries.reduce((sum, e) => {
    if (e.type === "credit_issued") return sum + e.amount;
    if (
      e.type === "credit_consumed" ||
      e.type === "credit_expired" ||
      e.type === "credit_reversed"
    )
      return sum - e.amount;
    return sum;
  }, 0);

  return res.json({ customerId: customer.id, balance, entries });
});

export default router;
