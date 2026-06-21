import type pg from "pg";
import { query } from "../pool.ts";
import type { Product } from "../../types.ts";

export interface ProductRow {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  is_archived: boolean;
  created_at: string;
}

function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description,
    isArchived: row.is_archived,
    createdAt: row.created_at,
  };
}

export async function findByWorkspace(
  workspaceId: string,
  showArchived = true,
): Promise<Product[]> {
  let sql = "SELECT id, workspace_id, name, description, is_archived, created_at FROM products WHERE workspace_id = $1";
  if (!showArchived) sql += " AND NOT is_archived";
  sql += " ORDER BY created_at DESC";
  const { rows } = await query<ProductRow>(sql, [workspaceId]);
  return rows.map(rowToProduct);
}

export async function findById(
  client: pg.PoolClient,
  id: string,
): Promise<Product | null> {
  const { rows } = await client.query<ProductRow>(
    "SELECT id, workspace_id, name, description, is_archived, created_at FROM products WHERE id = $1",
    [id],
  );
  return rows[0] ? rowToProduct(rows[0]) : null;
}

export async function create(
  client: pg.PoolClient,
  data: { id: string; workspaceId: string; name: string; description?: string },
): Promise<Product> {
  const { rows } = await client.query<ProductRow>(
    `INSERT INTO products (id, workspace_id, name, description, created_at)
     VALUES ($1, $2, $3, $4, now())
     RETURNING id, workspace_id, name, description, is_archived, created_at`,
    [data.id, data.workspaceId, data.name, data.description ?? ""],
  );
  return rowToProduct(rows[0]);
}

export async function update(
  client: pg.PoolClient,
  id: string,
  data: { name?: string; description?: string },
): Promise<Product | null> {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;
  if (data.name !== undefined) { sets.push(`name = $${idx++}`); params.push(data.name.trim()); }
  if (data.description !== undefined) { sets.push(`description = $${idx++}`); params.push(data.description); }
  if (sets.length === 0) return findById(client, id);
  params.push(id);
  const { rows } = await client.query<ProductRow>(
    `UPDATE products SET ${sets.join(", ")} WHERE id = $${idx} RETURNING id, workspace_id, name, description, is_archived, created_at`,
    params,
  );
  return rows[0] ? rowToProduct(rows[0]) : null;
}

export async function softDelete(
  client: pg.PoolClient,
  id: string,
): Promise<void> {
  await client.query("UPDATE products SET is_archived = true WHERE id = $1", [id]);
}

export const productRepo = {
  findByWorkspace,
  findById,
  create,
  update,
  softDelete,
};
