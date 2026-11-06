import { describe, expect, it } from "vitest";
import { defaultOrganizationId, defaultOrganizationName } from "../../src/api/auth/provision.ts";

describe("default organization", () => {
  it("derives one stable UUID per user, so concurrent logins cannot create two", () => {
    expect(defaultOrganizationId("user_1")).toBe(defaultOrganizationId("user_1"));
    expect(defaultOrganizationId("user_1")).not.toBe(defaultOrganizationId("user_2"));
    expect(defaultOrganizationId("user_1")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("names the workspace after the person, falling back to their email", () => {
    expect(defaultOrganizationName({ name: "Ada", email: "a@b.co" })).toBe("Ada's workspace");
    expect(defaultOrganizationName({ name: "  ", email: "ada@b.co" })).toBe("ada's workspace");
    expect(defaultOrganizationName({})).toBe("My workspace");
  });
});
