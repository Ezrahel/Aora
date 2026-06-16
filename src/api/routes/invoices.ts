// ============================================================
// Aora Billing OS — Invoices Routes
// GET /invoices, POST /invoices, GET /invoices/:id
// PUT /invoices/:id, PATCH /invoices/:id/status
// POST /invoices/:id/finalize, /void, /mark-paid
// ============================================================

import { Router } from "express";
import { db, saveDatabase, writeAuditLog, resolveWorkspace, nanoid } from "../db.ts";
import { parsePagination, paginateArray, badRequest, notFound, genId, toNum } from "../middleware.ts";
import type { MeterDefinition, UsageEvent, Quota, CreditLedgerEntry, Entitlement, ClientEntitlement, Invoice } from "../types.ts";

export const router = Router();

// ── Internal helper ────────────────────────────────────────────
// Search across all customer invoice arrays for a given invoice id.
function findInvoice(id: string) {
  for (const customer of db.customers) {
    const invoice = customer.invoices.find((inv) => inv.id === id);
    if (invoice) return { invoice, customer };
  }
  return null;
}

// ── Invoices ───────────────────────────────────────────────────

// GET /invoices
router.get("/invoices", (req, res) => {
  const ws = resolveWorkspace(req);
  const wsCustomers = db.customers.filter((c) => c.workspaceId === ws.id);

  const { status, customerId, from, to } = req.query as {
    status?: string;
    customerId?: string;
    from?: string;
    to?: string;
  };

  // Flatten and enrich all invoices from workspace customers
  let allInvoices = wsCustomers.flatMap((cust) =>
    cust.invoices.map((inv) => ({
      ...inv,
      customerId: cust.id,
      customerName: cust.name,
      customerEmail: cust.email,
    })),
  );

  if (status) allInvoices = allInvoices.filter((inv) => inv.status === status);
  if (customerId) allInvoices = allInvoices.filter((inv) => inv.customerId === customerId);
  if (from) allInvoices = allInvoices.filter((inv) => inv.date >= from);
  if (to) allInvoices = allInvoices.filter((inv) => inv.date <= to);

  // Sort descending by date
  allInvoices.sort((a, b) => b.date.localeCompare(a.date));

  const opts = parsePagination(req);
  return res.json(paginateArray(allInvoices, opts));
});

// GET /invoices/:id
router.get("/invoices/:id", (req, res) => {
  const found = findInvoice(req.params.id);
  if (!found) return notFound(res, "Invoice");

  const { invoice, customer } = found;
  return res.json({
    ...invoice,
    customerId: customer.id,
    customerName: customer.name,
    customerEmail: customer.email,
  });
});

// POST /invoices
router.post("/invoices", (req, res) => {
  const ws = resolveWorkspace(req);
  const { customerId, amount, currency, usageUnits, status } = req.body as {
    customerId?: string;
    amount?: any;
    currency?: string;
    usageUnits?: any;
    status?: Invoice["status"];
  };

  if (!customerId) return badRequest(res, "customerId is required.");
  if (amount === undefined || amount === null) return badRequest(res, "amount is required.");

  const customer = db.customers.find(
    (c) => c.
