import type pg from "pg";
import { query } from "../pool.ts";
import type { CustomContract } from "../../types.ts";

export interface ContractRow {
  id: string;
  customer_id: string;
  name: string;
  custom_base_fee: number;
  custom_seat_price: number | null;
  custom_overage_unit_price: number | null;
  minimum_spend: number | null;
  additional_discount_percentage: number | null;
  expire_at: string;
  is_deleted: boolean;
  created_at: string;
}

function rowToContract(row: ContractRow): CustomContract {
  return {
    id: row.id,
    customerId: row.customer_id,
    name: row.name,
    customBaseFee: Number(row.custom_base_fee),
    customSeatPrice: row.custom_seat_price != null ? Number(row.custom_seat_price) : undefined,
    customOverageUnitPrice: row.custom_overage_unit_price != null ? Number(row.custom_overage_unit_price) : undefined,
    minimumSpend: row.minimum_spend != null ? Number(row.minimum_spend) : undefined,
    additionalDiscountPercentage: row.additional_discount_percentage != null ? Number(row.additional_discount_percentage) : undefined,
    expireAt: row.expire_at,
    isDeleted: row.is_deleted,
    createdAt: row.created_at,
  };
}

export async function findAll(): Promise<CustomContract[]> {
  const { rows } = await query<ContractRow>(
    "SELECT id, customer_id, name, custom_base_fee, custom_seat_price, custom_overage_unit_price, minimum_spend, additional_discount_percentage, expire_at, is_deleted, created_at FROM custom_contracts WHERE NOT is_deleted ORDER BY created_at DESC",
  );
  return rows.map(rowToContract);
}

export async function findById(id: string): Promise<CustomContract | null> {
  const { rows } = await query<ContractRow>(
    "SELECT id, customer_id, name, custom_base_fee, custom_seat_price, custom_overage_unit_price, minimum_spend, additional_discount_percentage, expire_at, is_deleted, created_at FROM custom_contracts WHERE id = $1",
    [id],
  );
  return rows[0] ? rowToContract(rows[0]) : null;
}

export async function findByCustomer(customerId: string): Promise<CustomContract | null> {
  const { rows } = await query<ContractRow>(
    "SELECT id, customer_id, name, custom_base_fee, custom_seat_price, custom_overage_unit_price, minimum_spend, additional_discount_percentage, expire_at, is_deleted, created_at FROM custom_contracts WHERE customer_id = $1 AND NOT is_deleted LIMIT 1",
    [customerId],
  );
  return rows[0] ? rowToContract(rows[0]) : null;
}

export async function create(client: pg.PoolClient, data: {
  id: string;
  customerId: string;
  name: string;
  customBaseFee: number;
  customSeatPrice?: number;
  customOverageUnitPrice?: number;
  minimumSpend?: number;
  additionalDiscountPercentage?: number;
  expireAt: string;
}): Promise<ContractRow> {
  const { rows } = await client.query<ContractRow>(
    `INSERT INTO custom_contracts (id, customer_id, name, custom_base_fee, custom_seat_price,
       custom_overage_unit_price, minimum_spend, additional_discount_percentage, expire_at, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
     RETURNING id, customer_id, name, custom_base_fee, custom_seat_price,
       custom_overage_unit_price, minimum_spend, additional_discount_percentage, expire_at, is_deleted, created_at`,
    [data.id, data.customerId, data.name, data.customBaseFee,
     data.customSeatPrice ?? null, data.customOverageUnitPrice ?? null,
     data.minimumSpend ?? null, data.additionalDiscountPercentage ?? null, data.expireAt],
  );
  return rows[0];
}

export async function softDelete(client: pg.PoolClient, id: string): Promise<void> {
  await client.query("UPDATE custom_contracts SET is_deleted = true WHERE id = $1", [id]);
}

export const contractRepo = {
  findAll,
  findById,
  findByCustomer,
  create,
  softDelete,
};
