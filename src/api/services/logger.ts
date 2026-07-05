// ============================================================
// Structured JSON Logger
// ============================================================

export interface LogEntry {
  timestamp: string;
  level: string;
  module: string;
  message: string;
  requestId?: string;
  workspaceId?: string;
  duration?: number;
  error?: string;
  [key: string]: any;
}

function log(level: string, module: string, message: string, meta?: Record<string, any>) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
    ...(meta || {}),
  };

  const json = JSON.stringify(entry);

  switch (level) {
    case "ERROR":
    case "FATAL":
      console.error(json);
      break;
    case "WARN":
      console.warn(json);
      break;
    default:
      console.log(json);
  }
}

export function createLogger(module: string) {
  return {
    info: (message: string, meta?: Record<string, any>) => log("INFO", module, message, meta),
    warn: (message: string, meta?: Record<string, any>) => log("WARN", module, message, meta),
    error: (message: string, meta?: Record<string, any>) => log("ERROR", module, message, meta),
    debug: (message: string, meta?: Record<string, any>) => {
      if (process.env.DEBUG) log("DEBUG", module, message, meta);
    },
  };
}

// ── Request ID Middleware ───────────────────────────────────

import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  req.requestId = (req.headers["x-request-id"] as string) || crypto.randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
}
