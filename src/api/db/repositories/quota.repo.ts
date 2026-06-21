import type pg from "pg";
import { query } from "../pool.ts";
import type { Quota } from "../../types.ts";

export interface QuotaRow {
  id: string;
  customer_id: string;
  meter_id: string;
  limit_value: number;
  used_value: number;
  period: string;
  created_at: string;
}

function rowToQuota(row: QuotaRow): Quota {
  return {
    id: row.id,
    customerId: row.customer_id,
    meterId: row.meter_id,
    limitValue: Number(row.limit_value),
    usedValue: Number(row.used_value),
    period: row.period as Quota["period"],
    createdAt: row.created_at,
  };
}

export async function findByCustomerIds(
  customerIds: string[],
  customerId?: string,
): Promise<Quota[]> {
  if (customerIds.length === 0) return [];
  const params: any[] = [...customerIds];
  const placeholders = customerIds.map((_, i) => `$${i + 1}`).join(", ");
  let sql = `SELECT id, customer_id, meter_id, limit_value, used_value, period, created_at FROM quotas WHERE customer_id IN (${placeholders})`;
  if (customerId) {
    params.push(customerId);
    sql += ` AND customer_id = $${params.length}`;
  }
  const { rows } = await query<QuotaRow>(sql, params);
  return rows.map(rowToQuota);
}

export async function findByCustomerAndMeter(
  customerId: string,
  meterId: string,
): Promise<Quota | null> {
  const { rows } = await query<QuotaRow>(
    "SELECT id, customer_id, meter_id, limit_value, used_value, period, created_at FROM quotas WHERE customer_id = $1 AND meter_id = $2",
    [customerId, meterId],
  );
  return rows[0] ? rowToQuota(rows[0]) : null;
}

export async function upsert(
  client: pg.PoolClient,
  data: {
    id: string;
    customerId: string;
    meterId: string;
    limitValue: number;
    usedValue: number;
    period: Quota["period"];
    createdAt: string;
  },
): Promise<QuotaRow> {
  const { rows } = await client.query<QuotaRow>(
    `UPSERT INTO quotas (id, customer_id, meter_id, limit_value, used_value, period, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, customer_id, meter_id, limit_value, used_value, period, created_at`,
    [data.id, data.customerId, data.meterId, data.limitValue, data.usedValue, data.period, data.createdAt],
  );
  return rows[0];
}

export async function incrementUsed(
  client: pg.PoolClient,
  customerId: string,
  meterId: string,
  value: number,
): Promise<void> {
  await client.query(
    "UPDATE quotas SET used_value = used_value + $1 WHERE customer_id = $2 AND meter_id = $3",
    [value, customerId, meterId],
  );
}

export async function remove(client: pg.PoolClient, id: string): Promise<void> {
  await client.query("DELETE FROM quotas WHERE id = $1", [id]);
}

export const quotaRepo = {
  findByCustomerIds,
  findByCustomerAndMeter,
  upsert,
  incrementUsed,
  remove,
};
