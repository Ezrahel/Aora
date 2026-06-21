// @ts-nocheck

import { Router } from "express";
import {
  resolveWorkspace,
  writeAuditLog,
  nanoid,
  genId,
  workspaceRepo,
  organizationRepo,
  memberRepo,
  auditRepo,
} from "../db.ts";
import { asyncHandler, parsePagination, paginateArray, badRequest, notFound, conflict } from "../middleware.ts";
import type { Member } from "../types.ts";

export const router = Router();

router.get("/workspaces", asyncHandler(async (_req, res) => {
  const workspaces = await workspaceRepo.findAll();
  res.json(workspaces);
}));

router.get("/workspace-info", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  const org = ws ? await organizationRepo.findById(null as any, ws.organizationId) : null;
  const members = ws ? await memberRepo.findByWorkspace(ws.id) : [];

  res.json({
    workspace: ws,
    organization: org,
    members,
    telemetryStatus: "Operational",
    tenantId: ws?.id,
    environmentMode: ws?.environment,
    apiIssued: ws?.apiKeys ?? [],
  });
}));

router.get("/workspaces/:id", asyncHandler(async (req, res) => {
  const wss = await workspaceRepo.findAll();
  const ws = wss.find((w) => w.id === req.params.id);
  if (!ws) return notFound(res, "Workspace");
  res.json(ws);
}));

router.put("/workspaces/:id", asyncHandler(async (req, res) => {
  const wss = await workspaceRepo.findAll();
  const ws = wss.find((w) => w.id === req.params.id);
  if (!ws) return notFound(res, "Workspace");

  const { name, environment, profile, settings } = req.body as {
    name?: string;
    environment?: "production" | "sandbox" | "development";
    profile?: Record<string, any>;
    settings?: Record<string, any>;
  };

  const validEnvs = ["production", "sandbox", "development"] as const;
  if (environment && !validEnvs.includes(environment)) {
    return badRequest(res, `environment must be one of: ${validEnvs.join(", ")}`);
  }

  const before = { ...ws };
  const updated = await workspaceRepo.update(null as any, req.params.id, {
    name, environment, profile, settings,
  });
  if (!updated) return notFound(res, "Workspace");
  await writeAuditLog(ws.id, "Admin", "UPDATE", "WORKSPACE", ws.id, before, updated);
  res.json(updated);
}));

router.post("/workspaces/:id/rotate-key", asyncHandler(async (req, res) => {
  const wss = await workspaceRepo.findAll();
  const ws = wss.find((w) => w.id === req.params.id);
  if (!ws) return notFound(res, "Workspace");

  const prefix = ws.environment === "production" ? "sk_live_" : "sk_test_";
  const newKey = prefix + nanoid();
  await workspaceRepo.rotateKey(null as any, ws.id, newKey);

  await writeAuditLog(ws.id, "Admin", "UPDATE", "WORKSPACE", ws.id, null, { rotatedKey: newKey });
  res.json({ key: newKey, total: ws.apiKeys.length + 1 });
}));

// ── Members ────────────────────────────────────────────────

const VALID_ROLES: Member["role"][] = [
  "owner", "admin", "billing_manager", "developer", "viewer",
];

router.get("/members", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  if (!ws) return notFound(res, "Workspace");
  const members = await memberRepo.findByWorkspace(ws.id);
  const opts = parsePagination(req);
  res.json(paginateArray(members, opts));
}));

router.post("/members", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  if (!ws) return notFound(res, "Workspace");
  const { email, role, permissions } = req.body as {
    email?: string;
    role?: string;
    permissions?: string[];
  };

  if (!email || !email.trim()) return badRequest(res, "email is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return badRequest(res, "email is not a valid email address.");
  if (!role || !VALID_ROLES.includes(role as Member["role"])) return badRequest(res, `role must be one of: ${VALID_ROLES.join(", ")}`);

  const existing = await memberRepo.findByEmail(ws.id, email.trim().toLowerCase());
  if (existing) return conflict(res, `A member with email '${email.trim()}' already exists.`);

  const newMember = await memberRepo.create(null as any, {
    id: genId("mem_"),
    workspaceId: ws.id,
    email: email.trim().toLowerCase(),
    role: role as Member["role"],
    permissions: Array.isArray(permissions) ? permissions : [],
  });

  await writeAuditLog(ws.id, "Admin", "CREATE", "MEMBER", newMember.id, null, newMember);
  res.status(201).json(newMember);
}));

router.put("/members/:id", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  if (!ws) return notFound(res, "Workspace");
  const member = await memberRepo.findById(null as any, req.params.id);
  if (!member || member.workspaceId !== ws.id) return notFound(res, "Member");

  const { role, permissions } = req.body as { role?: string; permissions?: string[] };
  if (role !== undefined && !VALID_ROLES.includes(role as Member["role"])) {
    return badRequest(res, `role must be one of: ${VALID_ROLES.join(", ")}`);
  }

  const before = { ...member };
  const updated = await memberRepo.update(null as any, member.id, {
    role: role as Member["role"] | undefined,
    permissions: Array.isArray(permissions) ? permissions : undefined,
  });
  if (!updated) return notFound(res, "Member");
  await writeAuditLog(ws.id, "Admin", "UPDATE", "MEMBER", member.id, before, updated);
  res.json(updated);
}));

router.delete("/members/:id", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  if (!ws) return notFound(res, "Workspace");
  const member = await memberRepo.findById(null as any, req.params.id);
  if (!member || member.workspaceId !== ws.id) return notFound(res, "Member");

  if (member.role === "owner") {
    const ownerCount = await memberRepo.countOwners(ws.id);
    if (ownerCount <= 1) {
      return badRequest(res, "Cannot remove the last owner. Promote another member to owner first.", "LAST_OWNER");
    }
  }

  await memberRepo.remove(null as any, member.id);
  await writeAuditLog(ws.id, "Admin", "DELETE", "MEMBER", member.id, member, null);
  res.json({ deleted: true, id: member.id });
}));

// ── Audit Logs ─────────────────────────────────────────────

router.get("/audit-logs", asyncHandler(async (req, res) => {
  const ws = await resolveWorkspace(req);
  if (!ws) return notFound(res, "Workspace");
  const { entityType, action, q } = req.query as { entityType?: string; action?: string; q?: string };
  const pagination = parsePagination(req);
  const result = await auditRepo.findByWorkspace(ws.id, { entityType, action, q }, pagination.limit, pagination.offset);

  res.json({
    data: result.rows,
    total: result.total,
    page: pagination.page,
    limit: pagination.limit,
    hasMore: pagination.offset + pagination.limit < result.total,
  });
}));

export default router;
