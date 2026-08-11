// ============================================================
// AoraHQ Sandbox Payment Adapter
//
// Safe simulation of payment gateway operations for sandbox/test
// environments. No external API calls are made — all transactions
// are simulated locally.
//
// Simulated decline: amounts where the last 4 digits are 4002
//   (e.g., 4002¢, 1_004_002¢) — mirrors Stripe's 400000... card
//   pattern for testing intentional declines.
// ============================================================

import type {
  NonCustodialPaymentGateway,
  ChargeTokenParams,
  ChargeResult,
  RefundParams,
  RefundResult,
} from "./non-custodial-adapter.ts";
import { NonCustodialBillingError } from "./non-custodial-adapter.ts";

// ── Constants ──────────────────────────────────────────────

const SIMULATED_DECLINE_SUFFIX = 4002;

let mockCounter = 0;

function nextMockId(prefix: string): string {
  mockCounter++;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_sandbox_${ts}_${rand}_${mockCounter}`;
}

// ── Adapter ────────────────────────────────────────────────

export class SandboxPaymentAdapter implements NonCustodialPaymentGateway {
  readonly name = "sandbox";

  /**
   * Simulate charging a saved payment token.
   *
   * - If the amount (in lowest denomination) ends with 4002,
   *   the charge is declined with a card_declined error.
   * - Otherwise, the charge is simulated as successful.
   *
   * No network calls are made. The function returns instantly
   * with deterministic mock data.
   */
  async chargeToken(params: ChargeTokenParams): Promise<ChargeResult> {
    // Validate params
    if (!params.amount || params.amount <= 0n) {
      throw new NonCustodialBillingError(
        "Invalid amount: must be positive",
        "INVALID_AMOUNT",
        "sandbox",
        false,
      );
    }

    // Simulate decline for amounts ending in 4002
    const amountNum = Number(params.amount);
    const lastFour = amountNum % 10_000;
    if (lastFour === SIMULATED_DECLINE_SUFFIX) {
      throw new NonCustodialBillingError(
        `Simulated card decline for amount ending in 4002 (${params.currency} ${params.amount})`,
        "card_declined",
        "sandbox",
        true,
      );
    }

    // Simulate network latency (5-15ms)
    await new Promise((r) => setTimeout(r, 5 + Math.random() * 10));

    const transactionId = nextMockId("ch");

    return {
      transactionId,
      amount: params.amount,
      currency: params.currency,
      status: "succeeded",
      rawResponse: {
        id: transactionId,
        object: "charge",
        amount: Number(params.amount),
        currency: params.currency,
        status: "succeeded",
        paid: true,
        sandbox: true,
        created: Date.now(),
        metadata: params.metadata,
      },
    };
  }

  /**
   * Simulate refunding a previous charge.
   * Always succeeds in sandbox mode.
   */
  async refund(params: RefundParams): Promise<RefundResult> {
    // Simulate network latency (5-10ms)
    await new Promise((r) => setTimeout(r, 5 + Math.random() * 5));

    const refundId = nextMockId("ref");

    return {
      refundId,
      amount: params.amount ?? 0n,
      currency: params.currency,
      status: "succeeded",
      rawResponse: {
        id: refundId,
        object: "refund",
        amount: params.amount ? Number(params.amount) : null,
        currency: params.currency,
        status: "succeeded",
        charge: params.transactionId,
        sandbox: true,
        created: Date.now(),
      },
    };
  }
}

export const sandboxPaymentAdapter = new SandboxPaymentAdapter();
