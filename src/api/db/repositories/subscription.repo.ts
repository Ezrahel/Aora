import type pg from "pg";
import pool, { query } from "../pool.ts";
import type { Subscription } from "../../types.ts";

export interface SubscriptionRow {
  id: string;
  customer_id: string;
  plan_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  trial_end: string | null;
  canceled_at: string | null;
  paused_at: string | null;
  resume_at: string | null;
  cancel_at_period_end: boolean;
  seat_quantity: number;
  metadata: any;
  created_at: string;
  updated_at: string;
}

function rowToSub(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    customerId: row.customer_id,
    planId: row.plan_id,
    status: row.status as Subscription["status"],
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    trialEnd: row.trial_end ?? undefined,
    canceledAt: row.canceled_at ?? undefined,
    pausedAt: row.paused_at ?? undefined,
    resumeAt: row.resume_at ?? undefined,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    seatQuantity: row.seat_quantity,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findByCustomerIds(
  customerIds: string[],
): Promise<SubscriptionRow[]> {
  if (customerIds.length === 0) return [];
  const params: any[] = customerIds;
  const placeholders = customerIds.map((_, i) => `$${i + 1}`).join(", ");
  const { rows } = await query<SubscriptionRow>(
    `SELECT id, customer_id, plan_id, status, current_period_start, current_period_end,
       trial_end, canceled_at, paused_at, resume_at, cancel_at_period_end,
       seat_quantity, metadata, created_at, updated_at
     FROM subscriptions WHERE customer_id IN (${placeholders})
     ORDER BY created_at DESC`,
    params,
  );
  return rows;
}

export async function findById(
  client: pg.PoolClient | null,
  id: string,
): Promise<SubscriptionRow | null> {
  const { rows } = await (client ?? pool).query<SubscriptionRow>(
    `SELECT id, customer_id, plan_id, status, current_period_start, current_period_end,
       trial_end, canceled_at, paused_at, resume_at, cancel_at_period_end,
       seat_quantity, metadata, created_at, updated_at
     FROM subscriptions WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function findActiveByCustomer(
  client: pg.PoolClient | null,
  customerId: string,
): Promise<SubscriptionRow | null> {
  const { rows } = await (client ?? pool).query<SubscriptionRow>(
    `SELECT id, customer_id, plan_id, status, current_period_start, current_period_end,
       trial_end, canceled_at, paused_at, resume_at, cancel_at_period_end,
       seat_quantity, metadata, created_at, updated_at
     FROM subscriptions
     WHERE customer_id = $1 AND (status = 'active' OR status = 'trial')
     ORDER BY created_at DESC LIMIT 1`,
    [customerId],
  );
  return rows[0] ?? null;
}

export async function findByCustomer(
  customerId: string,
): Promise<SubscriptionRow[]> {
  const { rows } = await query<SubscriptionRow>(
    `SELECT id, customer_id, plan_id, status, current_period_start, current_period_end,
       trial_end, canceled_at, paused_at, resume_at, cancel_at_period_end,
       seat_quantity, metadata, created_at, updated_at
     FROM subscriptions WHERE customer_id = $1
     ORDER BY created_at DESC`,
    [customerId],
  );
  return rows;
}

export async function create(
  client: pg.PoolClient | null,
  data: {
    id: string;
    customerId: string;
    planId: string;
    status: Subscription["status"];
    currentPeriodStart: string;
    currentPeriodEnd: string;
    trialEnd?: string;
    seatQuantity: number;
    metadata?: any;
  },
): Promise<SubscriptionRow> {
  const { rows } = await (client ?? pool).query<SubscriptionRow>(
    `INSERT INTO subscriptions (id, customer_id, plan_id, status, current_period_start, current_period_end,
       trial_end, seat_quantity, metadata, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
     RETURNING id, customer_id, plan_id, status, current_period_start, current_period_end,
       trial_end, canceled_at, paused_at, resume_at, cancel_at_period_end,
       seat_quantity, metadata, created_at, updated_at`,
    [
      data.id, data.customerId, data.planId, data.status,
      data.currentPeriodStart, data.currentPeriodEnd,
      data.trialEnd ?? null, data.seatQuantity,
      JSON.stringify(data.metadata ?? {}),
    ],
  );
  return rows[0];
}

export async function update(
  client: pg.PoolClient | null,
  id: string,
  data: Partial<{
    planId: string;
    status: Subscription["status"];
    seatQuantity: number;
    metadata: any;
    cancelAtPeriodEnd: boolean;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    trialEnd: string | null;
    pausedAt: string | null;
    canceledAt: string | null;
    resumeAt: string | null;
  }>,
): Promise<SubscriptionRow | null> {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (data.planId !== undefined) { sets.push(`plan_id = $${idx++}`); params.push(data.planId); }
  if (data.status !== undefined) { sets.push(`status = $${idx++}`); params.push(data.status); }
  if (data.seatQuantity !== undefined) { sets.push(`seat_quantity = $${idx++}`); params.push(data.seatQuantity); }
  if (data.metadata !== undefined) { sets.push(`metadata = $${idx++}`); params.push(JSON.stringify(data.metadata)); }
  if (data.cancelAtPeriodEnd !== undefined) { sets.push(`cancel_at_period_end = $${idx++}`); params.push(data.cancelAtPeriodEnd); }
  if (data.currentPeriodStart !== undefined) { sets.push(`current_period_start = $${idx++}`); params.push(data.currentPeriodStart); }
  if (data.currentPeriodEnd !== undefined) { sets.push(`current_period_end = $${idx++}`); params.push(data.currentPeriodEnd); }
  if (data.trialEnd !== undefined) { sets.push(`trial_end = $${idx++}`); params.push(data.trialEnd); }
  if (data.pausedAt !== undefined) { sets.push(`paused_at = $${idx++}`); params.push(data.pausedAt); }
  if (data.canceledAt !== undefined) { sets.push(`canceled_at = $${idx++}`); params.push(data.canceledAt); }
  if (data.resumeAt !== undefined) { sets.push(`resume_at = $${idx++}`); params.push(data.resumeAt); }
  sets.push("updated_at = now()");

  params.push(id);
  const { rows } = await (client ?? pool).query<SubscriptionRow>(
    `UPDATE subscriptions SET ${sets.join(", ")} WHERE id = $${idx}
     RETURNING id, customer_id, plan_id, status, current_period_start, current_period_end,
       trial_end, canceled_at, paused_at, resume_at, cancel_at_period_end,
       seat_quantity, metadata, created_at, updated_at`,
    params,
  );
  return rows[0] ?? null;
}

export const subscriptionRepo = {
  findByCustomerIds,
  findById,
  findActiveByCustomer,
  findByCustomer,
  create,
  update,
};
