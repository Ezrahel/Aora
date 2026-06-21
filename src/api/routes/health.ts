// @ts-nocheck

import { Router } from "express";
import { asyncHandler } from "../middleware.ts";
import {
  query,
  customerRepo,
  planRepo,
  subscriptionRepo,
  meterRepo,
  usageRepo,
  invoiceRepo,
  webhookRepo,
} from "../db.ts";

export const router = Router();

router.get("/health", asyncHandler(async (_req, res) => {
  const { rows: [customers] } = await query("SELECT count(*)::int AS count FROM customers WHERE NOT is_deleted");
  const { rows: [plans] } = await query("SELECT count(*)::int AS count FROM plans WHERE NOT is_archived");
  const { rows: [subs] } = await query("SELECT count(*)::int AS count FROM subscriptions");
  const { rows: [meters] } = await query("SELECT count(*)::int AS count FROM meter_definitions");
  const { rows: [events] } = await query("SELECT count(*)::int AS count FROM usage_events");
  const { rows: [invoices] } = await query("SELECT count(*)::int AS count FROM invoices");
  const { rows: [webhooks] } = await query("SELECT count(*)::int AS count FROM webhook_endpoints");

  res.json({
    status: "ok",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    db: {
      customers: customers.count,
      plans: plans.count,
      subscriptions: subs.count,
      meters: meters.count,
      usageEvents: events.count,
      invoices: invoices.count,
      webhooks: webhooks.count,
    },
  });
}));

export default router;
