// ============================================================
// Aora Billing OS — Health Route
// GET /health — system status, version, uptime, db object counts
// ============================================================

import { Router } from "express";
import { db, saveDatabase, writeAuditLog, resolveWorkspace, nanoid } from "../db.ts";
import { parsePagination, paginateArray, badRequest, notFound, conflict, genId, toNum } from "../middleware.ts";

const router = Router();

// GET /health
router.get("/health", (_req, res) => {
  const totalInvoices = db.customers.reduce(
    (sum, c) => sum + (c.invoices?.length ?? 0),
    0,
  );

  res.json({
    status: "ok",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    db: {
      customers: db.customers.length,
      plans: db.plans.length,
      subscriptions: db.subscriptions.length,
      meters: db.meters.length,
      usageEvents: db.usageEvents.length,
      invoices: totalInvoices,
      webhooks: db.webhooks.length,
    },
  });
});

export default router;
