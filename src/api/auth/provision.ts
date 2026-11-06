import { createHash } from "node:crypto";
import type pg from "pg";
import { withTransaction } from "../db/pool.ts";

/**
 * Derived from the user id so concurrent first logins converge on one organization
 * instead of racing to create two. Formatted as a UUID because the id is shared by
 * Better Auth's `organization` table and the billing `organizations` table.
 */
export function defaultOrganizationId(userId: string): string {
  const hex = createHash("sha256").update(`aora-default-org:${userId}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function defaultOrganizationName(user: { name?: string | null; email?: string | null }): string {
  const label = user.name?.trim() || user.email?.split("@")[0];
  return label ? `${label}'s workspace` : "My workspace";
}

async function provision(client: pg.PoolClient, userId: string): Promise<string | null> {
  const member = await client.query<{ organization_id: string }>(
    `SELECT organization_id FROM "member" WHERE user_id = $1 ORDER BY created_at LIMIT 1`,
    [userId],
  );
  if (member.rows[0]) return member.rows[0].organization_id;

  const user = await client.query<{ name: string; email: string }>(
    `SELECT name, email FROM "user" WHERE id = $1`,
    [userId],
  );
  if (!user.rows[0]) return null;

  const id = defaultOrganizationId(userId);
  const name = defaultOrganizationName(user.rows[0]);

  await client.query(
    `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
    [id, name],
  );
  await client.query(
    `INSERT INTO "organization" (id, name, slug) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
    [id, name, `org-${id}`],
  );
  await client.query(
    `INSERT INTO "member" (id, organization_id, user_id, role) VALUES ($1, $2, $3, 'owner') ON CONFLICT (id) DO NOTHING`,
    [`mem-${id}`, id, userId],
  );
  await client.query(
    `INSERT INTO workspaces (organization_id, name, environment) VALUES ($1, $2, 'production')
     ON CONFLICT (organization_id, name, environment) DO NOTHING`,
    [id, name],
  );
  return id;
}

/** Returns the user's organization, creating their first one and its workspace if needed. */
export function ensureDefaultOrganization(userId: string): Promise<string | null> {
  return withTransaction((client) => provision(client, userId));
}
