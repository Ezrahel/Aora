import type pg from "pg";
import { query } from "../pool.ts";
import type { MeterDefinition } from "../../types.ts";

export interface MeterRow {
  id: string;
  name: string;
  description: string;
  aggregation_type: string;
  target_field: string;
  slug: string | null;
  event_source: string | null;
  unit: string | null;
  status: string;
}

function rowToMeter(row: MeterRow): MeterDefinition {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    aggregationType: row.aggregation_type as MeterDefinition["aggregationType"],
    targetField: row.target_field,
    slug: row.slug ?? undefined,
    eventSource: row.event_source ?? undefined,
    unit: row.unit ?? undefined,
    status: (row.status ?? "active") as MeterDefinition["status"],
  };
}

export async function findAll(showArchived = true): Promise<MeterDefinition[]> {
  let sql = "SELECT id, name, description, aggregation_type, target_field, slug, event_source, unit, status FROM meter_definitions";
  if (!showArchived) sql += " WHERE status != 'archived'";
  sql += " ORDER BY name";
  const { rows } = await query<MeterRow>(sql);
  return rows.map(rowToMeter);
}

export async function findById(
  client: pg.PoolClient,
  id: string,
): Promise<MeterDefinition | null> {
  const { rows } = await client.query<MeterRow>(
    "SELECT id, name, description, aggregation_type, target_field, slug, event_source, unit, status FROM meter_definitions WHERE id = $1",
    [id],
  );
  return rows[0] ? rowToMeter(rows[0]) : null;
}

export async function create(
  client: pg.PoolClient,
  data: {
    id: string;
    name: string;
    description?: string;
    aggregationType: MeterDefinition["aggregationType"];
    targetField: string;
    slug?: string;
    unit?: string;
  },
): Promise<MeterDefinition> {
  const { rows } = await client.query<MeterRow>(
    `INSERT INTO meter_definitions (id, name, description, aggregation_type, target_field, slug, unit, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
     RETURNING id, name, description, aggregation_type, target_field, slug, event_source, unit, status`,
    [data.id, data.name, data.description ?? "", data.aggregationType, data.targetField, data.slug ?? data.id, data.unit ?? null],
  );
  return rowToMeter(rows[0]);
}

export async function update(
  client: pg.PoolClient,
  id: string,
  data: Partial<{
    name: string;
    description: string;
    aggregationType: MeterDefinition["aggregationType"];
    targetField: string;
    unit: string;
    status: MeterDefinition["status"];
  }>,
): Promise<MeterDefinition | null> {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;
  if (data.name !== undefined) { sets.push(`name = $${idx++}`); params.push(data.name.trim()); }
  if (data.description !== undefined) { sets.push(`description = $${idx++}`); params.push(data.description); }
  if (data.aggregationType !== undefined) { sets.push(`aggregation_type = $${idx++}`); params.push(data.aggregationType); }
  if (data.targetField !== undefined) { sets.push(`target_field = $${idx++}`); params.push(data.targetField.trim()); }
  if (data.unit !== undefined) { sets.push(`unit = $${idx++}`); params.push(data.unit); }
  if (data.status !== undefined) { sets.push(`status = $${idx++}`); params.push(data.status); }
  if (sets.length === 0) return findById(client, id);
  params.push(id);
  const { rows } = await client.query<MeterRow>(
    `UPDATE meter_definitions SET ${sets.join(", ")} WHERE id = $${idx}
     RETURNING id, name, description, aggregation_type, target_field, slug, event_source, unit, status`,
    params,
  );
  return rows[0] ? rowToMeter(rows[0]) : null;
}

export async function softDelete(client: pg.PoolClient, id: string): Promise<void> {
  await client.query("UPDATE meter_definitions SET status = 'archived' WHERE id = $1", [id]);
}

export const meterRepo = {
  findAll,
  findById,
  create,
  update,
  softDelete,
};
