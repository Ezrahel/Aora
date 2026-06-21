// ============================================================
// Aora Billing OS — Database Module
// CockroachDB-backed. All exports are async where they touch
// the database. Legacy synchronous `db` object is removed.
// Route files now use repository functions directly.
// ============================================================

import type { Request } from "express";
import type { AuditLog } from "./types.ts";
import {
  pool,
  query,
  withTransaction,
  retryable,
  runMigrations,
  workspaceRepo,
  auditRepo,
  organizationRepo,
  memberRepo,
  productRepo,
  featureRepo,
  planRepo,
  entitlementRepo,
  customerRepo,
  subscriptionRepo,
  meterRepo,
  usageRepo,
  quotaRepo,
  creditRepo,
  invoiceRepo,
  priceRepo,
  rateCardRepo,
  discountRepo,
  couponRepo,
  contractRepo,
  webhookRepo,
} from "./db/index.ts";

// ── ID generators (synchronous, not DB-bound) ──────────────

export function nanoid(prefix = ""): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function genId(prefix = ""): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── Chat message log (in-memory, not persisted to DB) ──────

export let chatMessageLog: { role: "user" | "model" | "system"; text: string; id: string; metadata?: any }[] = [
  {
    id: "chat_0",
    role: "system",
    text: "You are the Premium Billing Assistant, representing an operating system that operates precisely like Stripe, Paddle and Lago combined.",
  },
];

export function getChatMessages() {
  return chatMessageLog;
}

export function addChatMessage(role: "user" | "model" | "system", text: string, metadata?: any) {
  const id = "chat_" + Date.now();
  chatMessageLog.push({ id, role, text, metadata });
  return { id, role, text, metadata };
}

// ── Workspace Resolution ───────────────────────────────────

export async function resolveWorkspace(req: Request) {
  const wsQuery = (req.query.workspace as string) ||
                 (req.headers["x-workspace-id"] as string);
  if (wsQuery) {
    const matched = await workspaceRepo.resolveWorkspace(wsQuery);
    if (matched) return matched;
  }
  const all = await workspaceRepo.findAll();
  return all[0] ?? null;
}

// ── Audit Logging ──────────────────────────────────────────

export async function writeAuditLog(
  workspaceId: string,
  actor: string,
  action: AuditLog["action"],
  entityType: AuditLog["entityType"],
  entityId: string,
  before: any,
  after: any,
) {
  try {
    await withTransaction(async (client) => {
      await auditRepo.create(client, {
        id: "aud_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        workspaceId,
        actor: actor || "System",
        action,
        entityType,
        entityId,
        beforeState: before ? JSON.parse(JSON.stringify(before)) : null,
        afterState: after ? JSON.parse(JSON.stringify(after)) : null,
      });
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

// ── saveDatabase no-op ────────────────────────────────────

export function saveDatabase() {
  // No-op: CockroachDB persists every transaction atomically.
  // Call this during migration only if dual-writing to JSON.
}

// ── Date/number helpers ────────────────────────────────────

export function addMonths(date: string, months: number): string {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

export function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function toNum(val: any, fallback: number): number {
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

// ── Re-export all repository functions ─────────────────────

export { pool, withTransaction, retryable, query };

export {
  runMigrations,
  organizationRepo,
  workspaceRepo,
  memberRepo,
  productRepo,
  featureRepo,
  planRepo,
  entitlementRepo,
  customerRepo,
  subscriptionRepo,
  meterRepo,
  usageRepo,
  quotaRepo,
  creditRepo,
  invoiceRepo,
  priceRepo,
  rateCardRepo,
  discountRepo,
  couponRepo,
  contractRepo,
  webhookRepo,
  auditRepo,
};
