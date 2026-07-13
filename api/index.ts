// ============================================================
// Aora Billing OS — Vercel Serverless Entry Point
// Vercel wraps the exported handler in its own HTTP layer.
// The handler waits for DB init before forwarding to Express,
// so routes never fire before migrations complete.
// ============================================================

import dotenv from "dotenv";
dotenv.config();

import type { Request, Response } from "express";
import app, { initializeDatabase } from "../src/app.js";

// Module-level memoization — runs migrations exactly once
// per cold start.
let initialized = false;
const initPromise: Promise<void> = initializeDatabase().catch((err) => {
  console.error("Vercel serverless DB init failed:", err);
});

// Wraps the Express app so every request awaits DB readiness
// before hitting any route. After init completes, the promise
// resolves instantly and subsequent requests pass through.
export default async function handler(req: Request, res: Response) {
  if (!initialized) {
    await initPromise;
    initialized = true;
  }
  app(req, res);
}
