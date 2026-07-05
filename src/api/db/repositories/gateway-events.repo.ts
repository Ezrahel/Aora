// ============================================================
// Gateway Events Repository (append-only)
// ============================================================

import pool, { query } from "../pool.ts";
import type pg from "pg";

export interface GatewayEventRow {
  id: string;
  workspace_id: string;
  gateway: string;
  event_type: string;
  gateway_event_id: string;
  customer_id: string | null;
  raw_payload: any;
  mapped_data: any;
  status: string;
  error_message: string | null;
  attempt_count: number;
  processed_at: string | null;
  created_at: string;
}

export async function create(
  data: {
    id: string;
    workspaceId: string;
    gateway: string;
    eventType: string;
    gatewayEventId: string;
    customerId?: string;
    rawPayload: any;
    mappedData?: any;
  },
): Promise<GatewayEventRow> {
  const { rows } = await query<GatewayEventRow>(
    `INSERT INTO gateway_events
       (id, workspace_id, gateway, event_type, gateway_event_id, customer_id, raw_payload, mapped_data, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'received', now())
     ON CONFLICT (gateway, gateway_event_id) DO NOTHING
     RETURNING *`,
    [
      data.id, data.workspaceId, data.gateway, data.eventType, data.gatewayEventId,
      data.customerId ?? null, JSON.stringify(data.rawPayload),
      data.mappedData ? JSON.stringify(data.mappedData) : null,
    ],
  );
  return rows[0];
}

export async function findByWorkspace(
  workspaceId: string,
  filters: { gateway?: string; eventType?: string; status?: string; from?: string; to?: string; customerId?: string } = {},
  limit = 50,
  offset = 0,
): Promise<{ rows: GatewayEventRow[]; total: number }> {
  const conditions: string[] = ["workspace_id = $1"];
  const params: any[] = [workspaceId];
  let idx = 2;

  if (filters.gateway) { conditions.push(`gateway = $${idx++}`); params.push(filters.gateway); }
  if (filters.eventType) { conditions.push(`event_type = $${idx++}`); params.push(filters.eventType); }
  if (filters.status) { conditions.push(`status = $${idx++}`); params.push(filters.status); }
  if (filters.from) { conditions.push(`created_at >= $${idx++}`); params.push(filters.from); }
  if (filters.to) { conditions.push(`created_at <= $${idx++}`); params.push(filters.to); }
  if (filters.customerId) { conditions.push(`customer_id = $${idx++}`); params.push(filters.customerId); }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const { rows: countRows } = await query(
    `SELECT count(*)::int AS count FROM gateway_events ${where}`,
    params,
  );

  const { rows } = await query<GatewayEventRow>(
    `SELECT * FROM gateway_events ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset],
  );

  return { rows, total: countRows[0].count };
}

export async function findById(id: string): Promise<GatewayEventRow | null> {
  const { rows } = await query<GatewayEventRow>(
    "SELECT * FROM gateway_events WHERE id = $1",
    [id],
  );
  return rows[0] ?? null;
}

export async function findUnprocessed(limit = 20): Promise<GatewayEventRow[]> {
  const { rows } = await query<GatewayEventRow>(
    "SELECT * FROM gateway_events WHERE status = 'received' AND attempt_count < 5 ORDER BY created_at ASC LIMIT $1",
    [limit],
  );
  return rows;
}

export async function markProcessed(client: pg.PoolClient | null, id: string): Promise<void> {
  await (client ?? pool).query(
    "UPDATE gateway_events SET status = 'processed', processed_at = now(), attempt_count = attempt_count + 1 WHERE id = $1",
    [id],
  );
}

export async function markFailed(client: pg.PoolClient | null, id: string, error: string): Promise<void> {
  await (client ?? pool).query(
    "UPDATE gateway_events SET status = CASE WHEN attempt_count >= 4 THEN 'failed' ELSE 'received' END, error_message = $1, attempt_count = attempt_count + 1 WHERE id = $2",
    [error, id],
  );
}

export async function retryEvent(id: string): Promise<void> {
  await query(
    "UPDATE gateway_events SET status = 'received', error_message = null WHERE id = $1 AND status = 'failed'",
    [id],
  );
}

export const gatewayEventRepo = {
  create,
  findByWorkspace,
  findById,
  findUnprocessed,
  markProcessed,
  markFailed,
  retryEvent,
};
