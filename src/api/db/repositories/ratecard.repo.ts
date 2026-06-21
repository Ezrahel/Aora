import type pg from "pg";
import { query } from "../pool.ts";
import type { RateCard } from "../../types.ts";

export interface RateCardRow {
  id: string;
  name: string;
  description: string;
  meter_id: string;
  price_type: string;
  unit_price: number | null;
  tiers: any;
  included_units: number | null;
  currency: string;
  is_active: boolean;
  created_at: string;
}

function rowToRateCard(row: RateCardRow): RateCard {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    meterId: row.meter_id,
    priceType: row.price_type as RateCard["priceType"],
    unitPrice: row.unit_price != null ? Number(row.unit_price) : undefined,
    tiers: row.tiers ?? undefined,
    includedUnits: row.included_units != null ? Number(row.included_units) : undefined,
    currency: row.currency,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export async function findAll(): Promise<RateCard[]> {
  const { rows } = await query<RateCardRow>(
    "SELECT id, name, description, meter_id, price_type, unit_price, tiers, included_units, currency, is_active, created_at FROM rate_cards ORDER BY created_at DESC",
  );
  return rows.map(rowToRateCard);
}

export async function create(client: pg.PoolClient, data: {
  id: string;
  name: string;
  description?: string;
  meterId: string;
  priceType: RateCard["priceType"];
  unitPrice?: number;
  tiers?: any[];
  includedUnits?: number;
  currency?: string;
}): Promise<RateCardRow> {
  const { rows } = await client.query<RateCardRow>(
    `INSERT INTO rate_cards (id, name, description, meter_id, price_type, unit_price, tiers, included_units, currency, is_active, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,now())
     RETURNING id, name, description, meter_id, price_type, unit_price, tiers, included_units, currency, is_active, created_at`,
    [data.id, data.name, data.description ?? "", data.meterId, data.priceType,
     data.unitPrice ?? null, data.tiers ? JSON.stringify(data.tiers) : null,
     data.includedUnits ?? null, data.currency ?? "USD"],
  );
  return rows[0];
}

export const rateCardRepo = {
  findAll,
  create,
};
