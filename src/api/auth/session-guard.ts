import type { Request, Response, NextFunction } from "express";
import { getAuth } from "./auth-service.ts";

// ── Types ──────────────────────────────────────────────────

export type RequiredRole = "owner" | "admin" | "member";

export interface SessionGuardOptions {
  /** Minimum role required to access the route (default: member) */
  minimumRole?: RequiredRole;
  /** Whether to require an active organization context (default: true) */
  requireOrganization?: boolean;
  /** If true, only the owner role is allowed (default: false) */
  requireOwner?: boolean;
}

// ── Helpers ────────────────────────────────────────────────

const ROLE_HIERARCHY: Record<RequiredRole, number> = {
  member: 0,
  admin: 10,
  owner: 100,
};

function meetsRoleRequirement(
  userRole: string | undefined,
  minimumRole: RequiredRole,
): boolean {
  const userLevel = ROLE_HIERARCHY[userRole as RequiredRole] ?? -1;
  const requiredLevel = ROLE_HIERARCHY[minimumRole];
  return userLevel >= requiredLevel;
}

// ── Session & Tenant Verification ──────────────────────────

// Organization plugin extends the base session with `activeOrganizationId`
// and the user with `role`. These fields live in plugin types, so we
// surface them explicitly here.
export interface OrgEnrichedSession {
  session: {
    id: string;
    token: string;
    userId: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
    createdAt: Date;
    updatedAt: Date;
    activeOrganizationId?: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image?: string;
    createdAt: Date;
    updatedAt: Date;
    role?: "owner" | "admin" | "member";
  };
}

/**
 * Verify a Better Auth session from the request cookies.
 *
 * Returns the session and user if valid, null otherwise.
 */
export async function getDashboardSession(req: Request): Promise<OrgEnrichedSession | null> {
  const headers = new Headers();
  if (req.headers) {
    for (const [key, value] of Object.entries(req.headers)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const v of value) headers.append(key, v);
      } else {
        headers.set(key, value);
      }
    }
  }

  const session = await getAuth().api.getSession({
    headers,
  });

  if (!session) return null;
  return session as OrgEnrichedSession;
}

/**
 * Verify that the session's active organization matches the
 * organization being accessed in the request.
 */
export function verifyOrganizationAccess(
  session: NonNullable<Awaited<ReturnType<typeof getDashboardSession>>>,
  targetOrganizationId: string,
): boolean {
  return session.session.activeOrganizationId === targetOrganizationId;
}
// ── Express Middleware Factory ──────────────────────────────

/**
 * Middleware factory that protects dashboard API routes.
 *
 * Usage:
 * ```typescript
 * import { requireSession } from "../auth/session-guard.ts";
 *
 * router.get("/dashboard/stats", requireSession(), handler);
 * router.get("/admin", requireSession({ requireOwner: true }), handler);
 * ```
 */
export function requireSession(options: SessionGuardOptions = {}) {
  const {
    minimumRole = "member",
    requireOrganization = true,
    requireOwner = false,
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await getDashboardSession(req);

      if (!session) {
        res.status(401).json({
          error: "Authentication required. Please log in.",
          code: "NOT_AUTHENTICATED",
        });
        return;
      }

      const { user, session: sessionData } = session;

      // Role check
      if (requireOwner) {
        if (user.role !== "owner") {
          res.status(403).json({
            error: "This endpoint requires the owner role.",
            code: "FORBIDDEN",
          });
          return;
        }
      } else if (!meetsRoleRequirement(user.role, minimumRole)) {
        res.status(403).json({
          error: `Insufficient permissions. Minimum role required: ${minimumRole}.`,
          code: "INSUFFICIENT_ROLE",
        });
        return;
      }

      // Active organization check
      if (requireOrganization && !sessionData.activeOrganizationId) {
        res.status(400).json({
          error: "No active organization selected. Select a workspace first.",
          code: "NO_ACTIVE_ORGANIZATION",
        });
        return;
      }

      // Attach user context to request for downstream handlers
      (req as any).authUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        activeOrganizationId: sessionData.activeOrganizationId,
      };

      next();
    } catch (err) {
      console.error("[SessionGuard] Error verifying session:", err);
      res.status(500).json({
        error: "Internal error during session verification.",
        code: "SESSION_GUARD_ERROR",
      });
    }
  };
}

// ── Organization-Specific Guard ────────────────────────────

/**
 * Middleware that verifies the user has access to a specific
 * organization. The organization ID can be extracted from the
 * request params, query, or body.
 *
 * Usage:
 * ```typescript
 * router.get(
 *   "/organizations/:orgId/settings",
 *   requireSession(),
 *   requireOrganizationAccess("orgId"),
 *   handler,
 * );
 * ```
 */
export function requireOrganizationAccess(paramName: string = "orgId") {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const targetOrgId =
        req.params[paramName] ??
        (req.query as Record<string, string>)[paramName] ??
        (req.body as Record<string, string>)?.[paramName];

      if (!targetOrgId) {
        res.status(400).json({
          error: `Organization identifier (${paramName}) is required.`,
          code: "MISSING_ORG_ID",
        });
        return;
      }

      const authUser = (req as any).authUser;
      if (!authUser) {
        res.status(401).json({
          error: "Authentication required.",
          code: "NOT_AUTHENTICATED",
        });
        return;
      }

      if (authUser.activeOrganizationId !== targetOrgId) {
        res.status(403).json({
          error: "You do not have access to this organization.",
          code: "ORG_ACCESS_DENIED",
        });
        return;
      }

      next();
    } catch (err) {
      console.error("[OrgGuard] Error verifying organization access:", err);
      res.status(500).json({
        error: "Internal error during organization verification.",
        code: "ORG_GUARD_ERROR",
      });
    }
  };
}
