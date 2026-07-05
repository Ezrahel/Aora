// ============================================================
// Dunning Service Tests
// ============================================================

import { describe, it, expect } from "vitest";

const DUNNING_INTERVALS = [1, 3, 7, 14];
const MAX_ATTEMPTS = 5;

function getScheduledAttempts(invoiceId: string) {
  return DUNNING_INTERVALS.map((days, i) => ({
    id: `dun_${invoiceId}_${i}`,
    invoiceId,
    attemptNumber: i + 1,
    action: i === 0 ? "email_reminder" : "retry_payment",
    scheduledAt: new Date(Date.now() + days * 86400000).toISOString(),
    status: "pending",
  }));
}

describe("dunning", () => {
  describe("schedule dunning", () => {
    it("should schedule 4 attempts at correct intervals", () => {
      const attempts = getScheduledAttempts("inv_123");
      expect(attempts).toHaveLength(4);
      expect(attempts[0].action).toBe("email_reminder");
      expect(attempts[1].action).toBe("retry_payment");
      expect(attempts[2].action).toBe("retry_payment");
      expect(attempts[3].action).toBe("retry_payment");
    });

    it("should have increasing attempt numbers", () => {
      const attempts = getScheduledAttempts("inv_123");
      expect(attempts.map((a) => a.attemptNumber)).toEqual([1, 2, 3, 4]);
    });

    it("should schedule first email at day 1", () => {
      const attempts = getScheduledAttempts("inv_123");
      const now = Date.now();
      const day1 = new Date(now + 1 * 86400000).getTime();
      const scheduledDay1 = new Date(attempts[0].scheduledAt).getTime();
      expect(Math.abs(scheduledDay1 - day1)).toBeLessThan(1000);
    });
  });

  describe("max attempts", () => {
    it("should not exceed MAX_ATTEMPTS", () => {
      const attempts = getScheduledAttempts("inv_123");
      attempts.forEach((a) => expect(a.attemptNumber).toBeLessThanOrEqual(MAX_ATTEMPTS));
    });
  });
});
