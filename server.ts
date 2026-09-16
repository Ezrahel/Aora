// ============================================================
// Aora Billing OS — Local Dev / Self-Hosted Server
// Boots Express app (from src/app.ts) with Vite middleware or
// production static serving.
// ============================================================

import dotenv from "dotenv";
dotenv.config();

// Prevent unhandled promise rejections from crashing the dev server.
// Better Auth's dash plugin makes outgoing HTTP requests that may
// fail or timeout in local/tunnel environments.
process.on("unhandledRejection", (reason) => {
  console.warn("[server] Unhandled rejection (non-fatal):", reason);
});

import app, { initializeDatabase, dbAvailable } from "./src/app.ts";
import express from "express";
import path from "path";
import fs from "node:fs";
import { startEventProcessor } from "./src/api/services/gateway-event-processor.ts";
import { startWebhookWorker, stopWebhookWorker } from "./src/api/services/webhook-dispatcher-worker.ts";
import { processScheduledDunning } from "./src/api/services/dunning.ts";
import { processDueDunningRetries } from "./src/api/services/dunning-state-machine.ts";

const PORT = parseInt(process.env.PORT || "3000", 10);

// ── Static Vite Serving & Startup ──────────────────────────
async function startServer() {
  await initializeDatabase();

  const distPath = path.join(process.cwd(), "dist");
  const isProduction = fs.existsSync(path.join(distPath, "index.html"));

  if (isProduction) {
    console.log("Configuring high-fidelity production static assets server...");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    console.log("Setting up live Vite development preview mode...");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        proxy: {},           // disable proxy — not needed in middleware mode
        hmr: false,          // disable HMR in middleware mode to prevent path conflicts
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AoraHQ Billing Engine Server is actively listening on port ${PORT}`);
  });

  // Start background workers only if DB is available
  if (dbAvailable) {
    startEventProcessor(10_000);
    // Outbound webhook dispatcher (BullMQ/Redis; log-only when REDIS_URL unset)
    try {
      startWebhookWorker();
    } catch (err) {
      console.warn("[server] Webhook worker failed to start:", (err as Error).message);
    }
    // Legacy dunning schedule (email_reminder + retry_payment rows)
    setInterval(async () => {
      try {
        const r = await processScheduledDunning();
        if (r.processed > 0) console.log(`[Dunning] processed=${r.processed} ok=${r.succeeded} fail=${r.failed}`);
      } catch (err) {
        console.error("[Dunning] scheduler error:", (err as Error).message);
      }
    }, 60_000);
    // Dunning state-machine retries (Day 3 / Day 7 lifecycle)
    setInterval(async () => {
      try {
        const n = await processDueDunningRetries("system", 25);
        if (n > 0) console.log(`[DunningSM] processed ${n} due retries`);
      } catch (err) {
        console.error("[DunningSM] scheduler error:", (err as Error).message);
      }
    }, 5 * 60_000);
  }

  const shutdown = async () => {
    console.log("[server] shutting down...");
    try { await stopWebhookWorker(); } catch { /* noop */ }
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

startServer();
