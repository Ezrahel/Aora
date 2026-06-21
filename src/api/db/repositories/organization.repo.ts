import type pg from "pg";
import { query } from "../pool.ts";
import type { Organization } from "../../types.ts";

export interface OrganizationRow {
  id: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

function rowToOrg(row: OrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    status: row.status as Organization["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findAll(): Promise<Organization[]> {
  const { rows } = await query<OrganizationRow>(
    "SELECT id, name, status, created_at, updated_at FROM organizations ORDER BY name",
  );
  return rows.map(rowToOrg);
}

export async function findById(
  client: pg.PoolClient,
  id: string,
): Promise<Organization | null> {
  const { rows } = await client.query<OrganizationRow>(
    "SELECT id, name, status, created_at, updated_at FROM organizations WHERE id = $1",
    [id],
  );
  return rows[0] ? rowToOrg(rows[0]) : null;
}

export async function findByName(name: string): Promise<Organization | null> {
  const { rows } = await query<OrganizationRow>(
    "SELECT id, name, status, created_at, updated_at FROM organizations WHERE name = $1",
    [name],
  );
  return rows[0] ? rowToOrg(rows[0]) : null;
}

export const organizationRepo = {
  findAll,
  findById,
  findByName,
};
