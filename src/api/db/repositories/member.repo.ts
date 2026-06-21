import type pg from "pg";
import pool, { query } from "../pool.ts";
import type { Member } from "../../types.ts";

export interface MemberRow {
  id: string;
  workspace_id: string;
  email: string;
  role: string;
  permissions: string[];
  created_at: string;
}

function rowToMember(row: MemberRow): Member {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    email: row.email,
    role: row.role as Member["role"],
    permissions: row.permissions,
    createdAt: row.created_at,
  };
}

export async function findByWorkspace(
  workspaceId: string,
): Promise<Member[]> {
  const { rows } = await query<MemberRow>(
    "SELECT id, workspace_id, email, role, permissions, created_at FROM members WHERE workspace_id = $1 ORDER BY created_at DESC",
    [workspaceId],
  );
  return rows.map(rowToMember);
}

export async function findById(
  client: pg.PoolClient | null,
  id: string,
): Promise<Member | null> {
  const { rows } = await (client ?? pool).query<MemberRow>(
    "SELECT id, workspace_id, email, role, permissions, created_at FROM members WHERE id = $1",
    [id],
  );
  return rows[0] ? rowToMember(rows[0]) : null;
}

export async function findByEmail(
  workspaceId: string,
  email: string,
): Promise<Member | null> {
  const { rows } = await query<MemberRow>(
    "SELECT id, workspace_id, email, role, permissions, created_at FROM members WHERE workspace_id = $1 AND LOWER(email) = LOWER($2)",
    [workspaceId, email],
  );
  return rows[0] ? rowToMember(rows[0]) : null;
}

export async function create(
  client: pg.PoolClient | null,
  data: {
    id: string;
    workspaceId: string;
    email: string;
    role: Member["role"];
    permissions: string[];
  },
): Promise<Member> {
  const { rows } = await (client ?? pool).query<MemberRow>(
    `INSERT INTO members (id, workspace_id, email, role, permissions, created_at)
     VALUES ($1, $2, $3, $4, $5, now())
     RETURNING id, workspace_id, email, role, permissions, created_at`,
    [data.id, data.workspaceId, data.email, data.role, data.permissions],
  );
  return rowToMember(rows[0]);
}

export async function update(
  client: pg.PoolClient | null,
  id: string,
  data: { role?: Member["role"]; permissions?: string[] },
): Promise<Member | null> {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;
  if (data.role !== undefined) { sets.push(`role = $${idx++}`); params.push(data.role); }
  if (data.permissions !== undefined) { sets.push(`permissions = $${idx++}`); params.push(data.permissions); }
  if (sets.length === 0) return findById(client, id);
  params.push(id);
  const { rows } = await (client ?? pool).query<MemberRow>(
    `UPDATE members SET ${sets.join(", ")} WHERE id = $${idx} RETURNING id, workspace_id, email, role, permissions, created_at`,
    params,
  );
  return rows[0] ? rowToMember(rows[0]) : null;
}

export async function remove(
  client: pg.PoolClient | null,
  id: string,
): Promise<void> {
  await (client ?? pool).query("DELETE FROM members WHERE id = $1", [id]);
}

export async function countOwners(
  workspaceId: string,
): Promise<number> {
  const { rows } = await query(
    "SELECT count(*)::int AS count FROM members WHERE workspace_id = $1 AND role = 'owner'",
    [workspaceId],
  );
  return rows[0].count;
}

export const memberRepo = {
  findByWorkspace,
  findById,
  findByEmail,
  create,
  update,
  remove,
  countOwners,
};
