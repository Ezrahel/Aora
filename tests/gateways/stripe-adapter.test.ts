// ============================================================
// Stripe Adapter Tests
// ============================================================

import { describe, it, expect, beforeAll } from "vitest";
import { StripeAdapter } from "../../src/gateways/stripe/index.ts";

const adapter = new StripeAdapter();

describe("StripeAdapter", () => {
  it("should have correct name", () => {
    expect(adapter.name).toBe("stripe");
  });

  it("should report capabilities", () => {
    expect(adapter.capabilities.supportsUsageRecords).toBe(true);
    expect(adapter.capabilities.supportsSubscriptions).toBe(true);
    expect(adapter.capabilities.supportsInvoices).toBe(true);
    expect(adapter.capabilities.usesWebhookSignatures).toBe(true);
  });

  describe("verifyWebhookSignature", () => {
    it("should return false for empty signature", () => {
      const result = adapter.verifyWebhookSignature("{}", "", "whsec_test");
      expect(result).toBe(false);
    });

    it("should return false for non-matching signature", () => {
      const result = adapter.verifyWebhookSignature(
        '{"type":"charge.succeeded"}',
        "t=1234567890,v1=bad_signature",
        "whsec_test",
      );
      expect(result).toBe(false);
    });

    it("should return false when v1 is missing", () => {
      const result = adapter.verifyWebhookSignature(
        '{"type":"charge.succeeded"}',
        "t=1234567890,v0=old_signature",
        "whsec_test",
      );
      expect(result).toBe(false);
    });
  });

  describe("mapWebhookEvent", () => {
    it("should map charge.succeeded", () => {
      const event = {
        id: "evt_123",
        type: "charge.succeeded",
        data: {
          object: {
            id: "ch_456",
            customer: "cus_789",
            subscription: "sub_012",
            invoice: "in_345",
            amount: 2000,
            currency: "usd",
            status: "succeeded",
          },
        },
      };

      const mapped = adapter.mapWebhookEvent("stripe", event);
      expect(mapped).not.toBeNull();
      expect(mapped!.type).toBe("charge.succeeded");
      expect(mapped!.eventId).toBe("evt_123");
      expect(mapped!.customerId).toBe("cus_789");
      expect(mapped!.subscriptionId).toBe("sub_012");
      expect(mapped!.invoiceId).toBe("in_345");
      expect(mapped!.amount).toBe(20); // 2000 / 100
      expect(mapped!.currency).toBe("usd");
    });

    it("should map customer.subscription.deleted", () => {
      const event = {
        id: "evt_456",
        type: "customer.subscription.deleted",
        data: {
          object: {
            id: "sub_012",
            customer: "cus_789",
            status: "canceled",
          },
        },
      };

      const mapped = adapter.mapWebhookEvent("stripe", event);
      expect(mapped).not.toBeNull();
      expect(mapped!.type).toBe("customer.subscription.deleted");
      expect(mapped!.subscriptionId).toBe("sub_012");
      expect(mapped!.customerId).toBe("cus_789");
    });

    it("should return null for null event", () => {
      expect(adapter.mapWebhookEvent("stripe", null)).toBeNull();
    });

    it("should return base event for unknown types", () => {
      const event = {
        id: "evt_unknown",
        type: "unknown.event",
        data: { object: {} },
      };
      const mapped = adapter.mapWebhookEvent("stripe", event);
      expect(mapped).not.toBeNull();
      expect(mapped!.type).toBe("unknown.event");
      expect(mapped!.customerId).toBeUndefined();
    });
  });
});
