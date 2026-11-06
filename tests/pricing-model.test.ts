import { describe, it, expect } from "vitest";
import { PRESETS, computeInvoice, configFromPrompt, parseConfig } from "../src/components/landing/pricing-model";

const input = { usage: 35000, seats: 15 };

describe("computeInvoice", () => {
  it("charges a flat fee regardless of usage", () => {
    expect(computeInvoice(PRESETS.flat, input).total).toBe(149);
  });

  it("bills seats beyond the included allowance", () => {
    expect(computeInvoice(PRESETS.seat, input).total).toBe(12 * 29);
    expect(computeInvoice(PRESETS.seat, { usage: 0, seats: 2 }).total).toBe(0);
  });

  it("adds overage on top of the hybrid base", () => {
    expect(computeInvoice(PRESETS.hybrid, input).total).toBe(149 + 25000 * 0.02);
    expect(computeInvoice(PRESETS.hybrid, { usage: 5000, seats: 1 }).total).toBe(149);
  });

  it("walks graduated tiers one band at a time", () => {
    const preview = computeInvoice(PRESETS.tiered, { usage: 60000, seats: 1 });
    expect(preview.lines).toHaveLength(3);
    expect(preview.total).toBe(10000 * 0.03 + 40000 * 0.02 + 10000 * 0.012);
  });

  it("prices all units at the single bracket reached by volume", () => {
    expect(computeInvoice(PRESETS.volume, { usage: 100000, seats: 1 }).total).toBe(1500);
    expect(computeInvoice(PRESETS.volume, { usage: 100001, seats: 1 }).total).toBe(1000.01);
  });

  it("rounds packages up to whole bundles", () => {
    expect(computeInvoice(PRESETS.package, { usage: 5001, seats: 1 }).total).toBe(150);
  });

  it("handles zero usage on tiered prices", () => {
    expect(computeInvoice(PRESETS.tiered, { usage: 0, seats: 1 })).toEqual({ lines: [], total: 0 });
  });
});

describe("parseConfig", () => {
  it("accepts every preset", () => {
    for (const preset of Object.values(PRESETS)) {
      expect(parseConfig(JSON.stringify(preset)).ok).toBe(true);
    }
  });

  it.each([
    ["{ nope", /JSON|Expected|property/i],
    ["[]", /object/],
    [`{"type":"barter","baseFee":0}`, /must be one of/],
    [`{"type":"flat","baseFee":-1}`, /baseFee/],
    [`{"type":"tiered","baseFee":0}`, /tiers/],
    [`{"type":"tiered","baseFee":0,"tiers":[{"upTo":"many","unitPrice":1}]}`, /upTo/],
  ])("rejects %s", (source, message) => {
    const result = parseConfig(source);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(message);
  });
});

describe("configFromPrompt", () => {
  it("reads a base fee, allowance, and overage", () => {
    expect(configFromPrompt("$49/mo plus $0.02 per call over 10k")).toMatchObject({
      type: "hybrid",
      baseFee: 49,
      includedUsage: 10000,
      overageUnitPrice: 0.02,
    });
  });

  it("recognises each pricing family", () => {
    expect(configFromPrompt("$12 per seat")).toMatchObject({ type: "seat", seatPrice: 12 });
    expect(configFromPrompt("$0.004 per token")).toMatchObject({ type: "usage", overageUnitPrice: 0.004 });
    expect(configFromPrompt("$99 a month")).toMatchObject({ type: "flat", baseFee: 99 });
    expect(configFromPrompt("packs of 2,000 for $40")).toMatchObject({ type: "package", packageSize: 2000, packagePrice: 40 });
    expect(configFromPrompt("graduated tiers")?.type).toBe("tiered");
    expect(configFromPrompt("volume discounts")?.type).toBe("volume");
  });

  it("returns null when nothing is recognised", () => {
    expect(configFromPrompt("hello there")).toBeNull();
  });
});
