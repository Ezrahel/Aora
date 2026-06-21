import type pg from "pg";
import { query } from "../pool.ts";
import type { Discount } from "../../types.ts";

export interface DiscountRow {
  id: string;
  name: string;
  type: string;
  value: number;
  applies_to: string;
  duration: string;
  duration_months: number | null;
  is_deleted: boolean;
  created_at: string;
}

function rowToDiscount(row: DiscountRow): Discount {
  return {
    id: row.id,
    name: row.name,
    type: row.type as Discount["type"],
    value: Number(row.value),
    appliesTo: row.applies_to as Discount["appliesTo"],
    duration: row.duration as Discount["duration"],
    durationMonths: row.duration_months ?? undefined,
    isDeleted: row.is_deleted,
    createdAt: row.created_at,
  };
}

export async function findAll(): Promise<Discount[]> {
  const { rows } = await query<DiscountRow>(
    "SELECT id, name, type, value, applies_to, duration, duration_months, is_deleted, created_at FROM discounts WHERE NOT is_deleted ORDER BY created_at DESC",
  );
  return rows.map(rowToDiscount);
}

export async function findById(id: string): Promise<Discount | null> {
  const { rows } = await query<DiscountRow>(
    "SELECT id, name, type, value, applies_to, duration, duration_months, is_deleted, created_at FROM discounts WHERE id = $1",
    [id],
  );
  return rows[0] ? rowToDiscount(rows[0]) : null;
}

export async function create(client: pg.PoolClient, data: {
  id: string;
  name: string;
  type: Discount["type"];
  value: number;
  appliesTo?: Discount["appliesTo"];
  duration?: Discount["duration"];
  durationMonths?: number;
}): Promise<DiscountRow> {
  const { rows } = await client.query<DiscountRow>(
    `INSERT INTO discounts (id, name, type, value, applies_to, duration, duration_months, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,now())
     RETURNING id, name, type, value, applies_to, duration, duration_months, is_deleted, created_at`,
    [data.id, data.name, data.type, data.value, data.appliesTo ?? "all", data.duration ?? "once", data.durationMonths ?? null],
  );
  return rows[0];
}

export async function softDelete(client: pg.PoolClient, id: string): Promise<void> {
  await client.query("UPDATE discounts SET is_deleted = true WHERE id = $1", [id]);
}

export const discountRepo = {
  findAll,
  findById,
  create,
  softDelete,
};
