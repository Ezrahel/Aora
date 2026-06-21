import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import pool, { withTransaction } from "./pool.ts";

const MIGRATIONS_DIR = path.join(import.meta.dirname, "migrations");

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     INT PRIMARY KEY,
      description STRING(500) NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      checksum    STRING(64)
    )
  `);
}

function computeChecksum(sql: string): string {
  return createHash("sha256").update(sql).digest("hex");
}

async function getAppliedVersions(): Promise<Set<number>> {
  const { rows } = await pool.query<{ version: number }>(
    "SELECT version FROM schema_migrations ORDER BY version",
  );
  return new Set(rows.map((r) => r.version));
}

export async function runMigrations(): Promise<void> {
  await ensureMigrationsTable();

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applied = await getAppliedVersions();

  for (const file of files) {
    const match = file.match(/^(\d+)_/);
    if (!match) {
      console.warn(`Skipping migration file without version prefix: ${file}`);
      continue;
    }
    const version = parseInt(match[1], 10);
    if (applied.has(version)) continue;

    const sqlPath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(sqlPath, "utf-8");
    const checksum = computeChecksum(sql);

    const description = file.replace(/^\d+_/, "").replace(/\.sql$/, "");

    await withTransaction(async (client) => {
      // Split on semicolons and execute each statement
      const statements = sql
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith("--"));

      for (const stmt of statements) {
        await client.query(stmt);
      }

      await client.query(
        `INSERT INTO schema_migrations (version, description, checksum)
         VALUES ($1, $2, $3)`,
        [version, description, checksum],
      );
    });

    console.log(`Migration ${version} applied: ${description}`);
  }

  console.log("All migrations up to date.");
}

export async function migrateDown(version: number): Promise<void> {
  // CockroachDB DDL is transactional but not reversible generically.
  // Implement specific down-migrations as needed.
  throw new Error("Down migrations not implemented. Use BACKUP restore for rollbacks.");
}
