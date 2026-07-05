// @ts-nocheck

import { Router } from "express";
import { asyncHandler } from "../middleware.ts";
import {
  pool,
  query,
  customerRepo,
  planRepo,
  subscriptionRepo,
  meterRepo,
  usageRepo,
  invoiceRepo,
  webhookRepo,
  gatewayRepo,
  gatewayEventRepo,
} from "../db.ts";
import { getAdapter, decrypt } from "../../gateways/index.ts";
import { isTracingEnabled } from "../services/tracing.ts";

export const router = Router();

router.get("/health", asyncHandler(async (_req, res) => {
  // DB connectivity check
  let dbConnected = false;
  let dbPoolSize = 0;
  let dbPoolAvailable = 0;
  try {
    await query("SELECT 1");
    dbConnected = true;
    dbPoolSize = (pool as any).totalCount || 0;
    dbPoolAvailable = (pool as any).idleCount || 0;
  } catch (err) {
    dbConnected = false;
  }

  // DB entity counts
  let counts: Record<string, number> = {};
  try {
    const { rows: [customers] } = await query("SELECT count(*)::int AS count FROM customers WHERE NOT is_deleted");
    const { rows: [plans] } = await query("SELECT count(*)::int AS count FROM plans WHERE NOT is_archived");
    const { rows: [subs] } = await query("SELECT count(*)::int AS count FROM subscriptions");
    const { rows: [meters] } = await query("SELECT count(*)::int AS count FROM meter_definitions");
    const { rows: [events] } = await query("SELECT count(*)::int AS count FROM usage_events");
    const { rows: [invoices] } = await query("SELECT count(*)::int AS count FROM invoices");
    counts = {
      customers: customers?.count ?? 0,
      plans: plans?.count ?? 0,
      subscriptions: subs?.count ?? 0,
      meters: meters?.count ?? 0,
      usageEvents: events?.count ?? 0,
      invoices: invoices?.count ?? 0,
    };
  } catch { /* counts unavailable */ }

  // Gateway connectivity check
  let gateways: Record<string, any> = {};
  try {
    const { rows: gwConnections } = await query(
      "SELECT gateway, mode, is_verified, last_verified_at, key_preview FROM gateway_connections ORDER BY created_at DESC",
    );
    for (const gw of gwConnections) {
      if (!gateways[gw.gateway]) {
        gateways[gw.gateway] = { connected: false, modes: [] };
      }
      gateways[gw.gateway].connected = gateways[gw.gateway].connected || gw.is_verified;
      gateways[gw.gateway].modes.push({
        mode: gw.mode,
        verified: gw.is_verified,
        lastVerified: gw.last_verified_at,
      });
    }
  } catch { /* gateways unavailable */ }

  // Last webhook received timestamp
  let lastWebhookReceived: string | null = null;
  try {
    const { rows } = await query(
      "SELECT created_at FROM gateway_events ORDER BY created_at DESC LIMIT 1",
    );
    if (rows[0]) lastWebhookReceived = rows[0].created_at;
  } catch { /* no gateway events */ }

  // Gateway event processing backlog
  let eventBacklog = 0;
  try {
    const { rows } = await query(
      "SELECT count(*)::int AS count FROM gateway_events WHERE status = 'received'",
    );
    eventBacklog = rows[0]?.count ?? 0;
  } catch { /* no backlog data */ }

  res.json({
    status: dbConnected ? "ok" : "degraded",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    database: {
      connected: dbConnected,
      poolSize: dbPoolSize,
      poolAvailable: dbPoolAvailable,
      entityCounts: counts,
    },
    gateways: {
      connected: Object.keys(gateways).length > 0,
      providers: Object.keys(gateways).length > 0 ? gateways : "none",
      lastWebhookReceived,
      eventProcessingBacklog: eventBacklog,
    },
    tracing: {
      enabled: isTracingEnabled(),
    },
    memory: {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
  });
}));

export default router;
