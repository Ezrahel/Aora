import type pg from "pg";
import { query } from "../pool.ts";
import type { Plan } from "../../types.ts";

export interface PlanRow {
  id: string;
  product_id: string;
  name: string;
  description: string;
  code: string | null;
  currency: string;
  price: number;
  billing_period: string;
  included_seats: number;
  included_usage: number;
  overage_unit_price: number;
  api_access: boolean;
  pricing_type: string | null;
  is_archived: boolean;
  created_at: string;
}

function rowToPlan(row: PlanRow): Plan {
  return {
    id: row.id,
    productId: row.product_id,
    name: row.name,
    description: row.description,
    code: row.code ?? undefined,
    currency: row.currency,
    price: Number(row.price),
    billingPeriod: row.billing_period as Plan["billingPeriod"],
    includedSeats: row.included_seats,
    includedUsage: Number(row.included_usage),
    overageUnitPrice: Number(row.overage_unit_price),
    apiAccess: row.api_access,
    pricingType: (row.pricing_type ?? undefined) as Plan["pricingType"] | undefined,
    isArchived: row.is_archived,
    createdAt: row.created_at,
  };
}

export async function findAll(showArchived = true): Promise<Plan[]> {
  let sql = "SELECT id, product_id, name, description, code, currency, price, billing_period, included_seats, included_usage, overage_unit_price, api_access, pricing_type, is_archived, created_at FROM plans";
  if (!showArchived) sql += " WHERE NOT is_archived";
  sql += " ORDER BY created_at DESC";
  const { rows } = await query<PlanRow>(sql);
  return rows.map(rowToPlan);
}

export async function findById(
  client: pg.PoolClient,
  id: string,
): Promise<Plan | null> {
  const { rows } = await client.query<PlanRow>(
    "SELECT id, product_id, name, description, code, currency, price, billing_period, included_seats, included_usage, overage_unit_price, api_access, pricing_type, is_archived, created_at FROM plans WHERE id = $1",
    [id],
  );
  return rows[0] ? rowToPlan(rows[0]) : null;
}

export async function create(
  client: pg.PoolClient,
  data: Omit<Plan, "createdAt" | "isArchived">,
): Promise<Plan> {
  const { rows } = await client.query<PlanRow>(
    `INSERT INTO plans (id, product_id, name, description, code, currency, price, billing_period,
       included_seats, included_usage, overage_unit_price, api_access, pricing_type, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
     RETURNING id, product_id, name, description, code, currency, price, billing_period,
       included_seats, included_usage, overage_unit_price, api_access, pricing_type, is_archived, created_at`,
    [
      data.id, data.productId, data.name, data.description || "", data.code || null,
      data.currency, data.price, data.billingPeriod,
      data.includedSeats, data.includedUsage, data.overageUnitPrice,
      data.apiAccess, data.pricingType || null,
    ],
  );
  return rowToPlan(rows[0]);
}

export async function update(
  client: pg.PoolClient,
  id: string,
  data: Partial<Omit<Plan, "id" | "createdAt" | "isArchived">>,
): Promise<Plan | null> {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;
  if (data.name !== undefined) { sets.push(`name = $${idx++}`); params.push(data.name.trim()); }
  if (data.price !== undefined) { sets.push(`price = $${idx++}`); params.push(data.price); }
  if (data.currency !== undefined) { sets.push(`currency = $${idx++}`); params.push(data.currency); }
  if (data.description !== undefined) { sets.push(`description = $${idx++}`); params.push(data.description); }
  if (data.billingPeriod !== undefined) { sets.push(`billing_period = $${idx++}`); params.push(data.billingPeriod); }
  if (data.includedSeats !== undefined) { sets.push(`included_seats = $${idx++}`); params.push(data.includedSeats); }
  if (data.includedUsage !== undefined) { sets.push(`included_usage = $${idx++}`); params.push(data.includedUsage); }
  if (data.apiAccess !== undefined) { sets.push(`api_access = $${idx++}`); params.push(data.apiAccess); }
  if (data.overageUnitPrice !== undefined) { sets.push(`overage_unit_price = $${idx++}`); params.push(data.overageUnitPrice); }
  if (data.pricingType !== undefined) { sets.push(`pricing_type = $${idx++}`); params.push(data.pricingType); }
  if (sets.length === 0) return findById(client, id);
  params.push(id);
  const { rows } = await client.query<PlanRow>(
    `UPDATE plans SET ${sets.join(", ")} WHERE id = $${idx} RETURNING id, product_id, name, description, code, currency, price, billing_period, included_seats, included_usage, overage_unit_price, api_access, pricing_type, is_archived, created_at`,
    params,
  );
  return rows[0] ? rowToPlan(rows[0]) : null;
}

export async function softDelete(
  client: pg.PoolClient,
  id: string,
): Promise<void> {
  await client.query("UPDATE plans SET is_archived = true WHERE id = $1", [id]);
}

export const planRepo = {
  findAll,
  findById,
  create,
  update,
  softDelete,
};
