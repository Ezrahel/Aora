// ============================================================
// Gateway Connection Repository
// ============================================================

import type pg from "pg";
import pool, { query } from "../pool.ts";

export interface GatewayConnectionRow {
  id: string;
  workspace_id: string;
  gateway: string;
  mode: string;
  encrypted_api_key: string;   // hex-encoded AES-GCM output
  encrypted_webhook_secret: string | null;
  gateway_account_id: string | null;
  gateway_account_name: string | null;
  gateway_account_email: string | null;
  is_verified: boolean;
  last_verified_at: string | null;
  key_preview: string;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export type SafeGatewayConnection = Omit<GatewayConnectionRow, "encrypted_api_key" | "encrypted_webhook_secret">;

function toSafe(row: GatewayConnectionRow): SafeGatewayConnection {
  const { encrypted_api_key, encrypted_webhook_secret, ...safe } = row;
  return safe;
}

/** List connections for a workspace (without encrypted keys) */
export async function findByWorkspace(workspaceId: string): Promise<SafeGatewayConnection[]> {
  const { rows } = await query<GatewayConnectionRow>(
    `SELECT id, workspace_id, gateway, mode, encrypted_api_key, encrypted_webhook_secret,
       gateway_account_id, gateway_account_name, gateway_account_email,
       is_verified, last_verified_at, key_preview, metadata, created_at, updated_at
     FROM gateway_connections WHERE workspace_id = $1
     ORDER BY created_at DESC`,
    [workspaceId],
  );
  return rows.map(toSafe);
}

/** Get a single connection (without encrypted keys) */
export async function findById(id: string): Promise<SafeGatewayConnection | null> {
  const { rows } = await query<GatewayConnectionRow>(
    `SELECT id, workspace_id, gateway, mode, encrypted_api_key, encrypted_webhook_secret,
       gateway_account_id, gateway_account_name, gateway_account_email,
       is_verified, last_verified_at, key_preview, metadata, created_at, updated_at
     FROM gateway_connections WHERE id = $1`,
    [id],
  );
  return rows[0] ? toSafe(rows[0]) : null;
}

/** Get a connection WITH encrypted keys (for adapter operations) */
export async function findByWorkspaceAndGateway(
  workspaceId: string,
  gateway: string,
  mode: string,
): Promise<GatewayConnectionRow | null> {
  const { rows } = await query<GatewayConnectionRow>(
    `SELECT id, workspace_id, gateway, mode, encrypted_api_key, encrypted_webhook_secret,
       gateway_account_id, gateway_account_name, gateway_account_email,
       is_verified, last_verified_at, key_preview, metadata, created_at, updated_at
     FROM gateway_connections WHERE workspace_id = $1 AND gateway = $2 AND mode = $3
     LIMIT 1`,
    [workspaceId, gateway, mode],
  );
  return rows[0] ?? null;
}

/** Get the first verified connection for a workspace (prefer live) */
export async function findActive(workspaceId: string): Promise<GatewayConnectionRow | null> {
  const { rows } = await query<GatewayConnectionRow>(
    `SELECT id, workspace_id, gateway, mode, encrypted_api_key, encrypted_webhook_secret,
       gateway_account_id, gateway_account_name, gateway_account_email,
       is_verified, last_verified_at, key_preview, metadata, created_at, updated_at
     FROM gateway_connections
     WHERE workspace_id = $1 AND is_verified = true
     ORDER BY CASE WHEN mode = 'live' THEN 0 ELSE 1 END
     LIMIT 1`,
    [workspaceId],
  );
  return rows[0] ?? null;
}

/** Create a new gateway connection */
export async function create(client: pg.PoolClient | null, data: {
  id: string;
  workspaceId: string;
  gateway: string;
  mode: string;
  encryptedApiKey: string;
  encryptedWebhookSecret?: string;
  keyPreview: string;
}): Promise<SafeGatewayConnection> {
  const { rows } = await (client ?? pool).query<GatewayConnectionRow>(
    `INSERT INTO gateway_connections
       (id, workspace_id, gateway, mode, encrypted_api_key, encrypted_webhook_secret, key_preview, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
     RETURNING id, workspace_id, gateway, mode, encrypted_api_key, encrypted_webhook_secret,
       gateway_account_id, gateway_account_name, gateway_account_email,
       is_verified, last_verified_at, key_preview, metadata, created_at, updated_at`,
    [data.id, data.workspaceId, data.gateway, data.mode, data.encryptedApiKey, data.encryptedWebhookSecret ?? null, data.keyPreview],
  );
  return toSafe(rows[0]);
}

/** Update verification result after checking with the gateway API */
export async function updateVerification(client: pg.PoolClient | null, id: string, result: {
  isVerified: boolean;
  accountId?: string;
  accountName?: string;
  accountEmail?: string;
}): Promise<void> {
  const sets: string[] = [
    "is_verified = $1",
    "last_verified_at = CASE WHEN $1 = true THEN now() ELSE null END",
  ];
  if (result.accountId !== undefined) sets.push("gateway_account_id = $2");
  if (result.accountName !== undefined) sets.push(`gateway_account_name = $3`);
  if (result.accountEmail !== undefined) sets.push(`gateway_account_email = $4`);

  const params: any[] = [result.isVerified];
  if (result.accountId !== undefined) params.push(result.accountId);
  if (result.accountName !== undefined) params.push(result.accountName);
  if (result.accountEmail !== undefined) params.push(result.accountEmail);
  params.push(id);

  const idx = params.length;
  await (client ?? pool).query(
    `UPDATE gateway_connections SET ${sets.join(", ")} WHERE id = $${idx}`,
    params,
  );
}

/** Update the webhook secret for a connection */
export async function updateWebhookSecret(client: pg.PoolClient | null, id: string, encryptedSecret: string): Promise<void> {
  await (client ?? pool).query(
    "UPDATE gateway_connections SET encrypted_webhook_secret = $1, updated_at = now() WHERE id = $2",
    [encryptedSecret, id],
  );
}

/** Delete a gateway connection */
export async function remove(client: pg.PoolClient | null, id: string): Promise<void> {
  await (client ?? pool).query("DELETE FROM gateway_connections WHERE id = $1", [id]);
}

export const gatewayRepo = {
  findByWorkspace,
  findById,
  findByWorkspaceAndGateway,
  findActive,
  create,
  updateVerification,
  updateWebhookSecret,
  remove,
};
