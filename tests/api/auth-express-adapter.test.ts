// ============================================================
// Express ↔ Web Request Adapter Tests
// ============================================================

import { describe, it, expect, vi } from "vitest";
import { webHandler } from "../../src/api/auth/express-adapter.ts";

function mockExpressReq(overrides: any = {}) {
  return {
    method: "POST",
    headers: { host: "localhost:3000", "content-type": "application/json" },
    originalUrl: "/api/auth/sign-in/email",
    protocol: "http",
    body: { email: "a@b.co", password: "password12345" },
    ...overrides,
  } as any;
}

function mockExpressRes() {
  const res: any = {
    headersSent: false,
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null,
    ended: false,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = JSON.stringify(payload);
      this.ended = true;
      return this;
    },
    setHeader(key: string, value: string) {
      this.headers[key] = value;
      return this;
    },
    end(chunk?: any) {
      this.body = chunk ? Buffer.from(chunk).toString() : null;
      this.ended = true;
      return this;
    },
  };
  return res;
}

describe("webHandler", () => {
  it("forwards the request and writes the web response", async () => {
    const handler = vi.fn(async (req: Request) => {
      // The converted request must be a Web-standard Request.
      expect(req).toBeInstanceOf(Request);
      expect(req.url).toBe("http://localhost:3000/api/auth/sign-in/email");
      expect(req.method).toBe("POST");
      const parsed = JSON.parse(await req.text());
      expect(parsed.email).toBe("a@b.co");
      return new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    });

    const res = mockExpressRes();
    await webHandler(handler)(mockExpressReq(), res);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(201);
    expect(res.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });

  it("does not send a body for GET requests", async () => {
    const handler = vi.fn(async () => new Response(null, { status: 204 }));
    const res = mockExpressRes();

    await webHandler(handler)(
      mockExpressReq({ method: "GET", body: undefined }),
      res,
    );

    expect(res.statusCode).toBe(204);
    expect(res.body).toBeNull();
  });

  it("returns 500 when the handler throws", async () => {
    const handler = vi.fn(async () => {
      throw new Error("boom");
    });
    const res = mockExpressRes();

    await webHandler(handler)(mockExpressReq(), res);

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body)).toEqual({ error: "Internal server error" });
  });

  it("does not attempt to respond if headers were already sent", async () => {
    const handler = vi.fn(async () => {
      throw new Error("boom");
    });
    const res = mockExpressRes();
    res.headersSent = true;
    res.json = vi.fn();

    await webHandler(handler)(mockExpressReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.json).not.toHaveBeenCalled();
  });
});
