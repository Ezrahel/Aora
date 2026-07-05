// ============================================================
// Reconciliation Service Tests
// ============================================================

import { describe, it, expect } from "vitest";

// Unit tests for reconciliation logic (stateless helper functions)

function calculateVariance(internalRevenue: number, gatewayRevenue: number) {
  const variance = Math.abs(internalRevenue - gatewayRevenue);
  const variancePercent = internalRevenue > 0
    ? Math.round((variance / internalRevenue) * 100 * 100) / 100
    : 0;
  return { variance, variancePercent };
}

function computeTotals(reports: Array<{ internalRevenue: number; gatewayRevenue: number; variance: number }>) {
  return reports.reduce(
    (acc, r) => ({
      internalRevenue: acc.internalRevenue + r.internalRevenue,
      gatewayRevenue: acc.gatewayRevenue + r.gatewayRevenue,
      variance: acc.variance + r.variance,
    }),
    { internalRevenue: 0, gatewayRevenue: 0, variance: 0 },
  );
}

describe("reconciliation", () => {
  describe("calculateVariance", () => {
    it("should return zero variance when values match", () => {
      const result = calculateVariance(1000, 1000);
      expect(result.variance).toBe(0);
      expect(result.variancePercent).toBe(0);
    });

    it("should calculate positive variance", () => {
      const result = calculateVariance(1000, 1100);
      expect(result.variance).toBe(100);
      expect(result.variancePercent).toBe(10);
    });

    it("should handle zero internal revenue", () => {
      const result = calculateVariance(0, 500);
      expect(result.variance).toBe(500);
      expect(result.variancePercent).toBe(0);
    });

    it("should handle rounding correctly", () => {
      const result = calculateVariance(333, 100);
      const expectedPercent = Math.round((233 / 333) * 100 * 100) / 100;
      expect(result.variance).toBe(233);
      expect(result.variancePercent).toBe(expectedPercent);
    });
  });

  describe("computeTotals", () => {
    it("should sum multiple reports", () => {
      const reports = [
        { internalRevenue: 1000, gatewayRevenue: 1100, variance: 100 },
        { internalRevenue: 500, gatewayRevenue: 500, variance: 0 },
        { internalRevenue: 2000, gatewayRevenue: 1800, variance: 200 },
      ];

      const totals = computeTotals(reports);
      expect(totals.internalRevenue).toBe(3500);
      expect(totals.gatewayRevenue).toBe(3400);
      expect(totals.variance).toBe(300);
    });
  });
});
