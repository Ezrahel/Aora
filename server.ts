// ============================================================
// Aora Billing OS — Local Dev / Self-Hosted Server
// Boots Express app (from src/app.ts) with Vite middleware or
// production static serving.
// ============================================================

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
      server: { middlewareMode: true },
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
