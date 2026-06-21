import type pg from "pg";
import { query } from "../pool.ts";
import type { UsageEvent } from "../../types.ts";

export interface UsageEventRow {
  id: string;
  customer_id: string;
  meter_id: string;
  timestamp: string;
  value: number;
  metadata: any;
}

function rowToEvent(row: UsageEventRow): UsageEvent {
  return {
    id: row.id,
    customerId: row.customer_id,
    meterId: row.meter_id,
    timestamp: row.timestamp,
    value: Number(row.value),
    metadata: row.metadata ?? {},
  };
}

export async function findByWorkspace(
  customerIds: string[],
  filters: { customerId?: string; meterId?: string; from?: string; to?: string; q?: string } = {},
  limit = 50,
  offset = 0,
): Promise<{ rows: UsageEvent[]; total: number }> {
  if (customerIds.length === 0) return { rows: [], total: 0 };

  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  const placeholders = customerIds.map((_, i) => `$${idx + i}`).join(", ");
  conditions.push(`customer_id IN (${placeholders})`);
  params.push(...customerIds);
  idx += customerIds.length;

  if (filters.customerId) { conditions.push(`customer_id = $${idx++}`); params.push(filters.customerId); }
  if (filters.meterId) { conditions.push(`meter_id = $${idx++}`); params.push(filters.meterId); }
  if (filters.from) { conditions.push(`timestamp >= $${idx++}`); params.push(filters.from); }
  if (filters.to) { conditions.push(`timestamp <= $${idx++}`); params.push(filters.to); }
  if (filters.q) {
    conditions.push(`metadata::text ILIKE $${idx++}`);
    params.push(`%${filters.q}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows: countRows } = await query(
    `SELECT count(*)::int AS count FROM usage_events ${where}`,
    params,
  );
  const total = countRows[0].count;

  const { rows } = await query<UsageEventRow>(
    `SELECT id, customer_id, meter_id, timestamp, value, metadata
     FROM usage_events ${where}
     ORDER BY timestamp DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset],
  );
  return { rows: rows.map(rowToEvent), total };
}

export async function findById(id: string): Promise<UsageEvent | null> {
  const { rows } = await query<UsageEventRow>(
    "SELECT id, customer_id, meter_id, timestamp, value, metadata FROM usage_events WHERE id = $1",
    [id],
  );
  return rows[0] ? rowToEvent(rows[0]) : null;
}

export async function create(
  client: pg.PoolClient,
  data: {
    id: string;
    customerId: string;
    meterId: string;
    value: number;
    metadata?: any;
    timestamp?: string;
  },
): Promise<UsageEventRow> {
  const { rows } = await client.query<UsageEventRow>(
    `INSERT INTO usage_events (id, customer_id, meter_id, timestamp, value, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, customer_id, meter_id, timestamp, value, metadata`,
    [
      data.id, data.customerId, data.meterId,
      data.timestamp || new Date().toISOString(),
      data.value, JSON.stringify(data.metadata ?? {}),
    ],
  );
  return rows[0];
}

export async function bulkCreate(
  client: pg.PoolClient,
  events: Array<{
    id: string;
    customerId: string;
    meterId: string;
    value: number;
    metadata?: any;
    timestamp?: string;
  }>,
): Promise<void> {
  for (const evt of events) {
    await create(client, evt);
  }
}

export async function getAggregate(
  customerId: string,
  meterId: string,
  periodStart: string,
  periodEnd: string,
): Promise<number> {
  const { rows } = await query(
    `SELECT COALESCE(SUM(value), 0) AS total
     FROM usage_events
     WHERE customer_id = $1 AND meter_id = $2
       AND timestamp >= $3 AND timestamp < $4`,
    [customerId, meterId, periodStart, periodEnd],
  );
  return Number(rows[0].total);
}

export async function checkIdempotency(
  dedupeKey: string,
): Promise<boolean> {
  const { rows } = await query(
    `SELECT 1 FROM usage_events
     WHERE metadata->>'idempotencyKey' = $1 OR metadata->>'dedupeId' = $1
     LIMIT 1`,
    [dedupeKey],
  );
  return rows.length > 0;
}

export const usageRepo = {
  findByWorkspace,
  findById,
  create,
  bulkCreate,
  getAggregate,
  checkIdempotency,
};
