import type pg from "pg";
import pool, { query } from "../pool.ts";
import type { Entitlement } from "../../types.ts";

export interface EntitlementRow {
  id: string;
  plan_id: string;
  feature_id: string;
  value: any;
  is_enabled: boolean;
  created_at: string;
}

function rowToEntitlement(row: EntitlementRow): Entitlement {
  return {
    id: row.id,
    planId: row.plan_id,
    featureId: row.feature_id,
    value: typeof row.value === "string" ? JSON.parse(row.value) : row.value,
    isEnabled: row.is_enabled,
    createdAt: row.created_at,
  };
}

export async function findByPlan(
  planId: string,
): Promise<Entitlement[]> {
  const { rows } = await query<EntitlementRow>(
    "SELECT id, plan_id, feature_id, value, is_enabled, created_at FROM entitlements WHERE plan_id = $1",
    [planId],
  );
  return rows.map(rowToEntitlement);
}

export async function findByFeature(
  featureId: string,
): Promise<Entitlement[]> {
  const { rows } = await query<EntitlementRow>(
    "SELECT id, plan_id, feature_id, value, is_enabled, created_at FROM entitlements WHERE feature_id = $1",
    [featureId],
  );
  return rows.map(rowToEntitlement);
}

export async function findByPlanAndFeature(
  client: pg.PoolClient | null,
  planId: string,
  featureId: string,
): Promise<Entitlement | null> {
  const { rows } = await (client ?? pool).query<EntitlementRow>(
    "SELECT id, plan_id, feature_id, value, is_enabled, created_at FROM entitlements WHERE plan_id = $1 AND feature_id = $2",
    [planId, featureId],
  );
  return rows[0] ? rowToEntitlement(rows[0]) : null;
}

export async function batchCreateForPlan(
  client: pg.PoolClient | null,
  planId: string,
  features: { id: string; slug: string }[],
  apiAccess: boolean,
): Promise<void> {
  for (const feat of features) {
    const id = `ent_${planId}_${feat.slug}`;
    const value = feat.slug === "api_access" ? apiAccess : false;
    await (client ?? pool).query(
      `INSERT INTO entitlements (id, plan_id, feature_id, value, is_enabled, created_at)
       VALUES ($1, $2, $3, $4, true, now())
       ON CONFLICT DO NOTHING`,
      [id, planId, feat.id, JSON.stringify(value)],
    );
  }
}

export async function updateValueForFeature(
  client: pg.PoolClient | null,
  featureId: string,
  planIds: string[],
  value: boolean,
): Promise<void> {
  for (const planId of planIds) {
    await (client ?? pool).query(
      "UPDATE entitlements SET value = $1 WHERE feature_id = $2 AND plan_id = $3",
      [JSON.stringify(value), featureId, planId],
    );
  }
}

export async function updateEnabledForFeature(
  client: pg.PoolClient | null,
  featureId: string,
  isEnabled: boolean,
): Promise<void> {
  await (client ?? pool).query(
    "UPDATE entitlements SET is_enabled = $1 WHERE feature_id = $2",
    [isEnabled, featureId],
  );
}

export async function findAll(client: pg.PoolClient | null): Promise<Entitlement[]> {
  const { rows } = await (client ?? pool).query<EntitlementRow>(
    "SELECT id, plan_id, feature_id, value, is_enabled, created_at FROM entitlements",
  );
  return rows.map(rowToEntitlement);
}

export const entitlementRepo = {
  findByPlan,
  findByFeature,
  findByPlanAndFeature,
  batchCreateForPlan,
  updateValueForFeature,
  updateEnabledForFeature,
  findAll,
};
