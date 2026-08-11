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

  // Start background gateway event processor only if DB is available
  if (dbAvailable) {
    startEventProcessor(10_000);
  }
}

startServer();
