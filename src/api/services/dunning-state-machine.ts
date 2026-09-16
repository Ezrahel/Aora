// ============================================================
// AoraHQ Dunning & Automated Retry State Machine
//
// Manages the lifecycle of subscription payment failures through
// a configurable dunning sequence. The default policy:
//
//   Step 0: No failure — subscription billing normally
//   Step 1: First failure → keep active, retry in 3 days
//   Step 2: Second failure → set past_due, final retry in 4 days
//   Step 3:  Final failure → cancel subscription
//
// State transitions are deterministic and use SERIALIZABLE
// transactions to prevent race conditions.
// ============================================================

import { query, withTransaction, type Client } from "../db/pool.ts";
import {
  webhookOutboxRepository,
} from "./webhook-outbox-repository.ts";
import type { NonCustodialPaymentGateway } from "../../gateways/non-custodial-adapter.ts";
import { getNonCustodialGateway } from "../../gateways/non-custodial-registry.ts";
import { encryptedGatewayRepository } from "../../gateways/encrypted-gateway-repository.ts";

// ── Constants ──────────────────────────────────────────────

const DEFAULT_RETRY_DELAY_DAYS_STEP1 = 3;
const DEFAULT_RETRY_DELAY_DAYS_STEP2 = 4;
const MILLISECONDS_PER_DAY = 86_400_000;

// ── Types ──────────────────────────────────────────────────

export type SubscriptionStatus =
  | "active"
  | "trial"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused";

export type DunningStep = 0 | 1 | 2;

export type RetryResult =
  | { success: true; newPeriodEnd: string }
  | { success: false; error: string; nextStep: DunningStep; nextStatus: SubscriptionStatus };

export interface DunningSubscription {
  id: string;
  customerId: string;
  planId: string;
  workspaceId: string;
  status: SubscriptionStatus;
  dunningStep: DunningStep;
  nextRetryAt: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  seatQuantity: number;
  metadata: Record<string, unknown>;
}

export interface RetryLogRow {
  id: string;
  subscriptionId: string;
  attemptNumber: number;
  dunningStep: number;
  amountCents: number;
  status: "success" | "failed";
  errorMessage: string | null;
  gatewayResponse: Record<string, unknown> | null;
  attemptedAt: string;
}

// ── Dunning Configuration ──────────────────────────────────

export interface DunningConfig {
  retryDelayDaysStep1: number;
  retryDelayDaysStep2: number;
  webhookEndpointId: string;
}

const defaultConfig: DunningConfig = {
  retryDelayDaysStep1: DEFAULT_RETRY_DELAY_DAYS_STEP1,
  retryDelayDaysStep2: DEFAULT_RETRY_DELAY_DAYS_STEP2,
  webhookEndpointId: "",
};

// ── State Machine ──────────────────────────────────────────

export class DunningStateMachine {
  private config: DunningConfig;

  constructor(config: Partial<DunningConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Handle the initial payment failure for a subscription.
   *
   * Transitions:
   *   Step 0 → Step 1
   *   Status stays `active` (grace period)
   *   Schedules next retry in `retryDelayDaysStep1` days
   *
   * This is designed to be called inside an existing transaction
   * alongside any outbox event writes.
   */
  async handleInitialPaymentFailure(
    client: Client,
    subscriptionId: string,
    workspaceId: string,
    planPriceCents: bigint,
    errorMessage: string,
    gatewayResponse?: Record<string, unknown>,
  ): Promise<void> {
    const now = new Date();
    const nextRetry = new Date(
      now.getTime() + this.config.retryDelayDaysStep1 * MILLISECONDS_PER_DAY,
    );

    // Update subscription
    const { rowCount } = await client.query(
      `UPDATE subscriptions
       SET dunning_step = 1,
           next_retry_at = $2,
           last_payment_attempt_at = now(),
           updated_at = now()
       WHERE id = $1
         AND dunning_step = 0
         AND status = 'active'`,
      [subscriptionId, nextRetry.toISOString()],
    );

    if (rowCount === 0) {
      throw new Error(
        `Dunning: subscription ${subscriptionId} not in Step 0 / active state`,
      );
    }

    // Log the failed attempt
    await this.logAttempt(client, {
      subscriptionId,
      attemptNumber: 1,
      dunningStep: 1,
      amountCents: Number(planPriceCents),
      status: "failed",
      errorMessage,
      gatewayResponse,
    });

    // Dispatch webhook outbox event
    if (this.config.webhookEndpointId) {
      await webhookOutboxRepository.insert(client, {
        tenantId: workspaceId,
        workspaceId,
        webhookId: this.config.webhookEndpointId,
        eventType: "invoice.payment_failed",
        payload: {
          subscriptionId,
          dunningStep: 1,
          nextRetryAt: nextRetry.toISOString(),
          error: errorMessage,
          attemptNumber: 1,
        },
      });
    }
  }

  /**
   * Process a scheduled retry attempt for a subscription.
   *
   * This is the core state transition method. It:
   *   1. Fetches and locks the subscription row
   *   2. Initiates a charge via the gateway adapter
   *   3. On success: resets dunning, updates period
   *   4. On failure: transitions to next dunning step
   *
   * Safe to call concurrently — uses SELECT FOR UPDATE.
   */
  async handleRetryAttempt(
    subscriptionId: string,
    workspaceId: string,
  ): Promise<RetryResult> {
    return withTransaction(async (client) => {
      // 1. Lock and fetch the subscription
      const { rows } = await client.query(
        `SELECT s.*, c.workspace_id, c.id as customer_id,
                pl.price as plan_price_cents,
                pl.currency as plan_currency,
                pl.billing_period
         FROM subscriptions s
         JOIN customers c ON c.id = s.customer_id
         JOIN plans pl ON pl.id = s.plan_id
         WHERE s.id = $1
         FOR UPDATE OF s SKIP LOCKED`,
        [subscriptionId],
      );

      if (rows.length === 0) {
        return { success: false, error: "Subscription not found", nextStep: 0 as DunningStep, nextStatus: "canceled" as SubscriptionStatus };
      }

      const sub = rows[0];

      // Validate dunning state
      if (sub.dunning_step !== 1 && sub.dunning_step !== 2) {
        return {
          success: false,
          error: `Subscription is not in dunning (step=${sub.dunning_step})`,
          nextStep: sub.dunning_step as DunningStep,
          nextStatus: sub.status as SubscriptionStatus,
        };
      }

      const priceCents = BigInt(Math.round(parseFloat(sub.plan_price_cents) * 10000));
      const attemptNumber = sub.dunning_step === 1 ? 2 : 3;

      // 2. Attempt the charge
      const customerToken = sub.gateway_customer_id;
      const paymentToken = sub.payment_method?.id ?? sub.gateway_payment_method_id;

      if (!customerToken || !paymentToken) {
        // No payment method — fail fast
        return this.handleChargeFailure(client, sub, attemptNumber, "No payment method on file", null);
      }

      const gateway = getNonCustodialGateway(sub.gateway || "stripe");
      if (!gateway) {
        return this.handleChargeFailure(client, sub, attemptNumber, "No gateway configured for workspace", null);
      }

      // Decrypt the gateway secret key via zero-trust repository.
      // Subscription rows carry tenant_gateway_id; fall back to workspace lookup.
      let secretKey = "";
      let wipeCred: (() => void) | null = null;
      try {
        const gatewayId: string | null =
          (sub as any).tenant_gateway_id ?? (sub as any).tenantGatewayId ?? null;
        if (gatewayId) {
          const credential = await encryptedGatewayRepository.getDecryptedKey(gatewayId);
          secretKey = credential.secretKey;
          wipeCred = () => {
            credential.secretKeyBuffer.wipe();
            credential.webhookBuffer?.wipe();
          };
        } else {
          // Fallback: most recent verified gateway for this workspace
          const conns = await encryptedGatewayRepository.findByWorkspace(
            (sub as any).workspace_id ?? workspaceId,
          );
          const verified = conns.find((c) => c.isVerified) ?? conns[0];
          if (verified) {
            const credential = await encryptedGatewayRepository.getDecryptedKey(verified.id);
            secretKey = credential.secretKey;
            wipeCred = () => {
              credential.secretKeyBuffer.wipe();
              credential.webhookBuffer?.wipe();
            };
          }
        }
      } catch (decErr) {
        return this.handleChargeFailure(client, sub, attemptNumber, `Gateway key decryption failed: ${(decErr as Error).message}`, null);
      }

      try {
        const chargeResult = await gateway.chargeToken({
          secretKey,
          customerToken,
          paymentToken,
          amount: priceCents,
          currency: sub.plan_currency || "usd",
          description: `Subscription renewal (attempt ${attemptNumber})`,
        });
        wipeCred?.();

        // 3. Charge succeeded — reset dunning state
        const now = new Date();
        const periodEnd = this.calculateNextPeriodEnd(
          new Date(sub.current_period_end),
          sub.billing_period || "monthly",
        );

        await client.query(
          `UPDATE subscriptions
           SET dunning_step = 0,
               next_retry_at = NULL,
               last_payment_attempt_at = now(),
               status = 'active',
               current_period_end = $2,
               updated_at = now()
           WHERE id = $1`,
          [subscriptionId, periodEnd.toISOString()],
        );

        // Log success
        await this.logAttempt(client, {
          subscriptionId,
          attemptNumber,
          dunningStep: sub.dunning_step,
          amountCents: Number(priceCents),
          status: "success",
          errorMessage: null,
          gatewayResponse: chargeResult.rawResponse,
        });

        // Dispatch success webhook
        if (this.config.webhookEndpointId) {
          await webhookOutboxRepository.insert(client, {
            tenantId: workspaceId,
            workspaceId,
            webhookId: this.config.webhookEndpointId,
            eventType: "invoice.payment_succeeded",
            payload: {
              subscriptionId,
              attemptNumber,
              transactionId: chargeResult.transactionId,
              amount: chargeResult.amount.toString(),
              currency: chargeResult.currency,
              nextPeriodEnd: periodEnd.toISOString(),
            },
          });
        }

        return {
          success: true,
          newPeriodEnd: periodEnd.toISOString(),
        };
      } catch (err) {
        try { wipeCred?.(); } catch { /* already wiped */ }
        const error = (err as Error).message;
        return this.handleChargeFailure(
          client,
          sub,
          attemptNumber,
          error,
          (err as any).rawResponse ?? null,
        );
      }
    });
  }

  /**
   * Handle a failed charge attempt during retry.
   * This is the core state transition logic.
   */
  private async handleChargeFailure(
    client: Client,
    sub: any,
    attemptNumber: number,
    error: string,
    gatewayResponse: Record<string, unknown> | null,
  ): Promise<RetryResult> {
    const now = new Date();
    const currentStep = sub.dunning_step as DunningStep;

    if (currentStep === 1) {
      // Step 1 failure → transition to Step 2 (past_due, retry in 4 days)
      const nextRetry = new Date(
        now.getTime() + this.config.retryDelayDaysStep2 * MILLISECONDS_PER_DAY,
      );

      await client.query(
        `UPDATE subscriptions
         SET dunning_step = 2,
             next_retry_at = $2,
             last_payment_attempt_at = now(),
             status = 'past_due',
             updated_at = now()
         WHERE id = $1`,
        [sub.id, nextRetry.toISOString()],
      );

      await this.logAttempt(client, {
        subscriptionId: sub.id,
        attemptNumber,
        dunningStep: 2,
        amountCents: Number(sub.plan_price_cents),
        status: "failed",
        errorMessage: error,
        gatewayResponse,
      });

      if (this.config.webhookEndpointId) {
        await webhookOutboxRepository.insert(client, {
          tenantId: sub.workspace_id,
          workspaceId: sub.workspace_id,
          webhookId: this.config.webhookEndpointId,
          eventType: "subscription.past_due",
          payload: {
            subscriptionId: sub.id,
            dunningStep: 2,
            nextRetryAt: nextRetry.toISOString(),
            error,
            attemptNumber,
          },
        });
      }

      return {
        success: false,
        error,
        nextStep: 2 as DunningStep,
        nextStatus: "past_due" as SubscriptionStatus,
      };
    } else {
      // Step 2 failure → final failure, cancel
      await client.query(
        `UPDATE subscriptions
         SET dunning_step = 0,
             next_retry_at = NULL,
             last_payment_attempt_at = now(),
             status = 'canceled',
             canceled_at = now(),
             updated_at = now()
         WHERE id = $1`,
        [sub.id],
      );

      await this.logAttempt(client, {
        subscriptionId: sub.id,
        attemptNumber,
        dunningStep: 3,
        amountCents: Number(sub.plan_price_cents),
        status: "failed",
        errorMessage: error,
        gatewayResponse,
      });

      if (this.config.webhookEndpointId) {
        await webhookOutboxRepository.insert(client, {
          tenantId: sub.workspace_id,
          workspaceId: sub.workspace_id,
          webhookId: this.config.webhookEndpointId,
          eventType: "subscription.canceled",
          payload: {
            subscriptionId: sub.id,
            reason: "dunning_max_retries",
            error,
            finalAttemptNumber: attemptNumber,
          },
        });
      }

      return {
        success: false,
        error,
        nextStep: 0 as DunningStep,
        nextStatus: "canceled" as SubscriptionStatus,
      };
    }
  }

  /**
   * Calculate the next billing period end date.
   */
  private calculateNextPeriodEnd(
    currentPeriodEnd: Date,
    billingPeriod: string,
  ): Date {
    const next = new Date(currentPeriodEnd);
    switch (billingPeriod) {
      case "weekly":
        next.setDate(next.getDate() + 7);
        break;
      case "monthly":
        next.setMonth(next.getMonth() + 1);
        break;
      case "yearly":
        next.setFullYear(next.getFullYear() + 1);
        break;
      default:
        next.setMonth(next.getMonth() + 1);
    }
    return next;
  }

  /**
   * Log an attempt to the dunning_retry_log table.
   */
  private async logAttempt(
    client: Client,
    input: {
      subscriptionId: string;
      attemptNumber: number;
      dunningStep: number;
      amountCents: number;
      status: "success" | "failed";
      errorMessage: string | null;
      gatewayResponse: Record<string, unknown> | null;
    },
  ): Promise<void> {
    await client.query(
      `INSERT INTO dunning_retry_log
        (subscription_id, attempt_number, dunning_step, amount_cents,
         status, error_message, gateway_response, attempted_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())`,
      [
        input.subscriptionId,
        input.attemptNumber,
        input.dunningStep,
        input.amountCents,
        input.status,
        input.errorMessage,
        input.gatewayResponse ? JSON.stringify(input.gatewayResponse) : null,
      ],
    );
  }
}

// ── Background Worker ─────────────────────────────────────

/**
 * Process all subscriptions with pending dunning retries.
 *
 * Queries subscriptions where:
 *   - next_retry_at <= NOW()
 *   - status IN ('active', 'past_due')
 *   - dunning_step IN (1, 2)
 *
 * Uses SELECT ... FOR UPDATE SKIP LOCKED to safely process
 * across multiple worker instances.
 *
 * Returns the number of subscriptions processed.
 */
export async function processDueDunningRetries(
  workspaceId: string,
  batchSize: number = 25,
): Promise<number> {
  // Claim subscriptions due for retry
  const { rows } = await query(
    `UPDATE subscriptions
     SET last_payment_attempt_at = now(),
         updated_at = now()
     WHERE id IN (
       SELECT id FROM subscriptions
       WHERE next_retry_at <= now()
         AND status IN ('active', 'past_due')
         AND dunning_step IN (1, 2)
       ORDER BY next_retry_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id`,
    [batchSize],
  );

  if (rows.length === 0) return 0;

  const machine = new DunningStateMachine();

  // Process each subscription concurrently
  const results = await Promise.allSettled(
    rows.map((row: any) => machine.handleRetryAttempt(row.id, workspaceId)),
  );

  let processed = 0;
  for (const result of results) {
    if (result.status === "fulfilled") {
      processed++;
      const outcome = result.value;
      if (outcome.success === false) {
        console.warn(
          `[DunningWorker] Retry failed for subscription: ${outcome.error} → status=${outcome.nextStatus}`,
        );
      }
    } else {
      console.error("[DunningWorker] Unhandled error:", result.reason);
    }
  }

  return processed;
}

// ── Singleton Export ──────────────────────────────────────

export const dunningStateMachine = new DunningStateMachine();
