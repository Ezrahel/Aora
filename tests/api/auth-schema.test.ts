import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getTableColumns, getTableName } from "drizzle-orm";
import * as schema from "../../src/api/auth/schema.ts";
import { MIGRATION_SQL_FOR_TESTS } from "../../src/api/db/migrate.ts";

// Better Auth rejects every request when these drift from its plugins, and nothing
// else in CI talks to a real database, so a gap here only shows up in production.
describe("Better Auth schema", () => {
  it("defines every field the enabled plugins write", () => {
    expect(getTableColumns(schema.user)).toHaveProperty("twoFactorEnabled");
    expect(getTableColumns(schema.session)).toHaveProperty("token");
    expect(Object.keys(getTableColumns(schema.twoFactor))).toEqual(
      expect.arrayContaining(["secret", "backupCodes", "userId", "verified", "failedVerificationCount", "lockedUntil"]),
    );
  });

  it("has a migration creating each column the schema declares", () => {
    for (const table of [schema.user, schema.session, schema.twoFactor]) {
      for (const column of Object.values(getTableColumns(table))) {
        expect(MIGRATION_SQL_FOR_TESTS, `${getTableName(table)}.${column.name}`).toMatch(new RegExp(`\\b${column.name}\\b`));
      }
    }
  });
});

describe("Better Auth user role", () => {
  it("reaches the session but cannot be set by the client at sign-up", () => {
    const config = readFileSync(join(process.cwd(), "src/api/auth/auth-service.ts"), "utf-8");
    expect(config).toMatch(/role:\s*\{[^}]*input:\s*false[^}]*\}/);
  });
});

describe("migration catalogue", () => {
  it("keeps semicolons out of SQL comments, which the splitter would cut on", () => {
    expect(MIGRATION_SQL_FOR_TESTS).not.toMatch(/^\s*--[^\n]*;/m);
  });
});
