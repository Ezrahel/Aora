import type pg from "pg";
import pool, { query } from "../pool.ts";
import type { Feature } from "../../types.ts";

export interface FeatureRow {
  id: string;
  workspace_id: string;
  slug: string;
  name: string;
  description: string;
  type: string;
  is_archived: boolean;
  created_at: string;
}

function rowToFeature(row: FeatureRow): Feature {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    type: row.type as Feature["type"],
    isArchived: row.is_archived,
    createdAt: row.created_at,
  };
}

export async function findByWorkspace(
  workspaceId: string,
  showArchived = true,
): Promise<Feature[]> {
  let sql = "SELECT id, workspace_id, slug, name, description, type, is_archived, created_at FROM features WHERE workspace_id = $1";
  if (!showArchived) sql += " AND NOT is_archived";
  sql += " ORDER BY created_at DESC";
  const { rows } = await query<FeatureRow>(sql, [workspaceId]);
  return rows.map(rowToFeature);
}

export async function findById(
  client: pg.PoolClient | null,
  id: string,
): Promise<Feature | null> {
  const { rows } = await (client ?? pool).query<FeatureRow>(
    "SELECT id, workspace_id, slug, name, description, type, is_archived, created_at FROM features WHERE id = $1",
    [id],
  );
  return rows[0] ? rowToFeature(rows[0]) : null;
}

export async function findBySlug(
  workspaceId: string,
  slug: string,
): Promise<Feature | null> {
  const { rows } = await query<FeatureRow>(
    "SELECT id, workspace_id, slug, name, description, type, is_archived, created_at FROM features WHERE workspace_id = $1 AND slug = $2",
    [workspaceId, slug],
  );
  return rows[0] ? rowToFeature(rows[0]) : null;
}

export async function findBySlugOrId(
  workspaceId: string,
  slugOrId: string,
): Promise<Feature | null> {
  const { rows } = await query<FeatureRow>(
    "SELECT id, workspace_id, slug, name, description, type, is_archived, created_at FROM features WHERE workspace_id = $1 AND (id = $2 OR slug = $2)",
    [workspaceId, slugOrId],
  );
  return rows[0] ? rowToFeature(rows[0]) : null;
}

export async function create(
  client: pg.PoolClient | null,
  data: {
    id: string;
    workspaceId: string;
    slug: string;
    name: string;
    description?: string;
    type: Feature["type"];
  },
): Promise<Feature> {
  const { rows } = await (client ?? pool).query<FeatureRow>(
    `INSERT INTO features (id, workspace_id, slug, name, description, type, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     RETURNING id, workspace_id, slug, name, description, type, is_archived, created_at`,
    [data.id, data.workspaceId, data.slug, data.name, data.description ?? "", data.type],
  );
  return rowToFeature(rows[0]);
}

export async function update(
  client: pg.PoolClient | null,
  id: string,
  data: { name?: string; description?: string; type?: Feature["type"] },
): Promise<Feature | null> {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;
  if (data.name !== undefined) { sets.push(`name = $${idx++}`); params.push(data.name.trim()); }
  if (data.description !== undefined) { sets.push(`description = $${idx++}`); params.push(data.description); }
  if (data.type !== undefined) { sets.push(`type = $${idx++}`); params.push(data.type); }
  if (sets.length === 0) return findById(client, id);
  params.push(id);
  const { rows } = await (client ?? pool).query<FeatureRow>(
    `UPDATE features SET ${sets.join(", ")} WHERE id = $${idx} RETURNING id, workspace_id, slug, name, description, type, is_archived, created_at`,
    params,
  );
  return rows[0] ? rowToFeature(rows[0]) : null;
}

export async function softDelete(
  client: pg.PoolClient | null,
  id: string,
): Promise<void> {
  await (client ?? pool).query("UPDATE features SET is_archived = true WHERE id = $1", [id]);
}

export const featureRepo = {
  findByWorkspace,
  findById,
  findBySlug,
  findBySlugOrId,
  create,
  update,
  softDelete,
};
