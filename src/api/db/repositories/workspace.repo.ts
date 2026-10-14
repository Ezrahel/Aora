import type pg from "pg";
import pool, { query, withTransaction } from "../pool.ts";
import type { Workspace } from "../../types.ts";
import { auditRepo } from "./audit.repo.ts";

export interface WorkspaceRow {
  id: string;
  organization_id: string;
  name: string;
  environment: string;
  api_keys: string[];
  profile: any;
  settings: any;
  created_at: string;
}

function rowToWs(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    environment: row.environment as Workspace["environment"],
    apiKeys: row.api_keys,
    profile: row.profile ?? {},
    settings: row.settings ?? {},
    createdAt: row.created_at,
  };
}

export async function findAll(): Promise<Workspace[]> {
  const { rows } = await query<WorkspaceRow>(
    "SELECT id, organization_id, name, environment, api_keys, profile, settings, created_at FROM workspaces ORDER BY name",
  );
  return rows.map(rowToWs);
}

export async function findByOrganizationId(organizationId: string): Promise<Workspace[]> {
  const { rows } = await query<WorkspaceRow>(
    `SELECT id, organization_id, name, environment, api_keys, profile, settings, created_at
     FROM workspaces WHERE organization_id::text = $1 ORDER BY name`,
    [organizationId],
  );
  return rows.map(rowToWs);
}

export async function findById(
  client: pg.PoolClient | null,
  id: string,
): Promise<Workspace | null> {
  const { rows } = await (client ?? pool).query<WorkspaceRow>(
    "SELECT id, organization_id, name, environment, api_keys, profile, settings, created_at FROM workspaces WHERE id = $1",
    [id],
  );
  return rows[0] ? rowToWs(rows[0]) : null;
}

export async function resolveWorkspace(
  identifier: string,
): Promise<Workspace | null> {
  const { rows } = await query<WorkspaceRow>(
    `SELECT id, organization_id, name, environment, api_keys, profile, settings, created_at
     FROM workspaces
     WHERE id::text = $1 OR LOWER(name) = LOWER($1)`,
    [identifier],
  );
  if (rows.length === 0) return null;
  return rowToWs(rows[0]);
}

/**
 * Resolve a workspace only within an organization.  Never use the caller's
 * workspace identifier as an authorization boundary on its own.
 */
export async function resolveWorkspaceForOrganization(
  organizationId: string,
  identifier?: string,
): Promise<Workspace | null> {
  const params: string[] = [organizationId];
  let where = "organization_id::text = $1";

  if (identifier) {
    params.push(identifier);
    where += " AND (id::text = $2 OR LOWER(name) = LOWER($2))";
  }

  const { rows } = await query<WorkspaceRow>(
    `SELECT id, organization_id, name, environment, api_keys, profile, settings, created_at
     FROM workspaces WHERE ${where} ORDER BY name LIMIT 1`,
    params,
  );
  return rows[0] ? rowToWs(rows[0]) : null;
}

export async function update(
  client: pg.PoolClient | null,
  id: string,
  data: Partial<Pick<Workspace, "name" | "environment" | "profile" | "settings">>,
): Promise<Workspace | null> {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (data.name !== undefined) { sets.push(`name = $${idx++}`); params.push(data.name.trim()); }
  if (data.environment !== undefined) { sets.push(`environment = $${idx++}`); params.push(data.environment); }
  if (data.profile !== undefined) { sets.push(`profile = $${idx++}`); params.push(JSON.stringify(data.profile)); }
  if (data.settings !== undefined) { sets.push(`settings = $${idx++}`); params.push(JSON.stringify(data.settings)); }
  if (sets.length === 0) return findById(client, id);

  params.push(id);
  const { rows } = await (client ?? pool).query<WorkspaceRow>(
    `UPDATE workspaces SET ${sets.join(", ")} WHERE id = $${idx} RETURNING id, organization_id, name, environment, api_keys, profile, settings, created_at`,
    params,
  );
  return rows[0] ? rowToWs(rows[0]) : null;
}

export async function rotateKey(
  client: pg.PoolClient | null,
  id: string,
  newKey: string,
): Promise<void> {
  await (client ?? pool).query(
    "UPDATE workspaces SET api_keys = array_append(api_keys, $1) WHERE id = $2",
    [newKey, id],
  );
}

export const workspaceRepo = {
  findAll,
  findByOrganizationId,
  findById,
  resolveWorkspace,
  resolveWorkspaceForOrganization,
  update,
  rotateKey,
};
