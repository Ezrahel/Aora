// @ts-nocheck

import { Router } from "express";
import {
  resolveWorkspace,
  writeAuditLog,
  genId,
  toNum,
  query,
  invoiceRepo,
  customerRepo,
  subscriptionRepo,
  usageRepo,
} from "../db.ts";
import { asyncHandler, parsePagination, badRequest, notFound, conflict } from "../middleware.ts";
import { createInvoiceOnGateway } from "../services/billing-sync.ts";

export const router = Router();

router.get("/", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const customers = await customerRepo.findByWorkspace(ws.id);
  const customerIds = customers.map((c) => c.id);

  if (customerIds.length === 0) {
    return res.json({ data: [], total: 0, page: 1, limit: 50, hasMore: false });
  }

  const invoices = await invoiceRepo.findByCustomerIds(customerIds);
  const enriched = invoices.map((inv) => ({
    ...inv,
    customerName: customers.find((c) => c.id === inv.customerId)?.name ?? "",
    customerEmail: customers.find((c) => c.id === inv.customerId)?.email ?? "",
  }));

  const { status, customerId } = req.query as Record<string, string | undefined>;
  let filtered = enriched;
  if (status) filtered = filtered.filter((inv) => inv.status === status);
  if (customerId) filtered = filtered.filter((inv) => inv.customerId === customerId);

  const pagination = parsePagination(req);
  const sliced = filtered.slice(pagination.offset, pagination.offset + pagination.limit);
  res.json({
    data: sliced,
    total: filtered.length,
    page: pagination.page,
    limit: pagination.limit,
    hasMore: pagination.offset + pagination.limit < filtered.length,
  });
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const inv = await invoiceRepo.findById(null as any, req.params.id);
  if (!inv) return notFound(res, "Invoice");

  const customer = await customerRepo.findById(null as any, inv.customerId);
  res.json({
    ...inv,
    customerName: customer?.name ?? inv.customerId,
    customerEmail: customer?.email ?? "",
  });
}));

router.post("/", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const { customerId, amount, currency, description, lineItems, metadata } = req.body as {
    customerId?: string; amount?: number; currency?: string; description?: string;
    lineItems?: Array<{description: string; amount: number; quantity?: number}>; metadata?: Record<string, unknown>;
  };
  if (!customerId) return badRequest(res, "customerId is required");

  const customer = await customerRepo.findById(null as any, customerId);
  if (!customer || customer.workspace_id !== ws.id) return notFound(res, "Customer");

  const id = "inv_" + genId();
  const now = new Date().toISOString();
  const usageUnits = (customer.usage_units ?? 0) + 1;

  // Create on gateway if connected, then locally
  const result = await createInvoiceOnGateway(ws.id, customer.id, amount ?? 0, currency ?? "usd");
  const invoice = result.local;

  await writeAuditLog(ws.id, "System", "CREATE", "INVOICE", invoice.id, null, {
    ...invoice,
    gateway_synced: !!result.gateway,
    gateway_hosted_url: result.gateway?.hostedUrl,
  });

  res.status(201).json({
    ...invoice,
    gateway_synced: !!result.gateway,
    gateway_hosted_url: result.gateway?.hostedUrl || undefined,
    gateway_invoice_id: result.gateway?.gatewayId || undefined,
  });
}));

router.post("/:id/finalize", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const inv = await invoiceRepo.findById(null as any, req.params.id);
  if (!inv) return notFound(res, "Invoice");

  const customersList = await customerRepo.findByWorkspace(ws.id);
  const customer = customersList.find((c) => c.id === inv.customerId);
  if (!customer) return notFound(res, "Customer");

  if (inv.status !== "pending") return conflict(res, `Cannot finalize an invoice with status '${inv.status}'.`);

  const before = { ...inv };
  const now = new Date().toISOString();
  const finalized = await invoiceRepo.update(null as any, inv.id, { status: "finalized" as any, finalizedAt: now });

  await writeAuditLog(ws.id, "System", "FINALIZE", "INVOICE", inv.id, before, finalized);
  res.json(finalized);
}));

router.post("/:id/pay", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const inv = await invoiceRepo.findById(null as any, req.params.id);
  if (!inv) return notFound(res, "Invoice");
  const customersList = await customerRepo.findByWorkspace(ws.id);
  const customer = customersList.find((c) => c.id === inv.customerId);
  if (!customer) return notFound(res, "Customer");
  if (inv.status !== "finalized") return conflict(res, `Cannot pay an invoice with status '${inv.status}'.`);

  const before = { ...inv };
  const now = new Date().toISOString();
  const paid = await invoiceRepo.update(null as any, inv.id, {
    status: "paid" as any,
    paidAt: now,
    paymentMethod: req.body.paymentMethod ?? inv.paymentMethod,
  });

  await writeAuditLog(ws.id, "System", "PAY", "INVOICE", inv.id, before, paid);
  res.json(paid);
}));

router.post("/:id/void", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const inv = await invoiceRepo.findById(null as any, req.params.id);
  if (!inv) return notFound(res, "Invoice");
  const customersList = await customerRepo.findByWorkspace(ws.id);
  const customer = customersList.find((c) => c.id === inv.customerId);
  if (!customer) return notFound(res, "Customer");
  if (inv.status === "voided") return conflict(res, "Invoice is already voided.");

  const before = { ...inv };
  const voided = await invoiceRepo.update(null as any, inv.id, { status: "voided" as any });

  await writeAuditLog(ws.id, "System", "VOID", "INVOICE", inv.id, before, voided);
  res.json(voided);
}));

router.post("/:id/refund", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const inv = await invoiceRepo.findById(null as any, req.params.id);
  if (!inv) return notFound(res, "Invoice");
  const customersList = await customerRepo.findByWorkspace(ws.id);
  const customer = customersList.find((c) => c.id === inv.customerId);
  if (!customer) return notFound(res, "Customer");
  if (inv.status !== "paid") return conflict(res, `Cannot refund an invoice with status '${inv.status}'.`);

  const before = { ...inv };
  const refunded = await invoiceRepo.update(null as any, inv.id, { status: "refunded" as any });

  await writeAuditLog(ws.id, "System", "REFUND", "INVOICE", inv.id, before, refunded);
  res.json(refunded);
}));

router.get("/stats", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const customers = await customerRepo.findByWorkspace(ws.id);
  const customerIds = customers.map((c) => c.id);

  if (customerIds.length === 0) {
    return res.json({ totalRevenue: 0, pendingAmount: 0, paidAmount: 0, invoiceCounts: {} });
  }

  const invoices = await invoiceRepo.findByCustomerIds(customerIds);

  const totalRevenue = invoices.filter((i) => i.status === "paid" || i.status === "finalized")
    .reduce((s, i) => s + (typeof i.amount === "string" ? parseFloat(i.amount) : i.amount), 0);
  const pendingAmount = invoices.filter((i) => i.status === "pending")
    .reduce((s, i) => s + (typeof i.amount === "string" ? parseFloat(i.amount) : i.amount), 0);
  const paidAmount = invoices.filter((i) => i.status === "paid")
    .reduce((s, i) => s + (typeof i.amount === "string" ? parseFloat(i.amount) : i.amount), 0);

  const invoiceCounts: Record<string, number> = {};
  for (const inv of invoices) {
    invoiceCounts[inv.status] = (invoiceCounts[inv.status] ?? 0) + 1;
  }

  res.json({ totalRevenue, pendingAmount, paidAmount, invoiceCounts });
}));

router.get("/revenue", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const customers = await customerRepo.findByWorkspace(ws.id);
  const customerIds = customers.map((c) => c.id);

  if (customerIds.length === 0) {
    return res.json({ monthly: [], total: 0, byCustomer: [] });
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

  const byCustomerList = await Promise.all(
    Object.entries(byCustomer).map(async ([cId, total]) => {
      const cust = await customerRepo.findById(null as any, cId);
      return { customerId: cId, customerName: cust?.name ?? cId, total };
    }),
  );

  res.json({
    monthly: Object.entries(monthly).map(([month, amount]) => ({ month, amount })),
    total: Object.values(monthly).reduce((s, v) => s + v, 0),
    byCustomer: byCustomerList,
  });
}));

export default router;
