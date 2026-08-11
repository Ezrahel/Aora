// ============================================================
// AoraHQ Sandbox Isolation Middleware
//
// Routes requests to sandbox or live execution paths based on
// API key prefix, injects the appropriate gateway adapter, and
// applies time-travel offsets for testing subscription states.
//
// API Key Routing:
//   sk_test_*  → req.context.isTest = true  → SandboxPaymentAdapter
//   sk_live_*  → req.context.isTest = false → Real gateway adapter
//
// Time-Travel (X-AoraHQ-Simulate-Time header):
//   +7d  → Fast-forward 7 days for renewal calculations
//   +30d → Fast-forward 30 days
//   +2h  → Fast-forward 2 hours
// ============================================================

import type { Request, Response, NextFunction } from "express";
import { query } from "../db/pool.ts";
import { sandboxPaymentAdapter } from "../../gateways/sandbox-adapter.ts";
import { getNonCustodialGateway } from "../../gateways/non-custodial-registry.ts";
import type { NonCustodialPaymentGateway } from "../../gateways/non-custodial-adapter.ts";

// ── Request Context Types ─────────────────────────────────

export interface SandboxContext {
  /** True when the API key has sk_test_ prefix */
  isTest: boolean;
  /** The resolved workspace/tenant */
  workspace: {
    id: string;
    name: string;
    environment: string;
  };
  /** The gateway adapter to use for this request */
  paymentAdapter: NonCustodialPaymentGateway;
  /** Optional time offset to simulate future dates */
  timeOffset: TimeOffset | null;
  /** The raw API key prefix that was used */
  keyPrefix: "sk_test_" | "sk_live_";
}

export interface TimeOffset {
  value: number;
  unit: "h" | "d";
  label: string;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      context: SandboxContext;
    }
  }
}

// ── Time-Travel Parser ────────────────────────────────────

const TIME_OFFSET_RE = /^([+])(\d+)([hd])$/i;

/**
 * Parse an X-AoraHQ-Simulate-Time header value.
 *
 * Valid formats: +7d, +30d, +2h, +1h, +14d
 * Returns null for invalid formats.
 */
export function parseTimeOffset(header: string | undefined): TimeOffset | null {
  if (!header) return null;

  const match = header.trim().match(TIME_OFFSET_RE);
  if (!match) return null;

  const sign = match[1];
  const value = parseInt(match[2], 10);
  const unit = match[3].toLowerCase() as "h" | "d";

  if (value <= 0) return null;
  if (unit === "h" && value > 720) return null;  // max 30 days in hours
  if (unit === "d" && value > 365) return null;   // max 1 year

  return {
    value: sign === "+" ? value : -value,
    unit,
    label: `${sign}${value}${unit}`,
  };
}

/**
 * Apply a time offset to a Date.
 * Used in test mode to simulate future subscription states.
 */
export function applyTimeOffset(date: Date, offset: TimeOffset | null): Date {
  if (!offset) return date;

  const result = new Date(date);
  switch (offset.unit) {
    case "h":
      result.setHours(result.getHours() + offset.value);
      break;
    case "d":
      result.setDate(result.getDate() + offset.value);
      break;
  }
  return result;
}

/**
 * Get the current time with sandbox time offset applied.
 * Use this instead of `new Date()` in subscription renewal
 * and billing calculations when processing sandbox requests.
 */
export function nowWithOffset(context: SandboxContext): Date {
  return applyTimeOffset(new Date(), context.timeOffset);
}

// ── Middleware ─────────────────────────────────────────────

const API_KEY_PREFIX_RE = /^(sk_test_|sk_live_)(.+)$/;

/**
 * Express middleware that:
 *   1. Extracts & validates the API key prefix
 *   2. Determines sandbox vs live mode
 *   3. Resolves the workspace
 *   4. Injects the correct payment adapter
 *   5. Parses optional time-travel header
 *
 * Usage:
 *   router.use(sandboxIsolationMiddleware);
 *   // or apply per-route:
 *   router.post("/ingress", sandboxIsolationMiddleware, handler);
 *
 * On failure: 401/403 with structured error
 * On success: req.context is populated, next()
 */
export async function sandboxIsolationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Skip for paths that don't need sandbox isolation
  if (req.path === "/health" || req.path.startsWith("/gateways/webhooks/") || req.path.startsWith("/auth/")) {
    req.context = {
      isTest: false,
      workspace: { id: "", name: "", environment: "development" },
      paymentAdapter: sandboxPaymentAdapter,
      timeOffset: null,
      keyPrefix: "sk_live_",
    };
    return next();
  }

  const isProduction = process.env.NODE_ENV === "production";

  // 1. Extract API key
  const authHeader = (
    req.headers["authorization"] ||
    req.headers["x-api-key"] ||
    ""
  ) as string;
  const apiKey = authHeader.replace("Bearer ", "").trim();

  if (!apiKey) {
    if (isProduction) {
      res.status(401).json({
        error: "API key required. Use Authorization: Bearer sk_test_... or sk_live_...",
        code: "UNAUTHORIZED",
      });
      return;
    }
    // Dev-only fallback — lets the local UI work without a DB-backed key
    req.context = {
      isTest: true,
      workspace: { id: "dev", name: "Development", environment: "development" },
      paymentAdapter: sandboxPaymentAdapter,
      timeOffset: null,
      keyPrefix: "sk_test_",
    };
    return next();
  }

  // 2. Validate key prefix
  const keyMatch = apiKey.match(API_KEY_PREFIX_RE);
  if (!keyMatch) {
    res.status(400).json({
      error: "Invalid API key format. Key must start with sk_test_ or sk_live_.",
      code: "INVALID_KEY_FORMAT",
    });
    return;
  }

  const keyPrefix = keyMatch[1] as "sk_test_" | "sk_live_";
  const isTest = keyPrefix === "sk_test_";

  // 3. Resolve workspace from API key
  try {
    // Sandbox keys match workspaces with environment = 'sandbox' or 'development'
    // Live keys match workspaces with environment = 'production'
    const targetEnv = isTest
      ? ["sandbox", "development"]
      : ["production"];

    const result = await query(
      `SELECT w.id, w.name, w.environment
       FROM workspaces w
       WHERE $1 = ANY(w.api_keys)
         AND w.environment = ANY($2::STRING[])
       LIMIT 1`,
      [apiKey, targetEnv],
    );

    if (result.rows.length === 0) {
      const msg = isTest
        ? "Invalid sandbox API key. Ensure the workspace environment is 'sandbox' or 'development'."
        : "Invalid live API key. Ensure the workspace environment is 'production'.";
      res.status(403).json({ error: msg, code: "FORBIDDEN" });
      return;
    }

    const ws = result.rows[0];

    // 4. Parse time-travel header
    const timeOffset = parseTimeOffset(
      req.headers["x-aorahq-simulate-time"] as string | undefined,
    );

    // 5. Select gateway adapter — for live mode, resolve the workspace's
    // primary payment gateway from gateway_connections
    let paymentAdapter: NonCustodialPaymentGateway;
    if (isTest) {
      paymentAdapter = sandboxPaymentAdapter;
    } else {
      try {
        const gwResult = await query(
          `SELECT gateway FROM gateway_connections
           WHERE workspace_id = $1 AND mode = 'live' AND is_verified = true
           LIMIT 1`,
          [ws.id],
        );
        const gwName = gwResult.rows[0]?.gateway;
        paymentAdapter = gwName
          ? (getNonCustodialGateway(gwName) ?? sandboxPaymentAdapter)
          : sandboxPaymentAdapter;
      } catch {
        paymentAdapter = sandboxPaymentAdapter;
      }
    }

    // 6. Populate request context
    req.context = {
      isTest,
      workspace: {
        id: ws.id,
        name: ws.name,
        environment: ws.environment,
      },
      paymentAdapter,
      timeOffset,
      keyPrefix,
    };

    // Also set legacy req.workspace for backward compatibility
    (req as any).workspace = ws;

    // 7. Log sandbox access (debug)
    if (isTest) {
      console.debug(
        `[Sandbox] ${ws.name} (${ws.id}) — timeOffset=${timeOffset?.label ?? "none"}`,
      );
    }

    next();
  } catch (err) {
    console.error("[Sandbox] Auth error:", err);
    res.status(500).json({
      error: "Authentication service unavailable.",
      code: "AUTH_ERROR",
    });
  }
}
