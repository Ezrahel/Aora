// ============================================================
// Aora Billing OS — Vercel Serverless Entry Point
// Vercel wraps the exported Express app in its own HTTP
// handler. DB migrations run once on first request (cold
// start), then cache the initialization promise.
// ============================================================

import app, { initializeDatabase } from "../src/app.js";

// Module-level memoization — runs migrations exactly once
// per cold start, then every subsequent request reuses the
// already-initialized app.
let initPromise: Promise<void> | null = null;

if (!initPromise) {
  initPromise = initializeDatabase().catch((err) => {
    console.error("Vercel serverless DB init failed:", err);
  });
}

export default app;
