import type pg from "pg";
import { query } from "../pool.ts";
import type { WebhookEndpoint, WebhookDelivery, WebhookEventType } from "../../types.ts";

export interface WebhookEndpointRow {
  id: string;
  workspace_id: string;
  url: string;
  description: string | null;
  events: string[];
  secret: string;
  is_active: boolean;
  created_at: string;
}

export interface WebhookDeliveryRow {
  id: string;
  webhook_id: string;
  event: string;
  payload: any;
  status: string;
  http_status: number | null;
  attempts: number;
  last_attempt_at: string | null;
  created_at: string;
}

function rowToEndpoint(row: WebhookEndpointRow): WebhookEndpoint {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    url: row.url,
    description: row.description ?? undefined,
    events: row.events as WebhookEventType[],
    secret: row.secret,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

function rowToDelivery(row: WebhookDeliveryRow): WebhookDelivery {
  return {
    id: row.id,
    webhookId: row.webhook_id,
    event: row.event as WebhookEventType,
    payload: row.payload,
    status: row.status as WebhookDelivery["status"],
    httpStatus: row.http_status ?? undefined,
    attempts: row.attempts,
    lastAttemptAt: row.last_attempt_at ?? undefined,
    createdAt: row.created_at,
  };
}

// ── Endpoints ──────────────────────────────────────────────

export async function findByWorkspace(workspaceId: string): Promise<WebhookEndpoint[]> {
  const { rows } = await query<WebhookEndpointRow>(
    "SELECT id, workspace_id, url, description, events, secret, is_active, created_at FROM webhook_endpoints WHERE workspace_id = $1 ORDER BY created_at DESC",
    [workspaceId],
  );
  return rows.map(rowToEndpoint);
}

export async function findEndpointById(
  workspaceId: string,
  id: string,
): Promise<WebhookEndpoint | null> {
  const { rows } = await query<WebhookEndpointRow>(
    "SELECT id, workspace_id, url, description, events, secret, is_active, created_at FROM webhook_endpoints WHERE id = $1 AND workspace_id = $2",
    [id, workspaceId],
  );
  return rows[0] ? rowToEndpoint(rows[0]) : null;
}

export async function createEndpoint(client: pg.PoolClient, data: {
  id: string;
  workspaceId: string;
  url: string;
  description?: string;
  events: string[];
  secret: string;
  isActive: boolean;
}): Promise<WebhookEndpointRow> {
  const { rows } = await client.query<WebhookEndpointRow>(
    `INSERT INTO webhook_endpoints (id, workspace_id, url, description, events, secret, is_active, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,now())
     RETURNING id, workspace_id, url, description, events, secret, is_active, created_at`,
    [data.id, data.workspaceId, data.url, data.description ?? null, data.events, data.secret, data.isActive],
  );
  return rows[0];
}

export async function updateEndpoint(
  client: pg.PoolClient,
  workspaceId: string,
  id: string,
  data: { url?: string; description?: string; events?: string[]; isActive?: boolean },
): Promise<void> {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;
  if (data.url !== undefined) { sets.push(`url = $${idx++}`); params.push(data.url); }
  if (data.description !== undefined) { sets.push(`description = $${idx++}`); params.push(data.description); }
  if (data.events !== undefined) { sets.push(`events = $${idx++}`); params.push(data.events); }
  if (data.isActive !== undefined) { sets.push(`is_active = $${idx++}`); params.push(data.isActive); }
  if (sets.length === 0) return;
  params.push(id);
  params.push(workspaceId);
  await client.query(
    `UPDATE webhook_endpoints SET ${sets.join(", ")} WHERE id = $${idx} AND workspace_id = $${idx + 1}`,
    params,
  );
}

export async function deleteEndpoint(
  client: pg.PoolClient,
  workspaceId: string,
  id: string,
): Promise<void> {
  await client.query(
    "DELETE FROM webhook_endpoints WHERE id = $1 AND workspace_id = $2",
    [id, workspaceId],
  );
}

// ── Deliveries ─────────────────────────────────────────────

export async function findDeliveriesByWebhook(
  webhookId: string,
): Promise<WebhookDelivery[]> {
  const { rows } = await query<WebhookDeliveryRow>(
    "SELECT id, webhook_id, event, payload, status, http_status, attempts, last_attempt_at, created_at FROM webhook_deliveries WHERE webhook_id = $1 ORDER BY created_at DESC LIMIT 20",
    [webhookId],
  );
  return rows.map(rowToDelivery);
}

export async function createDelivery(
  data: {
    id: string;
    webhookId: string;
    event: string;
    payload: any;
    status: string;
    attempts: number;
  },
): Promise<void> {
  await query(
    `INSERT INTO webhook_deliveries (id, webhook_id, event, payload, status, attempts, last_attempt_at, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,now(),now())`,
    [data.id, data.webhookId, data.event, JSON.stringify(data.payload), data.status, data.attempts],
  );
}

export async function updateDeliveryStatus(
  id: string,
  status: string,
  httpStatus?: number,
): Promise<void> {
  await query(
    "UPDATE webhook_deliveries SET status = $1, http_status = $2, last_attempt_at = now(), attempts = attempts + 1 WHERE id = $3",
    [status, httpStatus ?? null, id],
  );
}

export const webhookRepo = {
  findByWorkspace,
  findEndpointById,
  createEndpoint,
  updateEndpoint,
  deleteEndpoint,
  findDeliveriesByWebhook,
  createDelivery,
  updateDeliveryStatus,
};
