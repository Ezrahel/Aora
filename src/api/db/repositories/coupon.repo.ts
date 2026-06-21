import type pg from "pg";
import { query } from "../pool.ts";
import type { Coupon } from "../../types.ts";

export interface CouponRow {
  id: string;
  name: string;
  discount_id: string;
  code: string;
  is_active: boolean;
  expire_at: string | null;
  max_redemptions: number | null;
  times_redeemed: number;
  created_at: string;
}

function rowToCoupon(row: CouponRow): Coupon {
  return {
    id: row.id,
    name: row.name,
    discountId: row.discount_id,
    code: row.code,
    isActive: row.is_active,
    expireAt: row.expire_at ?? undefined,
    maxRedemptions: row.max_redemptions ?? undefined,
    timesRedeemed: row.times_redeemed,
    createdAt: row.created_at,
  };
}

export async function findAll(activeOnly?: boolean): Promise<Coupon[]> {
  let sql = "SELECT id, name, discount_id, code, is_active, expire_at, max_redemptions, times_redeemed, created_at FROM coupons";
  if (activeOnly) sql += " WHERE is_active = true";
  sql += " ORDER BY created_at DESC";
  const { rows } = await query<CouponRow>(sql);
  return rows.map(rowToCoupon);
}

export async function findById(id: string): Promise<Coupon | null> {
  const { rows } = await query<CouponRow>(
    "SELECT id, name, discount_id, code, is_active, expire_at, max_redemptions, times_redeemed, created_at FROM coupons WHERE id = $1",
    [id],
  );
  return rows[0] ? rowToCoupon(rows[0]) : null;
}

export async function findByCode(code: string): Promise<Coupon | null> {
  const { rows } = await query<CouponRow>(
    "SELECT id, name, discount_id, code, is_active, expire_at, max_redemptions, times_redeemed, created_at FROM coupons WHERE code = $1",
    [code],
  );
  return rows[0] ? rowToCoupon(rows[0]) : null;
}

export async function create(client: pg.PoolClient, data: {
  id: string;
  name: string;
  discountId: string;
  code: string;
  expireAt?: string;
  maxRedemptions?: number;
}): Promise<CouponRow> {
  const { rows } = await client.query<CouponRow>(
    `INSERT INTO coupons (id, name, discount_id, code, is_active, expire_at, max_redemptions, times_redeemed, created_at)
     VALUES ($1,$2,$3,$4,true,$5,$6,0,now())
     RETURNING id, name, discount_id, code, is_active, expire_at, max_redemptions, times_redeemed, created_at`,
    [data.id, data.name, data.discountId, data.code, data.expireAt ?? null, data.maxRedemptions ?? null],
  );
  return rows[0];
}

export async function update(client: pg.PoolClient, id: string, data: {
  isActive?: boolean;
  expireAt?: string;
  maxRedemptions?: number;
}): Promise<void> {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;
  if (data.isActive !== undefined) { sets.push(`is_active = $${idx++}`); params.push(data.isActive); }
  if (data.expireAt !== undefined) { sets.push(`expire_at = $${idx++}`); params.push(data.expireAt); }
  if (data.maxRedemptions !== undefined) { sets.push(`max_redemptions = $${idx++}`); params.push(data.maxRedemptions); }
  if (sets.length === 0) return;
  params.push(id);
  await client.query(`UPDATE coupons SET ${sets.join(", ")} WHERE id = $${idx}`, params);
}

export const couponRepo = {
  findAll,
  findById,
  findByCode,
  create,
  update,
};
