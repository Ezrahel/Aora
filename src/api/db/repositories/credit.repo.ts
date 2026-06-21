import type pg from "pg";
import pool, { query } from "../pool.ts";
import type { CreditLedgerEntry } from "../../types.ts";

export interface CreditLedgerRow {
  id: string;
  customer_id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
  expire_at: string | null;
}

function rowToEntry(row: CreditLedgerRow): CreditLedgerEntry {
  return {
    id: row.id,
    customerId: row.customer_id,
    amount: Number(row.amount),
    type: row.type as CreditLedgerEntry["type"],
    description: row.description,
    createdAt: row.created_at,
    expireAt: row.expire_at ?? undefined,
  };
}

export async function findByCustomerIds(
  customerIds: string[],
  customerId?: string,
): Promise<CreditLedgerEntry[]> {
  if (customerIds.length === 0) return [];
  const params: any[] = [...customerIds];
  const placeholders = customerIds.map((_, i) => `$${i + 1}`).join(", ");
  let sql = `SELECT id, customer_id, amount, type, description, created_at, expire_at
    FROM credit_ledger WHERE customer_id IN (${placeholders}) ORDER BY created_at DESC`;
  if (customerId) {
    params.push(customerId);
    sql += ` AND customer_id = $${params.length}`;
  }
  const { rows } = await query<CreditLedgerRow>(sql, params);
  return rows.map(rowToEntry);
}

export async function create(
  client: pg.PoolClient | null,
  data: {
    id: string;
    customerId: string;
    amount: number;
    type: CreditLedgerEntry["type"];
    description: string;
    expireAt?: string;
  },
): Promise<CreditLedgerRow> {
  const doQuery = client ? client.query.bind(client) : query;
  const { rows } = await doQuery(
    `INSERT INTO credit_ledger (id, customer_id, amount, type, description, expire_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     RETURNING id, customer_id, amount, type, description, created_at, expire_at`,
    [data.id, data.customerId, data.amount, data.type, data.description, data.expireAt ?? null],
  );
  return rows[0];
}

export async function getBalance(
  customerId: string,
): Promise<number> {
  const { rows } = await query(
    "SELECT COALESCE(balance, 0) AS balance FROM credit_balances WHERE customer_id = $1",
    [customerId],
  );
  if (rows.length > 0) return Number(rows[0].balance);
  // Fallback: compute from ledger
  const { rows: ledgerRows } = await query(
    `SELECT COALESCE(SUM(CASE WHEN type = 'credit_issued' THEN amount ELSE -amount END), 0) AS balance
     FROM credit_ledger WHERE customer_id = $1`,
    [customerId],
  );
  return Number(ledgerRows[0].balance);
}

export async function refreshBalance(
  client: pg.PoolClient | null,
  customerId: string,
): Promise<void> {
  await (client ?? pool).query(
    `UPSERT INTO credit_balances (customer_id, balance, updated_at)
     SELECT $1, COALESCE(SUM(CASE WHEN type = 'credit_issued' THEN amount ELSE -amount END), 0), now()
     FROM credit_ledger WHERE customer_id = $1`,
    [customerId],
  );
}

export const creditRepo = {
  findByCustomerIds,
  create,
  getBalance,
  refreshBalance,
};
