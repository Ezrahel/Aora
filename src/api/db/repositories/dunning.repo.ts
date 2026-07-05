// ============================================================
// Dunning Attempts Repository
// ============================================================

import type pg from "pg";
import pool, { query } from "../pool.ts";

export interface DunningRow {
  id: string;
  invoice_id: string;
  attempt_number: number;
  action: string;
  status: string;
  gateway_response: any;
  scheduled_at: string | null;
  executed_at: string | null;
  created_at: string;
}

export async function findByInvoice(invoiceId: string): Promise<DunningRow[]> {
  const { rows } = await query<DunningRow>(
    "SELECT * FROM dunning_attempts WHERE invoice_id = $1 ORDER BY attempt_number ASC",
    [invoiceId],
  );
  return rows;
}

export async function findScheduled(before: string): Promise<DunningRow[]> {
  const { rows } = await query<DunningRow>(
    "SELECT * FROM dunning_attempts WHERE status = 'pending' AND scheduled_at <= $1 ORDER BY scheduled_at ASC",
    [before],
  );
  return rows;
}

export async function create(client: pg.PoolClient | null, data: {
  id: string;
  invoiceId: string;
  attemptNumber: number;
  action: string;
  scheduledAt: string;
}): Promise<DunningRow> {
  const { rows } = await (client ?? pool).query<DunningRow>(
    `INSERT INTO dunning_attempts (id, invoice_id, attempt_number, action, status, scheduled_at, created_at)
     VALUES ($1, $2, $3, $4, 'pending', $5, now())
     RETURNING *`,
    [data.id, data.invoiceId, data.attemptNumber, data.action, data.scheduledAt],
  );
  return rows[0];
}

export async function updateStatus(
  client: pg.PoolClient | null,
  id: string,
  status: string,
  gatewayResponse?: any,
): Promise<void> {
  const sets: string[] = ["status = $1", "executed_at = now()"];
  const params: any[] = [status];
  if (gatewayResponse !== undefined) {
    sets.push(`gateway_response = $${params.length + 1}`);
    params.push(JSON.stringify(gatewayResponse));
  }
  params.push(id);
  await (client ?? pool).query(
    `UPDATE dunning_attempts SET ${sets.join(", ")} WHERE id = $${params.length}`,
    params,
  );
}

export async function markAllSkipped(
  client: pg.PoolClient | null,
  invoiceId: string,
): Promise<void> {
  await (client ?? pool).query(
    "UPDATE dunning_attempts SET status = 'skipped', executed_at = now() WHERE invoice_id = $1 AND status = 'pending'",
    [invoiceId],
  );
}

export const dunningRepo = {
  findByInvoice,
  findScheduled,
  create,
  updateStatus,
  markAllSkipped,
};
