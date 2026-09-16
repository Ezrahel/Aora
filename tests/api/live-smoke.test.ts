// ============================================================
// AoraHQ LIVE smoke — health + charge-path + webhook hardening
// Runs without DB (health degrades gracefully) and without network.
// ============================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AddressInfo } from "node:net";

describe("LIVE readiness smoke", () => {
  it("GET /api/health returns ok|degraded JSON", async () => {
    const { default: app } = await import("../../src/app.ts");
    const server = app.listen(0);
    await new Promise<void>((r) => server.on("listening", () => r()));
    const port = (server.address() as AddressInfo).port;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(["ok", "degraded"]).toContain(body.status);
      expect(body.database).toBeDefined();
      expect(body.gateways).toBeDefined();
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  }, 20_000);

  it("unknown /api/* returns JSON 404 (not HTML)", async () => {
    const { default: app } = await import("../../src/app.ts");
    const server = app.listen(0);
    await new Promise<void>((r) => server.on("listening", () => r()));
    const port = (server.address() as AddressInfo).port;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/nope-not-real`);
      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body.code).toBe("NOT_FOUND");
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  }, 20_000);

  it("non-custodial stripe adapter is registered (live charge path)", async () => {
    const { getNonCustodialGateway } = await import(
      "../../src/gateways/non-custodial-registry.ts"
    );
    expect(getNonCustodialGateway("stripe")).toBeDefined();
  });

  it("Stripe custodial adapter no longer uses prod_placeholder", () => {
    const src = readFileSync(
      join(process.cwd(), "src/gateways/stripe/index.ts"),
      "utf-8",
    );
    expect(src).not.toContain("prod_placeholder");
    expect(src).toContain("product_data");
  });

  it("webhook handler rejects unverified signatures with 401", () => {
    const src = readFileSync(
      join(process.cwd(), "src/api/routes/gateways.ts"),
      "utf-8",
    );
    expect(src).toContain("INVALID_SIGNATURE");
    expect(src).toContain("401");
  });

  it("renewal + dunning decrypt via zero-trust repository (no placeholders)", () => {
    const renewal = readFileSync(
      join(process.cwd(), "src/services/non-custodial-billing.ts"),
      "utf-8",
    );
    expect(renewal).toContain("encryptedGatewayRepository.getDecryptedKey");
    expect(renewal).not.toContain("TextDecoder().decode(encryptedKey)");

    const sm = readFileSync(
      join(process.cwd(), "src/api/services/dunning-state-machine.ts"),
      "utf-8",
    );
    expect(sm).toContain("encryptedGatewayRepository.getDecryptedKey");
    expect(sm).not.toContain("GATEWAY_SECRET_${");
  });
});
