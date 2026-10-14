import { describe, expect, it } from "vitest";
import { splitSqlStatements, validateMigrationDefinitions } from "../../src/api/db/migrate.ts";

describe("migration safety", () => {
  it("accepts the checked-in migration catalogue", () => {
    expect(() => validateMigrationDefinitions()).not.toThrow();
  });

  it("does not split semicolons inside literals or dollar-quoted blocks", () => {
    const statements = splitSqlStatements(
      "INSERT INTO audit_logs (message) VALUES ('a; b'); DO $$ BEGIN PERFORM 'c; d'; END $$; SELECT 1;",
    );
    expect(statements).toEqual([
      "INSERT INTO audit_logs (message) VALUES ('a; b')",
      "DO $$ BEGIN PERFORM 'c; d'; END $$",
      "SELECT 1",
    ]);
  });
});
