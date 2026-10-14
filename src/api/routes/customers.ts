import { Router } from "express";
import {
  resolveWorkspace,
  writeAuditLog,
  genId, addMonths,
  customerRepo,
  subscriptionRepo,
  quotaRepo,
  usageRepo,
  creditRepo,
} from "../db.ts";
import { asyncHandler, badRequest, notFound } from "../middleware.ts";

export const router = Router();

router.get("/", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const { status, planId, q } = req.query as Record<string, string | undefined>;
  const rows = await customerRepo.findByWorkspace(ws.id, { status, planId, q });
  res.json(rows);
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const customer = await customerRepo.findById(null as any, req.params.id);
  if (!customer || customer.workspace_id !== ws.id) return notFound(res, "Customer");
  // Build invoice list from invoices table
  const { rows: invoices } = await (await import("../db.ts")).query(
    "SELECT id, amount, currency, status, usage_units, created_at FROM invoices WHERE customer_id = $1 ORDER BY created_at DESC",
    [customer.id],
  );
  res.json({
    ...customer,
    invoices: invoices.map((inv: any) => ({
      id: inv.id,
      amount: Number(inv.amount),
      currency: inv.currency,
      date: inv.created_at?.slice(0, 10),
      status: inv.status,
      usageUnits: Number(inv.usage_units),
    })),
  });
}));

router.post("/", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const { name, email, domain, planId, logoColor } = req.body as {
    name?: string; email?: string; domain?: string; planId?: string; logoColor?: string;
  };
  if (!name || !email) return badRequest(res, "Fields 'name' and 'email' are required.");

  const id = name.toLowerCase().replace(/[^a-z0-9]/g, "-") + "_" + Math.floor(Math.random() * 100);
  const now = new Date().toISOString();

  const newCustomer = await customerRepo.create(null as any, {
    id,
    workspaceId: ws.id,
    name, email,
    domain: domain ?? "",
    logoColor: logoColor ?? "#6366f1",
    planId: planId ?? "free",
    status: "trial",
    seatsUsed: 1,
    notes: [{
      id: "note_" + Date.now(),
      timestamp: now,
      text: `Welcome to Aora, ${name}! Your trial has started.`,
      author: "System",
    }],
  });

  await subscriptionRepo.create(null as any, {
    id: "sub_" + genId(),
    customerId: id,
    planId: planId ?? "free",
    status: "trial",
    currentPeriodStart: now,
    currentPeriodEnd: addMonths(now, 1),
    seatQuantity: 1,
  });

  await writeAuditLog(ws.id, "System", "CREATE", "CUSTOMER", id, null, newCustomer);
  res.status(201).json(newCustomer);
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const customer = await customerRepo.findById(null as any, req.params.id);
  if (!customer || customer.workspace_id !== ws.id) return notFound(res, "Customer");

  const { name, email, domain, planId, logoColor, paymentMethod } = req.body;

  const before = { ...customer };

  if (planId !== undefined && planId !== customer.plan_id) {
    const sub = await subscriptionRepo.findActiveByCustomer(null as any, customer.id);
    if (sub) {
      await subscriptionRepo.update(null as any, sub.id, { planId });
    }
  }

  const updated = await customerRepo.update(null as any, customer.id, {
    name, email, domain, planId, logoColor, paymentMethod,
  });
  if (!updated) return notFound(res, "Customer");
  await writeAuditLog(ws.id, "System", "UPDATE", "CUSTOMER", customer.id, before, updated);
  res.json(updated);
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const customer = await customerRepo.findById(null as any, req.params.id);
  if (!customer || customer.workspace_id !== ws.id) return notFound(res, "Customer");

  const before = { ...customer };
  await customerRepo.softDelete(null as any, customer.id);

  // Cancel active subscriptions
  const subs = await subscriptionRepo.findByCustomer(customer.id);
  for (const sub of subs) {
    if (sub.status === "active" || sub.status === "trial" || sub.status === "paused") {
      await subscriptionRepo.update(null as any, sub.id, { status: "canceled", canceledAt: new Date().toISOString() });
    }
  }

  await writeAuditLog(ws.id, "System", "DELETE", "CUSTOMER", customer.id, before, { ...customer, isDeleted: true });
  res.json({ deleted: true, id: customer.id });
}));

router.get("/:id/notes", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const customer = await customerRepo.findById(null as any, req.params.id);
  if (!customer || customer.workspace_id !== ws.id) return notFound(res, "Customer");
  const notes = (customer.notes ?? []).sort(
    (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  res.json(notes);
}));

router.post("/:id/notes", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const customer = await customerRepo.findById(null as any, req.params.id);
  if (!customer || customer.workspace_id !== ws.id) return notFound(res, "Customer");

  const { text, author } = req.body as { text?: string; author?: string };
  if (!text) return badRequest(res, "Field 'text' is required.");

  const now = new Date().toISOString();
  const newNote = { id: "note_" + Date.now(), timestamp: now, text, author: author ?? "Admin" };
  await customerRepo.addNote(null as any, customer.id, newNote);
  await writeAuditLog(ws.id, "System", "UPDATE", "CUSTOMER", customer.id, null, newNote);
  res.status(201).json(newNote);
}));

router.post("/:id/adjustPlan", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const customer = await customerRepo.findById(null as any, req.params.id);
  if (!customer || customer.workspace_id !== ws.id) return notFound(res, "Customer");

  const before = { ...customer };
  const { planId, status } = req.body as { planId?: string; status?: string };
  const now = new Date().toISOString();
  const planChanged = planId !== undefined && planId !== customer.plan_id;

  const updated = await customerRepo.update(null as any, customer.id, {
    planId: planId !== undefined ? planId : undefined,
    status: status !== undefined ? status as any : undefined,
  });

  const subs = await subscriptionRepo.findByCustomer(customer.id);
  const latestSub = subs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  if (latestSub) {
    await subscriptionRepo.update(null as any, latestSub.id, {
      planId: planId !== undefined ? planId : undefined,
      status: status !== undefined ? status as any : undefined,
    });
  }

  if (planChanged) {
    await customerRepo.addNote(null as any, customer.id, {
      id: "note_" + Date.now(), timestamp: now, text: `Plan modified to: ${planId}`, author: "System",
    });
  }

  await writeAuditLog(ws.id, "System", "ADJUST", "CUSTOMER", customer.id, before, updated);
  res.json(updated);
}));

router.get("/:id/invoices", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const customer = await customerRepo.findById(null as any, req.params.id);
  if (!customer || customer.workspace_id !== ws.id) return notFound(res, "Customer");

  const { rows } = await (await import("../db.ts")).query(
    `SELECT id, amount, currency, status, usage_units, created_at FROM invoices
     WHERE customer_id = $1 ORDER BY created_at DESC`,
    [customer.id],
  );
  let invoices = rows.map((inv: any) => ({
    id: inv.id,
    amount: Number(inv.amount),
    currency: inv.currency,
    date: inv.created_at?.slice(0, 10),
    status: inv.status,
    usageUnits: Number(inv.usage_units),
  }));

  const { status } = req.query as { status?: string };
  if (status) invoices = invoices.filter((inv: any) => inv.status === status);
  res.json(invoices);
}));

router.get("/:id/subscriptions", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const customer = await customerRepo.findById(null as any, req.params.id);
  if (!customer || customer.workspace_id !== ws.id) return notFound(res, "Customer");

  const subs = await subscriptionRepo.findByCustomer(customer.id);
  res.json(subs);
}));

router.get("/:id/usage", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const customer = await customerRepo.findById(null as any, req.params.id);
  if (!customer || customer.workspace_id !== ws.id) return notFound(res, "Customer");

  const quotas = await quotaRepo.findByCustomerIds([customer.id]);
  const quota = quotas[0] ?? null;

  const { rows: recentEvents } = await (await import("../db.ts")).query(
    "SELECT id, customer_id, meter_id, timestamp, value, metadata FROM usage_events WHERE customer_id = $1 ORDER BY timestamp DESC LIMIT 10",
    [customer.id],
  );

  res.json({
    customerId: customer.id,
    usageUnits: customer.usage_units,
    quota,
    recentEvents,
  });
}));

router.get("/:id/credits", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const customer = await customerRepo.findById(null as any, req.params.id);
  if (!customer || customer.workspace_id !== ws.id) return notFound(res, "Customer");

  const entries = await creditRepo.findByCustomerIds([customer.id], customer.id);
  const balance = await creditRepo.getBalance(customer.id);
  res.json({ customerId: customer.id, balance, entries });
}));

export default router;
