import type pg from "pg";
import pool, { query } from "../pool.ts";
import type { Price } from "../../types.ts";

export interface PriceRow {
  id: string;
  plan_id: string;
  name: string;
  type: string;
  billing_period: string;
  currency: string;
  base_fee: number;
  seat_price: number | null;
  included_seats: number | null;
  meter_id: string | null;
  included_usage: number | null;
  overage_unit_price: number | null;
  tiers: any;
  volume_pricing: boolean;
  package_size: number | null;
  package_price: number | null;
  version: number;
  is_active: boolean;
  is_archived: boolean;
  created_at: string;
}

function rowToPrice(row: PriceRow): Price {
  return {
    id: row.id,
    planId: row.plan_id,
    name: row.name,
    type: row.type as Price["type"],
    billingPeriod: row.billing_period as Price["billingPeriod"],
    currency: row.currency,
    baseFee: Number(row.base_fee),
    seatPrice: row.seat_price != null ? Number(row.seat_price) : undefined,
    includedSeats: row.included_seats ?? undefined,
    meterId: row.meter_id ?? undefined,
    includedUsage: row.included_usage != null ? Number(row.included_usage) : undefined,
    overageUnitPrice: row.overage_unit_price != null ? Number(row.overage_unit_price) : undefined,
    tiers: row.tiers ?? undefined,
    volumePricing: row.volume_pricing,
    packageSize: row.package_size ?? undefined,
    packagePrice: row.package_price != null ? Number(row.package_price) : undefined,
    version: row.version,
    isActive: row.is_active,
    isArchived: row.is_archived,
    createdAt: row.created_at,
  };
}

export async function findByPlan(
  planId: string,
  activeOnly?: boolean,
): Promise<Price[]> {
  let sql = "SELECT id, plan_id, name, type, billing_period, currency, base_fee, seat_price, included_seats, meter_id, included_usage, overage_unit_price, tiers, volume_pricing, package_size, package_price, version, is_active, is_archived, created_at FROM prices WHERE plan_id = $1";
  if (activeOnly) sql += " AND is_active = true";
  sql += " ORDER BY version DESC";
  const { rows } = await query<PriceRow>(sql, [planId]);
  return rows.map(rowToPrice);
}

export async function findAll(
  _client: pg.PoolClient | null,
  filters: { productId?: string; type?: string; activeOnly?: boolean } = {},
): Promise<Price[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (filters.productId) { conditions.push(`plan_id = $${idx++}`); params.push(filters.productId); }
  if (filters.type) { conditions.push(`type = $${idx++}`); params.push(filters.type); }
  if (filters.activeOnly) conditions.push("is_active = true");

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await query<PriceRow>(
    `SELECT id, plan_id, name, type, billing_period, currency, base_fee, seat_price, included_seats, meter_id, included_usage, overage_unit_price, tiers, volume_pricing, package_size, package_price, version, is_active, is_archived, created_at FROM prices ${where} ORDER BY created_at DESC`,
    params,
  );
  return rows.map(rowToPrice);
}

export async function findById(id: string): Promise<Price | null> {
  const { rows } = await query<PriceRow>(
    "SELECT id, plan_id, name, type, billing_period, currency, base_fee, seat_price, included_seats, meter_id, included_usage, overage_unit_price, tiers, volume_pricing, package_size, package_price, version, is_active, is_archived, created_at FROM prices WHERE id = $1",
    [id],
  );
  return rows[0] ? rowToPrice(rows[0]) : null;
}

export async function create(client: pg.PoolClient | null, data: Price): Promise<PriceRow> {
  const { rows } = await (client ?? pool).query<PriceRow>(
    `INSERT INTO prices (id, plan_id, name, type, billing_period, currency, base_fee,
       seat_price, included_seats, meter_id, included_usage, overage_unit_price,
       tiers, volume_pricing, package_size, package_price, version, is_active, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,now())
     RETURNING id, plan_id, name, type, billing_period, currency, base_fee, seat_price,
       included_seats, meter_id, included_usage, overage_unit_price, tiers,
       volume_pricing, package_size, package_price, version, is_active, is_archived, created_at`,
    [
      data.id, data.planId, data.name, data.type, data.billingPeriod, data.currency,
      data.baseFee, data.seatPrice ?? null, data.includedSeats ?? null,
      data.meterId ?? null, data.includedUsage ?? null, data.overageUnitPrice ?? null,
      data.tiers ? JSON.stringify(data.tiers) : null, data.volumePricing ?? false,
      data.packageSize ?? null, data.packagePrice ?? null, data.version, data.isActive,
    ],
  );
  return rows[0];
}

export async function deactivateByPlan(client: pg.PoolClient | null, planId: string): Promise<void> {
  await (client ?? pool).query("UPDATE prices SET is_active = false WHERE plan_id = $1 AND is_active = true", [planId]);
}

export async function softDelete(client: pg.PoolClient | null, id: string): Promise<void> {
  await (client ?? pool).query("UPDATE prices SET is_archived = true, is_active = false WHERE id = $1", [id]);
}

export const priceRepo = {
  findByPlan,
  findAll,
  findById,
  create,
  deactivateByPlan,
  softDelete,
};
