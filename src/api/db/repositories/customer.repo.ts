import type pg from "pg";
import { query } from "../pool.ts";
import type { Customer } from "../../types.ts";

export interface CustomerRow {
  id: string;
  workspace_id: string;
  name: string;
  domain: string;
  email: string;
  logo_color: string;
  created_date: string;
  plan_id: string;
  status: string;
  payment_method: any;
  seats_used: number;
  usage_units: number;
  notes: any;
  contracts: any;
  is_deleted: boolean;
  deleted_at: string | null;
}

function rowToCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    domain: row.domain,
    email: row.email,
    logoColor: row.logo_color,
    createdDate: row.created_date,
    planId: row.plan_id,
    status: row.status as Customer["status"],
    paymentMethod: row.payment_method,
    seatsUsed: row.seats_used,
    usageUnits: Number(row.usage_units),
    notes: row.notes ?? [],
    invoices: [],
    contracts: row.contracts ?? [],
  };
}

export async function findByWorkspace(
  workspaceId: string,
  filters: { status?: string; planId?: string; q?: string } = {},
): Promise<CustomerRow[]> {
  const conditions: string[] = ["workspace_id = $1", "NOT is_deleted"];
  const params: any[] = [workspaceId];
  let idx = 2;

  if (filters.status) { conditions.push(`status = $${idx++}`); params.push(filters.status); }
  if (filters.planId) { conditions.push(`plan_id = $${idx++}`); params.push(filters.planId); }
  if (filters.q) {
    const lower = filters.q.toLowerCase();
    conditions.push(`(LOWER(name) LIKE $${idx} OR LOWER(email) LIKE $${idx} OR LOWER(domain) LIKE $${idx})`);
    params.push(`%${lower}%`);
    idx++;
  }

  const { rows } = await query<CustomerRow>(
    `SELECT id, workspace_id, name, domain, email, logo_color, created_date, plan_id, status,
       payment_method, seats_used, usage_units, notes, contracts, is_deleted, deleted_at
     FROM customers WHERE ${conditions.join(" AND ")}
     ORDER BY created_date DESC`,
    params,
  );
  return rows;
}

export async function findById(
  client: pg.PoolClient,
  id: string,
): Promise<CustomerRow | null> {
  const { rows } = await client.query<CustomerRow>(
    `SELECT id, workspace_id, name, domain, email, logo_color, created_date, plan_id, status,
       payment_method, seats_used, usage_units, notes, contracts, is_deleted, deleted_at
     FROM customers WHERE id = $1 AND NOT is_deleted`,
    [id],
  );
  return rows[0] ?? null;
}

export async function create(
  client: pg.PoolClient,
  data: {
    id: string;
    workspaceId: string;
    name: string;
    email: string;
    domain?: string;
    logoColor?: string;
    planId: string;
    status: Customer["status"];
    seatsUsed?: number;
    notes?: any[];
    contracts?: any[];
  },
): Promise<CustomerRow> {
  const { rows } = await client.query<CustomerRow>(
    `INSERT INTO customers (id, workspace_id, name, domain, email, logo_color, plan_id, status, seats_used, usage_units, notes, contracts, created_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10, $11, current_date)
     RETURNING id, workspace_id, name, domain, email, logo_color, created_date, plan_id, status,
       payment_method, seats_used, usage_units, notes, contracts, is_deleted, deleted_at`,
    [
      data.id, data.workspaceId, data.name, data.domain ?? "", data.email,
      data.logoColor ?? "#6366f1", data.planId, data.status,
      data.seatsUsed ?? 1, JSON.stringify(data.notes ?? []), JSON.stringify(data.contracts ?? []),
    ],
  );
  return rows[0];
}

export async function update(
  client: pg.PoolClient,
  id: string,
  data: Partial<{
    name: string;
    email: string;
    domain: string;
    logoColor: string;
    planId: string;
    paymentMethod: any;
    status: Customer["status"];
  }>,
): Promise<CustomerRow | null> {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;
  if (data.name !== undefined) { sets.push(`name = $${idx++}`); params.push(data.name); }
  if (data.email !== undefined) { sets.push(`email = $${idx++}`); params.push(data.email); }
  if (data.domain !== undefined) { sets.push(`domain = $${idx++}`); params.push(data.domain); }
  if (data.logoColor !== undefined) { sets.push(`logo_color = $${idx++}`); params.push(data.logoColor); }
  if (data.planId !== undefined) { sets.push(`plan_id = $${idx++}`); params.push(data.planId); }
  if (data.paymentMethod !== undefined) { sets.push(`payment_method = $${idx++}`); params.push(JSON.stringify(data.paymentMethod)); }
  if (data.status !== undefined) { sets.push(`status = $${idx++}`); params.push(data.status); }
  if (sets.length === 0) return findById(client, id);
  params.push(id);
  const { rows } = await client.query<CustomerRow>(
    `UPDATE customers SET ${sets.join(", ")} WHERE id = $${idx} AND NOT is_deleted
     RETURNING id, workspace_id, name, domain, email, logo_color, created_date, plan_id, status,
       payment_method, seats_used, usage_units, notes, contracts, is_deleted, deleted_at`,
    params,
  );
  return rows[0] ?? null;
}

export async function softDelete(
  client: pg.PoolClient,
  id: string,
): Promise<void> {
  await client.query(
    "UPDATE customers SET is_deleted = true, deleted_at = now() WHERE id = $1",
    [id],
  );
}

export async function addNote(
  client: pg.PoolClient,
  customerId: string,
  note: any,
): Promise<void> {
  await client.query(
    "UPDATE customers SET notes = notes || $1::jsonb WHERE id = $2",
    [JSON.stringify([note]), customerId],
  );
}

export async function updateUsageUnits(
  client: pg.PoolClient,
  customerId: string,
  value: number,
): Promise<void> {
  await client.query(
    "UPDATE customers SET usage_units = usage_units + $1 WHERE id = $2",
    [value, customerId],
  );
}

export const customerRepo = {
  findByWorkspace,
  findById,
  create,
  update,
  softDelete,
  addNote,
  updateUsageUnits,
};
