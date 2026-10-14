import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("dashboard and machine API boundaries", () => {
  it("requires a dashboard session before mounting resource routes", () => {
    const source = read("src/api/router.ts");
    expect(source.indexOf("apiRouter.use(requireSession())")).toBeGreaterThan(
      source.indexOf("apiRouter.use(waitlistRouter)"),
    );
    expect(source.indexOf("apiRouter.use(requireSession())")).toBeLessThan(
      source.indexOf("apiRouter.use(workspacesRouter)"),
    );
  });

  it("keeps API-key authentication constrained to ingress", () => {
    const source = read("src/api/router.ts");
    expect(source).toContain("machineRouter.use(ingressRouter)");
    expect(source).not.toContain("machineRouter.use(gatewaysRouter)");
  });

  it("does not resolve dashboard workspaces from the first database row", () => {
    const source = read("src/api/db.ts");
    expect(source).toContain("resolveWorkspaceForOrganization");
    expect(source).not.toContain("return all[0]");
  });
});
