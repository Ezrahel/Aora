// ============================================================
// Auth Session Guard Tests
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Better Auth instance so the middleware tests never touch a DB.
const getSessionMock = vi.fn();
vi.mock("../../src/api/auth/auth-service.ts", () => ({
  getAuth: () => ({
    api: {
      getSession: getSessionMock,
    },
  }),
}));

import {
  requireSession,
  requireOrganizationAccess,
  verifyOrganizationAccess,
} from "../../src/api/auth/session-guard.ts";

function mockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

function mockReq(overrides: any = {}) {
  return {
    method: "GET",
    headers: {},
    params: {},
    query: {},
    body: {},
    ...overrides,
  } as any;
}

beforeEach(() => {
  getSessionMock.mockReset();
});

describe("verifyOrganizationAccess", () => {
  it("returns true when active org matches the target", () => {
    const session = {
      session: { activeOrganizationId: "org_1" },
      user: {},
    } as any;
    expect(verifyOrganizationAccess(session, "org_1")).toBe(true);
  });

  it("returns false when active org differs", () => {
    const session = {
      session: { activeOrganizationId: "org_1" },
      user: {},
    } as any;
    expect(verifyOrganizationAccess(session, "org_2")).toBe(false);
  });

  it("returns false when there is no active org", () => {
    const session = {
      session: {},
      user: {},
    } as any;
    expect(verifyOrganizationAccess(session, "org_2")).toBe(false);
  });
});

describe("requireSession", () => {
  it("returns 401 when no session exists", async () => {
    getSessionMock.mockResolvedValue(null);
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await requireSession()(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body?.code).toBe("NOT_AUTHENTICATED");
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when owner is required but user is a member", async () => {
    getSessionMock.mockResolvedValue({
      session: { activeOrganizationId: "org_1" },
      user: { role: "member" },
    });
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await requireSession({ requireOwner: true })(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body?.code).toBe("FORBIDDEN");
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 400 when an active organization is required but missing", async () => {
    getSessionMock.mockResolvedValue({
      session: {},
      user: { role: "owner" },
    });
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await requireSession()(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body?.code).toBe("NO_ACTIVE_ORGANIZATION");
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() and attaches authUser for a valid admin session", async () => {
    getSessionMock.mockResolvedValue({
      session: { activeOrganizationId: "org_1" },
      user: { id: "u_1", email: "a@b.co", name: "A", role: "admin" },
    });
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await requireSession()(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as any).authUser).toEqual({
      id: "u_1",
      email: "a@b.co",
      name: "A",
      role: "admin",
      activeOrganizationId: "org_1",
    });
  });

  it("returns 500 on unexpected errors", async () => {
    getSessionMock.mockRejectedValue(new Error("boom"));
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await requireSession()(req, res, next);

    expect(res.statusCode).toBe(500);
    expect(res.body?.code).toBe("SESSION_GUARD_ERROR");
  });
});

describe("requireOrganizationAccess", () => {
  it("returns 403 when the active org does not match the target", async () => {
    getSessionMock.mockResolvedValue({
      session: { activeOrganizationId: "org_1" },
      user: { id: "u_1", email: "a@b.co", name: "A", role: "admin" },
    });
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    // First establish the authUser on the request.
    await requireSession()(req, res, next);
    expect(next).toHaveBeenCalled();

    const guard = requireOrganizationAccess("orgId");
    const req2 = mockReq({ params: { orgId: "org_2" } });
    req2.authUser = (req as any).authUser;
    const res2 = mockRes();
    const next2 = vi.fn();

    await guard(req2, res2, next2);

    expect(res2.statusCode).toBe(403);
    expect(res2.body?.code).toBe("ORG_ACCESS_DENIED");
    expect(next2).not.toHaveBeenCalled();
  });

  it("calls next() when the active org matches", async () => {
    getSessionMock.mockResolvedValue({
      session: { activeOrganizationId: "org_1" },
      user: { id: "u_1", email: "a@b.co", name: "A", role: "admin" },
    });
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await requireSession()(req, res, next);
    const req2 = mockReq({ params: { orgId: "org_1" } });
    req2.authUser = (req as any).authUser;
    const res2 = mockRes();
    const next2 = vi.fn();

    await requireOrganizationAccess("orgId")(req2, res2, next2);

    expect(next2).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when the org identifier is missing", async () => {
    const req = mockReq({ params: {} });
    req.authUser = { id: "u_1" };
    const res = mockRes();
    const next = vi.fn();

    await requireOrganizationAccess("orgId")(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body?.code).toBe("MISSING_ORG_ID");
  });

  it("returns 401 when no authUser is attached", async () => {
    const req = mockReq({ params: { orgId: "org_1" } });
    const res = mockRes();
    const next = vi.fn();

    await requireOrganizationAccess("orgId")(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body?.code).toBe("NOT_AUTHENTICATED");
  });
});
