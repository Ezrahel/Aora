// ============================================================
// AoraHQ Proration Service
// Seat-based pricing mid-cycle adjustments with high-precision
// financial mathematics and non-custodial gateway charging.
// ============================================================

import { query, withTransaction } from "../db/pool.ts";
import {
  NonCustodialPaymentGateway,
  NonCustodialBillingError,
  ChargeTokenParams,
  ChargeResult,
} from "../../gateways/non-custodial-adapter.ts";
import { getNonCustodialGateway } from "../../gateways/non-custodial-registry.ts";

// ── Constants ──────────────────────────────────────────────

const MILLISECONDS_PER_SECOND = 1000n;
const MILLISECONDS_PER_MINUTE = 60_000n;
const MILLISECONDS_PER_HOUR = 3_600_000n;
const MILLISECONDS_PER_DAY = 86_400_000n;

// ── Types ──────────────────────────────────────────────────

export interface ProrationParams {
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  changeDate: Date;
  unitPriceCents: bigint;
  seatDifference: number;
}

export interface SubscriptionProrationData {
  id: string;
  tenantId: string;
  customerId: string;
  planId: string;
  tenantGatewayId: string;
  gatewayCustomerToken: string;
  gatewayPaymentToken: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  seatQuantity: number;
  planAmount: bigint;
  planSeatPrice: bigint | null;
  planCurrency: string;
  planInterval: string;
  planIntervalCount: number;
  gatewayName: string;
  encryptedApiKey: Uint8Array;
}

export interface SeatAdjustmentResult {
  subscriptionId: string;
  previousSeatCount: number;
  newSeatCount: number;
  seatDifference: number;
  adjustmentChargeCents: bigint;
  isCharge: boolean;
  invoiceCreated: boolean;
  transactionId?: string;
  creditEntryId?: string;
}

// ── Proration Math Engine ─────────────────────────────────

/**
 * Calculate the prorated cost adjustment for a mid-cycle seat change.
 *
 * Formula:
 *   remainingDuration = changeDate → currentPeriodEnd (ms)
 *   totalDuration     = currentPeriodStart → currentPeriodEnd (ms)
 *   timeRatio         = remainingDuration / totalDuration  (as high-precision rational)
 *   adjustment        = unitPriceCents * seatDifference * timeRatio
 *
 * The result is always rounded UP (ceiling) to avoid floating-point drift
 * and guarantee the merchant receives sufficient funds for the fraction.
 *
 * @returns The prorated adjustment in the lowest denomination (cents/kobo),
 *          as a bigint rounded up.
 */
export function calculateProratedAmount(params: ProrationParams): bigint {
  const { currentPeriodStart, currentPeriodEnd, changeDate, unitPriceCents, seatDifference } = params;

  // Input validation
  if (unitPriceCents < 0n) {
    throw new Error("unitPriceCents must be non-negative");
  }
  if (seatDifference === 0) return 0n;
  if (changeDate > currentPeriodEnd) {
    throw new Error("changeDate cannot be after currentPeriodEnd");
  }
  if (changeDate < currentPeriodStart) {
    throw new Error("changeDate cannot be before currentPeriodStart");
  }

  // All durations in milliseconds as bigint
  const totalDurationMs = BigInt(currentPeriodEnd.getTime()) - BigInt(currentPeriodStart.getTime());
  const remainingDurationMs = BigInt(currentPeriodEnd.getTime()) - BigInt(changeDate.getTime());

  if (totalDurationMs <= 0n) {
    // Edge case: instantaneous period (shouldn't happen in practice)
    // Charge the full amount for the seat difference
    return unitPriceCents * BigInt(Math.abs(seatDifference));
  }

  // Compute adjustment using integer arithmetic to avoid float errors
  // adjustment = ceiling(unitPriceCents * |seatDifference| * remainingDurationMs / totalDurationMs)
  //
  // We multiply before dividing to preserve precision, then add (denom - 1)
  // for ceiling division.
  const absoluteDiff = BigInt(Math.abs(seatDifference));
  const numerator = unitPriceCents * absoluteDiff * remainingDurationMs;
  const denominator = totalDurationMs;

  // Ceiling division: (numerator + denominator - 1) / denominator
  const signedAdjustment = (numerator + denominator - 1n) / denominator;

  // If seats are being removed (negative difference), the adjustment
  // represents a credit (positive value to return).
  return signedAdjustment;
}

// ── Database Helpers ──────────────────────────────────────

/**
 * Fetch subscription with all related data needed for proration.
 */
export async function fetchSubscriptionForProration(
  subscriptionId: string,
): Promise<SubscriptionProrationData | null> {
  const sql = `
    SELECT
      s.id,
      s.tenant_id,
      s.customer_id,
      s.plan_id,
      s.tenant_gateway_id,
      s.gateway_customer_token,
      s.gateway_payment_token,
      s.status,
      s.current_period_start,
      s.current_period_end,
      s.seat_quantity,
      p.amount      AS plan_amount,
      p.seat_price  AS plan_seat_price,
      p.currency    AS plan_currency,
      p.interval    AS plan_interval,
      p.interval_count AS plan_interval_count,
      tg.gateway,
      tg.encrypted_api_key
    FROM subscriptions s
    JOIN plans p ON s.plan_id = p.id
    JOIN tenant_gateways tg ON s.tenant_gateway_id = tg.id
    WHERE s.id = $1
      AND s.status IN ('active', 'trial')
      AND p.is_archived = false
      AND tg.is_active = true
  `;

  const { rows } = await query(sql, [subscriptionId]);
  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    tenantId: row.tenant_id,
    customerId: row.customer_id,
    planId: row.plan_id,
    tenantGatewayId: row.tenant_gateway_id,
    gatewayCustomerToken: row.gateway_customer_token,
    gatewayPaymentToken: row.gateway_payment_token,
    status: row.status,
    currentPeriodStart: new Date(row.current_period_start),
    currentPeriodEnd: new Date(row.current_period_end),
    seatQuantity: row.seat_quantity,
    planAmount: BigInt(row.plan_amount),
    planSeatPrice: row.plan_seat_price != null ? BigInt(row.plan_seat_price) : null,
    planCurrency: row.plan_currency,
    planInterval: row.plan_interval,
    planIntervalCount: row.plan_interval_count,
    gatewayName: row.gateway,
    encryptedApiKey: row.encrypted_api_key,
  };
}

/**
 * Update the seat_quantity on a subscription.
 */
async function updateSubscriptionSeatCount(
  client: any,
  subscriptionId: string,
  newSeatCount: number,
): Promise<void> {
  await client.query(
    `UPDATE subscriptions
     SET seat_quantity = $2, updated_at = now()
     WHERE id = $1`,
    [subscriptionId, newSeatCount],
  );
}

/**
 * Record a seat adjustment in the audit trail.
 */
async function recordSeatAdjustment(
  client: any,
  subscriptionId: string,
  previousSeatCount: number,
  newSeatCount: number,
  adjustmentCents: bigint,
  isCharge: boolean,
  transactionRef: string | null,
): Promise<void> {
  await client.query(
    `INSERT INTO seat_adjustments (subscription_id, previous_seat_count, new_seat_count,
       adjustment_cents, is_charge, transaction_ref, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())`,
    [
      subscriptionId,
      previousSeatCount,
      newSeatCount,
      adjustmentCents,
      isCharge,
      transactionRef,
    ],
  );
}

/**
 * Decrypt gateway API key.
 * Production deployments should use a proper KMS.
 */
async function decryptApiKey(encryptedKey: Uint8Array): Promise<string> {
  return new TextDecoder().decode(encryptedKey);
}

// ── Proration Service ─────────────────────────────────────

export class ProrationService {
  /**
   * Update the seat count on an active subscription and handle the
   * prorated charge or credit for the remainder of the current billing
   * period.
   *
   * For seat additions:
   *   - Calculates a prorated charge for the unused portion of the current
   *     billing period.
   *   - Charges the customer's saved payment method immediately via the
   *     configured non-custodial gateway.
   *   - Creates an invoice for the prorated amount.
   *   - The billing cycle anchor date (currentPeriodEnd) is NOT shifted.
   *
   * For seat removals:
   *   - Calculates a prorated credit for the unused portion of the current
   *     billing period.
   *   - Issues the credit to the customer's credit ledger (applied to next
   *     renewal invoice automatically).
   *   - The billing cycle anchor date is NOT shifted.
   *
   * @param subscriptionId - The subscription to adjust.
   * @param newSeatCount   - The desired new seat count.
   * @returns The prorated adjustment result.
   */
  async updateSubscriptionSeats(
    subscriptionId: string,
    newSeatCount: number,
  ): Promise<SeatAdjustmentResult> {
    if (newSeatCount < 0) {
      throw new Error("newSeatCount must be non-negative");
    }
    if (newSeatCount > 1000000) {
      throw new Error("newSeatCount exceeds maximum allowed (1,000,000)");
    }

    // 1. Fetch subscription data
    const data = await fetchSubscriptionForProration(subscriptionId);
    if (!data) {
      throw new Error(
        `Subscription ${subscriptionId} not found or not eligible for seat adjustment`,
      );
    }

    const previousSeatCount = data.seatQuantity;
    const seatDifference = newSeatCount - previousSeatCount;

    if (seatDifference === 0) {
      return {
        subscriptionId,
        previousSeatCount,
        newSeatCount,
        seatDifference: 0,
        adjustmentChargeCents: 0n,
        isCharge: true,
        invoiceCreated: false,
      };
    }

    // 2. Determine per-unit seat price in cents
    let perSeatPriceCents = data.planSeatPrice;
    if (perSeatPriceCents == null || perSeatPriceCents <= 0n) {
      // Fallback: use plan amount / max(1, currentSeatCount) as implied seat price
      perSeatPriceCents = data.planAmount / BigInt(Math.max(1, previousSeatCount));
    }

    // 3. Calculate prorated adjustment
    const adjustmentCents = calculateProratedAmount({
      currentPeriodStart: data.currentPeriodStart,
      currentPeriodEnd: data.currentPeriodEnd,
      changeDate: new Date(),
      unitPriceCents: perSeatPriceCents,
      seatDifference,
    });

    const isCharge = seatDifference > 0;

    // 4. Execute charge or credit
    if (isCharge) {
      // ── Seat Addition: Charge immediately ──
      return await this.executeSeatCharge(data, newSeatCount, previousSeatCount, adjustmentCents);
    } else {
      // ── Seat Removal: Issue credit ──
      return await this.executeSeatCredit(data, newSeatCount, previousSeatCount, adjustmentCents);
    }
  }

  /**
   * Execute a prorated charge for added seats:
   *   - Decrypt gateway key
   *   - Charge via non-custodial gateway
   *   - Create invoice
   *   - Update seat count
   *   - Record adjustment
   */
  private async executeSeatCharge(
    data: SubscriptionProrationData,
    newSeatCount: number,
    previousSeatCount: number,
    adjustmentCents: bigint,
  ): Promise<SeatAdjustmentResult> {
    // Decrypt gateway API key
    let secretKey: string;
    try {
      secretKey = await decryptApiKey(data.encryptedApiKey);
    } catch (err) {
      throw new Error("Failed to decrypt gateway API key for proration charge");
    }

    // Get non-custodial gateway adapter
    const gateway = getNonCustodialGateway(data.gatewayName);
    if (!gateway) {
      throw new Error(`No non-custodial adapter for gateway: ${data.gatewayName}`);
    }

    // Prepare charge params
    const chargeParams: ChargeTokenParams = {
      secretKey,
      customerToken: data.gatewayCustomerToken,
      paymentToken: data.gatewayPaymentToken,
      amount: adjustmentCents,
      currency: data.planCurrency.toLowerCase(),
      description: `Prorated seat add: +${newSeatCount - previousSeatCount} seats (${data.id})`,
      metadata: {
        subscriptionId: data.id,
        type: "proration_charge",
        previousSeats: String(previousSeatCount),
        newSeats: String(newSeatCount),
      },
    };

    // Execute within transaction
    return await withTransaction(async (client) => {
      let chargeResult: ChargeResult;

      try {
        chargeResult = await gateway.chargeToken(chargeParams);
      } catch (err) {
        const billingError =
          err instanceof NonCustodialBillingError
            ? err
            : new NonCustodialBillingError(
                (err as Error).message,
                "PRORATION_CHARGE_FAILED",
                data.gatewayName,
                true,
                err as Error,
              );

        // Mark subscription metadata with the failed proration attempt
        await client.query(
          `UPDATE subscriptions
           SET metadata = metadata || jsonb_build_object(
             'last_proration_error', jsonb_build_object(
               'code', $2,
               'message', $3,
               'attempted_seats', $4,
               'adjustment_cents', $5,
               'at', now()
             )
           ),
           updated_at = now()
           WHERE id = $1`,
          [
            data.id,
            billingError.code,
            billingError.message,
            newSeatCount,
            adjustmentCents.toString(),
          ],
        );

        throw billingError;
      }

      if (chargeResult.status !== "succeeded") {
        throw new NonCustodialBillingError(
          `Gateway charge returned status: ${chargeResult.status}`,
          "PRORATION_CHARGE_DECLINED",
          data.gatewayName,
          true,
        );
      }

      // Create proration invoice
      const { rows: invoiceRows } = await client.query(
        `INSERT INTO invoices (
           tenant_id, customer_id, subscription_id, plan_id,
           amount, currency, status, description,
           period_start, period_end, due_at,
           line_items, metadata, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, 'paid',
           $7, $8, $9, now(),
           $10, $11, now())
         RETURNING id`,
        [
          data.tenantId,
          data.customerId,
          data.id,
          data.planId,
          adjustmentCents,
          data.planCurrency,
          `Prorated charge for seat add (${previousSeatCount} → ${newSeatCount})`,
          data.currentPeriodStart,
          data.currentPeriodEnd,
          JSON.stringify([
            {
              description: `Prorated seat addition: +${newSeatCount - previousSeatCount} seats`,
              quantity: Math.abs(newSeatCount - previousSeatCount),
              unitAmount: adjustmentCents / BigInt(Math.abs(newSeatCount - previousSeatCount)),
              amount: adjustmentCents,
              type: "seat_charge",
            },
          ]),
          JSON.stringify({
            subscriptionId: data.id,
            previousSeatCount,
            newSeatCount,
            prorationType: "seat_add",
            transactionId: chargeResult.transactionId,
          }),
        ],
      );

      const invoiceId = invoiceRows[0].id;

      // Mark gateway transaction on invoice
      await client.query(
        `UPDATE invoices
         SET gateway_payment_intent_id = $2, paid_at = now()
         WHERE id = $1`,
        [invoiceId, chargeResult.transactionId],
      );

      // Update seat count
      await updateSubscriptionSeatCount(client, data.id, newSeatCount);

      // Record audit trail
      await recordSeatAdjustment(
        client,
        data.id,
        previousSeatCount,
        newSeatCount,
        adjustmentCents,
        true,
        chargeResult.transactionId,
      );

      return {
        subscriptionId: data.id,
        previousSeatCount,
        newSeatCount,
        seatDifference: newSeatCount - previousSeatCount,
        adjustmentChargeCents: adjustmentCents,
        isCharge: true,
        invoiceCreated: true,
        transactionId: chargeResult.transactionId,
      };
    });
  }

  /**
   * Execute a prorated credit for removed seats:
   *   - Issue credit to the customer's credit ledger
   *   - Update seat count
   *   - Record adjustment
   */
  private async executeSeatCredit(
    data: SubscriptionProrationData,
    newSeatCount: number,
    previousSeatCount: number,
    adjustmentCents: bigint,
  ): Promise<SeatAdjustmentResult> {
    return await withTransaction(async (client) => {
      // Issue credit to the credit ledger
      const { rows: creditRows } = await client.query(
        `INSERT INTO credit_ledger (id, customer_id, amount, type, description, created_at)
         VALUES (gen_random_uuid(), $1, $2, 'credit_issued', $3, now())
         RETURNING id`,
        [
          data.customerId,
          adjustmentCents,
          `Prorated credit for seat removal (${previousSeatCount} → ${newSeatCount})`,
        ],
      );

      const creditEntryId = creditRows[0].id;

      // Refresh the credit balance materialized row
      await client.query(
        `UPSERT INTO credit_balances (customer_id, balance, updated_at)
         SELECT $1,
           COALESCE(SUM(CASE WHEN type = 'credit_issued' THEN amount ELSE -amount END), 0),
           now()
         FROM credit_ledger
         WHERE customer_id = $1`,
        [data.customerId],
      );

      // Update seat count
      await updateSubscriptionSeatCount(client, data.id, newSeatCount);

      // Record audit trail
      await recordSeatAdjustment(
        client,
        data.id,
        previousSeatCount,
        newSeatCount,
        adjustmentCents,
        false,
        creditEntryId,
      );

      return {
        subscriptionId: data.id,
        previousSeatCount,
        newSeatCount,
        seatDifference: newSeatCount - previousSeatCount,
        adjustmentChargeCents: adjustmentCents,
        isCharge: false,
        invoiceCreated: false,
        creditEntryId,
      };
    });
  }
}

export const prorationService = new ProrationService();
