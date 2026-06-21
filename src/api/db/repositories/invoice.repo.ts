import type pg from "pg";
import pool, { query } from "../pool.ts";
import type { Invoice } from "../../types.ts";

export interface InvoiceRow {
  id: string;
  workspace_id: string;
  customer_id: string;
  subscription_id: string | null;
  amount: number;
  currency: string;
  status: string;
  usage_units: number;
  period_start: string | null;
  period_end: string | null;
  issued_at: string | null;
  finalized_at: string | null;
  paid_at: string | null;
  voided_at: string | null;
  line_items: any;
  metadata: any;
  created_at: string;
}

function rowToInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    amount: Number(row.amount),
    currency: row.currency,
    date: row.created_at.slice(0, 10),
    status: row.status as Invoice["status"],
    usageUnits: Number(row.usage_units),
    customerId: row.customer_id,
    periodStart: row.period_start ?? undefined,
    periodEnd: row.period_end ?? undefined,
    finalizedAt: row.finalized_at ?? undefined,
    paidAt: row.paid_at ?? undefined,
    voidedAt: row.voided_at ?? undefined,
    lineItems: row.line_items ?? [],
  };
}

export async function findByWorkspace(
  workspaceId: string,
  filters: { status?: string; customerId?: string; from?: string; to?: string } = {},
  limit = 50,
  offset = 0,
): Promise<{ rows: InvoiceRow[]; total: number }> {
  const conditions: string[] = ["workspace_id = $1"];
  const params: any[] = [workspaceId];
  let idx = 2;

  if (filters.status) { conditions.push(`status = $${idx++}`); params.push(filters.status); }
  if (filters.customerId) { conditions.push(`customer_id = $${idx++}`); params.push(filters.customerId); }
  if (filters.from) { conditions.push(`created_at >= $${idx++}`); params.push(filters.from); }
  if (filters.to) { conditions.push(`created_at <= $${idx++}`); params.push(filters.to); }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const { rows: countRows } = await query(
    `SELECT count(*)::int AS count FROM invoices ${where}`,
    params,
  );
  const { rows } = await query<InvoiceRow>(
    `SELECT id, workspace_id, customer_id, subscription_id, amount, currency, status,
       usage_units, period_start, period_end, issued_at, finalized_at, paid_at,
       voided_at, line_items, metadata, created_at
     FROM invoices ${where}
     ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset],
  );
  return { rows, total: countRows[0].count };
}

export async function findById(
  client: pg.PoolClient | null,
  id: string,
): Promise<InvoiceRow | null> {
  const { rows } = await (client ?? pool).query<InvoiceRow>(
    `SELECT id, workspace_id, customer_id, subscription_id, amount, currency, status,
       usage_units, period_start, period_end, issued_at, finalized_at, paid_at,
       voided_at, line_items, metadata, created_at
     FROM invoices WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function create(
  client: pg.PoolClient | null,
  data: {
    id: string;
    workspaceId: string;
    customerId: string;
    subscriptionId?: string;
    amount: number;
    currency: string;
    status: Invoice["status"];
    usageUnits: number;
    periodStart?: string;
    periodEnd?: string;
    lineItems?: any[];
    metadata?: any;
  },
): Promise<InvoiceRow> {
  const { rows } = await (client ?? pool).query<InvoiceRow>(
    `INSERT INTO invoices (id, workspace_id, customer_id, subscription_id, amount, currency, status,
       usage_units, period_start, period_end, line_items, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
     RETURNING id, workspace_id, customer_id, subscription_id, amount, currency, status,
       usage_units, period_start, period_end, issued_at, finalized_at, paid_at,
       voided_at, line_items, metadata, created_at`,
    [
      data.id, data.workspaceId, data.customerId, data.subscriptionId ?? null,
      data.amount, data.currency, data.status, data.usageUnits,
      data.periodStart ?? null, data.periodEnd ?? null,
      JSON.stringify(data.lineItems ?? []), JSON.stringify(data.metadata ?? {}),
    ],
  );
  return rows[0];
}

export async function update(
  client: pg.PoolClient | null,
  id: string,
  data: Partial<{
    amount: number;
    currency: string;
    usageUnits: number;
    status: Invoice["status"];
    lineItems: any[];
  }>,
): Promise<InvoiceRow | null> {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;
  if (data.amount !== undefined) { sets.push(`amount = $${idx++}`); params.push(data.amount); }
  if (data.currency !== undefined) { sets.push(`currency = $${idx++}`); params.push(data.currency); }
  if (data.usageUnits !== undefined) { sets.push(`usage_units = $${idx++}`); params.push(data.usageUnits); }
  if (data.status !== undefined) { sets.push(`status = $${idx++}`); params.push(data.status); }
  if (data.lineItems !== undefined) { sets.push(`line_items = $${idx++}`); params.push(JSON.stringify(data.lineItems)); }
  if (sets.length === 0) return findById(client, id);
  params.push(id);
  const { rows } = await (client ?? pool).query<InvoiceRow>(
    `UPDATE invoices SET ${sets.join(", ")} WHERE id = $${idx}
     RETURNING id, workspace_id, customer_id, subscription_id, amount, currency, status,
       usage_units, period_start, period_end, issued_at, finalized_at, paid_at,
       voided_at, line_items, metadata, created_at`,
    params,
  );
  return rows[0] ?? null;
}

export async function patchStatus(
  client: pg.PoolClient | null,
  id: string,
  status: Invoice["status"],
): Promise<InvoiceRow | null> {
  const sets: string[] = [`status = $1`];
  const params: any[] = [status];
  if (status === "paid") { sets.push("paid_at = now()"); }
  if (status === "void") { sets.push("voided_at = now()"); }
  if (status === "open") { sets.push("finalized_at = now()"); }
  params.push(id);
  const { rows } = await (client ?? pool).query<InvoiceRow>(
    `UPDATE invoices SET ${sets.join(", ")} WHERE id = $${params.length}
     RETURNING id, workspace_id, customer_id, subscription_id, amount, currency, status,
       usage_units, period_start, period_end, issued_at, finalized_at, paid_at,
       voided_at, line_items, metadata, created_at`,
    params,
  );
  return rows[0] ?? null;
}

export const invoiceRepo = {
  findByWorkspace,
  findById,
  create,
  update,
  patchStatus,
};
