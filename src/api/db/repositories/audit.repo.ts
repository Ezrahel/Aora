import type pg from "pg";
import pool, { query } from "../pool.ts";
import type { AuditLog } from "../../types.ts";

export interface AuditLogRow {
  id: string;
  workspace_id: string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before_state: any;
  after_state: any;
  created_at: string;
}

function rowToAudit(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    actor: row.actor,
    action: row.action as AuditLog["action"],
    entityType: row.entity_type as AuditLog["entityType"],
    entityId: row.entity_id,
    beforeState: row.before_state,
    afterState: row.after_state,
    createdAt: row.created_at,
  };
}

export async function findByWorkspace(
  workspaceId: string,
  filters: { entityType?: string; action?: string; q?: string } = {},
  limit = 50,
  offset = 0,
): Promise<{ rows: AuditLog[]; total: number }> {
  const conditions: string[] = ["workspace_id = $1"];
  const params: any[] = [workspaceId];
  let idx = 2;

  if (filters.entityType) { conditions.push(`entity_type = $${idx++}`); params.push(filters.entityType); }
  if (filters.action) { conditions.push(`action = $${idx++}`); params.push(filters.action); }
  if (filters.q) { conditions.push(`entity_id ILIKE $${idx++}`); params.push(`%${filters.q}%`); }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const { rows: countRows } = await query(
    `SELECT count(*)::int AS count FROM audit_logs ${where}`,
    params,
  );
  const { rows } = await query<AuditLogRow>(
    `SELECT id, workspace_id, actor, action, entity_type, entity_id, before_state, after_state, created_at
     FROM audit_logs ${where}
     ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset],
  );
  return { rows: rows.map(rowToAudit), total: countRows[0].count };
}

export async function create(
  client: pg.PoolClient | null,
  data: {
    id: string;
    workspaceId: string;
    actor: string;
    action: AuditLog["action"];
    entityType: AuditLog["entityType"];
    entityId: string;
    beforeState?: any;
    afterState?: any;
  },
): Promise<void> {
  await (client ?? pool).query(
    `INSERT INTO audit_logs (id, workspace_id, actor, action, entity_type, entity_id, before_state, after_state, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
    [
      data.id, data.workspaceId, data.actor, data.action, data.entityType, data.entityId,
      data.beforeState != null ? JSON.stringify(data.beforeState) : null,
      data.afterState != null ? JSON.stringify(data.afterState) : null,
    ],
  );
}

export const auditRepo = {
  findByWorkspace,
  create,
};
