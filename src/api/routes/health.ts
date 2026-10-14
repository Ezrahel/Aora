import { Router } from "express";
import { asyncHandler } from "../middleware.ts";
import { getPoolStats, query } from "../db.ts";
import { isTracingEnabled } from "../services/tracing.ts";

export const router = Router();

function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Database health check timed out")), timeoutMs);
    operation.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

router.get("/health", asyncHandler(async (_req, res) => {
  // Do not create a pool during unbootstrapped tests or deployments without a
  // database. A failed readiness check must return well inside Fly's timeout.
  let dbConnected = false;
  if (process.env.DATABASE_URL && process.env.NODE_ENV !== "test" && !process.env.VITEST) {
    const timeoutMs = Math.max(100, Number(process.env.DATABASE_HEALTH_TIMEOUT_MS ?? 1_000));
    try {
      await withTimeout(query("SELECT 1"), timeoutMs);
      dbConnected = true;
    } catch {
      // A degraded response is intentional; callers can retry without tying
      // up health-check workers for the pool's normal connection timeout.
    }
  }

  const poolStats = getPoolStats();
  let counts: Record<string, number> = {};
  let gateways: Record<string, { connected: boolean; modes: unknown[] }> = {};
  let lastWebhookReceived: string | null = null;
  let eventBacklog = 0;

  if (dbConnected) {
    try {
      const [customerResult, planResult, subResult, meterResult, eventResult, invoiceResult,
        gatewayResult, webhookResult, backlogResult] = await Promise.all([
        query("SELECT count(*)::int AS count FROM customers WHERE NOT is_deleted"),
        query("SELECT count(*)::int AS count FROM plans WHERE NOT is_archived"),
        query("SELECT count(*)::int AS count FROM subscriptions"),
        query("SELECT count(*)::int AS count FROM meter_definitions"),
        query("SELECT count(*)::int AS count FROM usage_events"),
        query("SELECT count(*)::int AS count FROM invoices"),
        query("SELECT gateway, mode, is_verified, last_verified_at FROM gateway_connections ORDER BY created_at DESC"),
        query("SELECT created_at FROM gateway_events ORDER BY created_at DESC LIMIT 1"),
        query("SELECT count(*)::int AS count FROM gateway_events WHERE status = 'received'"),
      ]);

      counts = {
        customers: customerResult.rows[0]?.count ?? 0,
        plans: planResult.rows[0]?.count ?? 0,
        subscriptions: subResult.rows[0]?.count ?? 0,
        meters: meterResult.rows[0]?.count ?? 0,
        usageEvents: eventResult.rows[0]?.count ?? 0,
        invoices: invoiceResult.rows[0]?.count ?? 0,
      };
      for (const connection of gatewayResult.rows) {
        const gateway = String(connection.gateway);
        gateways[gateway] ??= { connected: false, modes: [] };
        gateways[gateway].connected ||= Boolean(connection.is_verified);
        gateways[gateway].modes.push({
          mode: connection.mode,
          verified: connection.is_verified,
          lastVerified: connection.last_verified_at,
        });
      }
      lastWebhookReceived = webhookResult.rows[0]?.created_at ?? null;
      eventBacklog = backlogResult.rows[0]?.count ?? 0;
    } catch {
      dbConnected = false;
      counts = {};
      gateways = {};
      lastWebhookReceived = null;
      eventBacklog = 0;
    }
  }

  res.json({
    status: dbConnected ? "ok" : "degraded",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    database: {
      connected: dbConnected,
      poolSize: poolStats.totalCount,
      poolAvailable: poolStats.idleCount,
      entityCounts: counts,
    },
    gateways: {
      connected: Object.keys(gateways).length > 0,
      providers: Object.keys(gateways).length > 0 ? gateways : "none",
      lastWebhookReceived,
      eventProcessingBacklog: eventBacklog,
    },
    tracing: { enabled: isTracingEnabled() },
    memory: {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
  });
}));

export default router;
