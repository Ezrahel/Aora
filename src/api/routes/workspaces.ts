// ============================================================
// Aora Billing OS — Workspaces, Members & Audit Log Routes
// ============================================================

import { Router } from "express";
import { db, saveDatabase, writeAuditLog, resolveWorkspace, nanoid } from "../db.ts";
import { parsePagination, paginateArray, badRequest, notFound, conflict, genId, toNum } from "../middleware.ts";
import type { Member } from "../types.ts";

const router = Router();

// ── Workspaces ─────────────────────────────────────────────────

// GET /workspaces — all workspaces
router.get("/workspaces", (_req, res) => {
  res.json(db.workspaces);
});

// GET /workspace-info — full workspace context
router.get("/workspace-info", (req, res) => {
  const ws = resolveWorkspace(req);
  const organization = db.organizations.find((o) => o.id === ws.organizationId) ?? null;
  const members = db.members.filter((m) => m.workspaceId === ws.id);

  res.json({
    workspace: ws,
    organization,
    members,
    telemetryStatus: "Operational",
    tenantId: ws.id,
    environmentMode: ws.environment,
    apiIssued: ws.apiKeys,
  });
});

// GET /workspaces/:id — single workspace
router.get("/workspaces/:id", (req, res) => {
  const ws = db.workspaces.find((w) => w.id === req.params.id);
  if (!ws) return notFound(res, "Workspace");
  return res.json(ws);
});

// PUT /workspaces/:id — update workspace name / environment
router.put("/workspaces/:id", (req, res) => {
  const ws = db.workspaces.find((w) => w.id === req.params.id);
  if (!ws) return notFound(res, "Workspace");

  const { name, environment } = req.body as {
    name?: string;
    environment?: "production" | "sandbox" | "development";
  };

  const validEnvs = ["production", "sandbox", "development"] as const;
  if (environment && !validEnvs.includes(environment)) {
    return badRequest(res, `environment must be one of: ${validEnvs.join(", ")}`);
  }

  const before = { ...ws };
  if (name !== undefined) ws.name = name.trim();
  if (environment !== undefined) ws.environment = environment;

  saveDatabase();
  writeAuditLog(ws.id, "Admin", "UPDATE", "WORKSPACE", ws.id, before, ws);
  return res.json(ws);
});

// POST /workspaces/:id/rotate-key — generate and store a new API key
router.post("/workspaces/:id/rotate-key", (req, res) => {
  const ws = db.workspaces.find((w) => w.id === req.params.id);
  if (!ws) return notFound(res, "Workspace");

  const prefix = ws.environment === "production" ? "sk_live_" : "sk_test_";
  const newKey = prefix + nanoid();
  ws.apiKeys.push(newKey);

  saveDatabase();
  writeAuditLog(ws.id, "Admin", "UPDATE", "WORKSPACE", ws.id, null, { rotatedKey: newKey });
  return res.json({ key: newKey, total: ws.apiKeys.length });
});

// ── Members ────────────────────────────────────────────────────

const VALID_ROLES: Member["role"][] = [
  "owner", "admin", "billing_manager", "developer", "viewer",
];

// GET /members — members for resolved workspace, paginated
router.get("/members", (req, res) => {
  const ws = resolveWorkspace(req);
  const members = db.members.filter((m) => m.workspaceId === ws.id);
  const opts = parsePagination(req);
  return res.json(paginateArray(members, opts));
});

// POST /members — create a new member
router.post("/members", (req, res) => {
  const ws = resolveWorkspace(req);
  const { email, role, permissions } = req.body as {
    email?: string;
    role?: string;
    permissions?: string[];
  };

  if (!email || !email.trim()) {
    return badRequest(res, "email is required.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return badRequest(res, "email is not a valid email address.");
  }
  if (!role || !VALID_ROLES.includes(role as Member["role"])) {
    return badRequest(res, `role must be one of: ${VALID_ROLES.join(", ")}`);
  }

  const existing = db.members.find(
    (m) => m.workspaceId === ws.id && m.email.toLowerCase() === email.trim().toLowerCase(),
  );
  if (existing) {
    return conflict(res, `A member with email '${email.trim()}' already exists in this workspace.`);
  }

  const newMember: Member = {
    id: genId("mem_"),
    workspaceId: ws.id,
    email: email.trim().toLowerCase(),
    role: role as Member["role"],
    permissions: Array.isArray(permissions) ? permissions : [],
    createdAt: new Date().toISOString(),
  };

  db.members.push(newMember);
  saveDatabase();
  writeAuditLog(ws.id, "Admin", "CREATE", "MEMBER", newMember.id, null, newMember);
  return res.status(201).json(newMember);
});

// PUT /members/:id — update role / permissions
router.put("/members/:id", (req, res) => {
  const ws = resolveWorkspace(req);
  const member = db.members.find(
    (m) => m.id === req.params.id && m.workspaceId === ws.id,
  );
  if (!member) return notFound(res, "Member");

  const { role, permissions } = req.body as {
    role?: string;
    permissions?: string[];
  };

  if (role !== undefined && !VALID_ROLES.includes(role as Member["role"])) {
    return badRequest(res, `role must be one of: ${VALID_ROLES.join(", ")}`);
  }

  const before = { ...member };
  if (role !== undefined) member.role = role as Member["role"];
  if (Array.isArray(permissions)) member.permissions = permissions;

  saveDatabase();
  writeAuditLog(ws.id, "Admin", "UPDATE", "MEMBER", member.id, before, member);
  return res.json(member);
});

// DELETE /members/:id — remove member (protect last owner)
router.delete("/members/:id", (req, res) => {
  const ws = resolveWorkspace(req);
  const idx = db.members.findIndex(
    (m) => m.id === req.params.id && m.workspaceId === ws.id,
  );
  if (idx === -1) return notFound(res, "Member");

  const member = db.members[idx];

  if (member.role === "owner") {
    const ownerCount = db.members.filter(
      (m) => m.workspaceId === ws.id && m.role === "owner",
    ).length;
    if (ownerCount <= 1) {
      return badRequest(
        res,
        "Cannot remove the last owner of a workspace. Promote another member to owner first.",
        "LAST_OWNER",
      );
    }
  }

  const removed = db.members.splice(idx, 1)[0];
  saveDatabase();
  writeAuditLog(ws.id, "Admin", "DELETE", "MEMBER", removed.id, removed, null);
  return res.json({ deleted: true, id: removed.id });
});

// ── Audit Logs ─────────────────────────────────────────────────

// GET /audit-logs — paginated, optional ?entityType= filter
router.get("/audit-logs", (req, res) => {
  const ws = resolveWorkspace(req);
  const { entityType } = req.query as { entityType?: string };

  let logs = db.auditLogs.filter((l) => l.workspaceId === ws.id);
  if (entityType) {
    logs = logs.filter(
      (l) => l.entityType.toLowerCase() === entityType.toLowerCase(),
    );
  }

  const opts = parsePagination(req, 50);
  return res.json(paginateArray(logs, opts));
});

export default router;
