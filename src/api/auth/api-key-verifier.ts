import type { Request, Response, NextFunction } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import { query } from "../db/pool.ts";

// ── Constants ──────────────────────────────────────────────

const API_KEY_PREFIX = "sk_live_aora_";
const API_KEY_MIN_LENGTH = 24;

// Extended request context for API-key-authenticated requests
declare global {
  namespace Express {
    interface Request {
      tenant?: {
        organizationId: string;
        name: string;
        environment: string;
      };
      apiKeyInfo?: {
        keyId: string;
        label: string;
        prefix: string;
      };
    }
  }
}

// ── Helpers ────────────────────────────────────────────────

/**
 * Derive a SHA-256 hash from the raw API key.
 * The hash is what we store and compare against — the raw key
 * never touches the database.
 */
export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey, "utf-8").digest("hex");
}

/**
 * Extract the prefix portion before the random entropy.
 * Example: "sk_live_aora_5f2d93e810cb9921e42bcs2" → "sk_live_aora_"
 */
export function extractKeyPrefix(rawKey: string): string {
  const idx = rawKey.lastIndexOf("_");
  if (idx === -1) return rawKey;
  return rawKey.substring(0, idx + 1);
}

const BEARER_RE = /^Bearer\s+(.+)$/i;

/**
 * Extract Bearer token from the Authorization header.
 */
function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const match = header.match(BEARER_RE);
  return match ? match[1].trim() : null;
}

// ── Interface for the API key DB row ───────────────────────

interface ApiKeyRow {
  id: string;
  prefix: string;
  key_hash: string;
  label: string;
  organization_id: string;
  workspace_name?: string;
  workspace_environment?: string;
  expires_at: string | null;
}

// ── Middleware ──────────────────────────────────────────────

/**
 * Express middleware that verifies AoraHQ API keys
 * (sk_live_aora_...) on server-to-server requests to /api/v1/*.
 *
 * Flow:
 *   1. Extract Bearer token from Authorization header
 *   2. Validate format (sk_live_aora_ prefix, min length)
 *   3. SHA-256 hash the raw key
 *   4. Look up the hash in the api_key table (indexed)
 *   5. Check expiration
 *   6. Attach tenant + key metadata to req
 *   7. Update last_used_at asynchronously (fire-and-forget)
 */
export async function verifyApiKey(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Only apply to /api/v1/* routes
  if (!req.path.startsWith("/api/v1/")) {
    next();
    return;
  }

  const rawKey = extractBearerToken(req);
  if (!rawKey) {
    res.status(401).json({
      error: "Missing Authorization header. Use: Bearer sk_live_aora_...",
      code: "MISSING_API_KEY",
    });
    return;
  }

  // Validate format
  if (!rawKey.startsWith(API_KEY_PREFIX)) {
    res.status(401).json({
      error: "Invalid API key format. Key must start with 'sk_live_aora_'.",
      code: "INVALID_KEY_FORMAT",
    });
    return;
  }

  if (rawKey.length < API_KEY_MIN_LENGTH) {
    res.status(401).json({
      error: "API key is too short.",
      code: "INVALID_KEY_LENGTH",
    });
    return;
  }

  const prefix = extractKeyPrefix(rawKey);
  const keyHash = hashApiKey(rawKey);

  try {
    const result = await query<ApiKeyRow>(
      `SELECT ak.id, ak.prefix, ak.key_hash, ak.label,
              ak.organization_id, ak.expires_at,
              o.name AS workspace_name,
              '' AS workspace_environment
       FROM api_key ak
       JOIN organization o ON o.id = ak.organization_id
       WHERE ak.key_hash = $1`,
      [keyHash],
    );

    const row = result.rows[0];
    if (!row) {
      res.status(401).json({
        error: "API key not found or revoked.",
        code: "INVALID_API_KEY",
      });
      return;
    }

    // Check expiration
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      res.status(401).json({
        error: "API key has expired.",
        code: "EXPIRED_API_KEY",
      });
      return;
    }

    // Attach tenant context to request
    req.tenant = {
      organizationId: row.organization_id,
      name: row.workspace_name ?? "Unknown",
      environment: row.workspace_environment ?? "production",
    };

    req.apiKeyInfo = {
      keyId: row.id,
      label: row.label,
      prefix: row.prefix,
    };

    // Fire-and-forget: update last_used_at (non-blocking)
    query(
      `UPDATE api_key SET last_used_at = now() WHERE id = $1`,
      [row.id],
    ).catch((err) => {
      console.error("[APIKey] Failed to update last_used_at:", err.message);
    });

    next();
  } catch (err) {
    console.error("[APIKey] Database error during verification:", err);
    res.status(500).json({
      error: "Internal error during API key verification.",
      code: "AUTH_INTERNAL_ERROR",
    });
  }
}
