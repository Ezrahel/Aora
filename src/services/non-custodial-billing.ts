// ============================================================
// AoraHQ Non-Custodial Billing — Orchestration Service
// Core billing engine: executeSubscriptionRenewal
// ============================================================

import { query, withTransaction } from "../api/db/pool.ts";
import {
  NonCustodialPaymentGateway,
  getNonCustodialGateway,
  NonCustodialBillingError,
} from "../gateways/non-custodial-adapter.ts";

// Register non-custodial gateways
import { stripeNonCustodialGateway } from "../gateways/stripe/non-custodial.ts";
import { paystackNonCustodialGateway } from "../gateways/paystack/non-custodial.ts";
import { flutterwaveNonCustodialGateway } from "../gateways/flutterwave/non-custodial.ts";
import { registerNonCustodialGateway } from "../gateways/non-custodial-adapter.ts";

registerNonCustodialGateway(stripeNonCustodialGateway);
registerNonCustodialGateway(paystackNonCustodialGateway);
registerNonCustodialGateway(flutterwaveNonCustodialGateway);

/**
 * Subscription with all related data needed for renewal
 */
export interface SubscriptionForRenewal {
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
  trialEnd: Date | null;
  canceledAt: Date | null;
  pausedAt: Date | null;
  pauseResumesAt: Date | null;
  cancelAtPeriodEnd: boolean;
  seatQuantity: number;
  quantity: number;
  metadata: Record<string, unknown>;
  gatewaySubscriptionId: string | null;
  gatewayCustomerId: string | null;
}

/**
 * Plan details needed for billing
 */
export interface PlanDetails {
  id: string;
  tenantId: string;
  name: string;
  amount: bigint;           // In lowest denomination
  currency: string;
  interval: string;         // 'weekly' | 'monthly' | 'yearly' | 'quarterly'
  intervalCount: number;
}

/**
 * Tenant gateway details
 */
export interface TenantGatewayDetails {
  id: string;
  tenantId: string;
  gateway: string;          // 'stripe' | 'paystack' | 'flutterwave'
  mode: 'live' | 'test';
  encryptedApiKey: Uint8Array;
  encryptedWebhookSecret: Uint8Array | null;
  isActive: boolean;
}

/**
 * Result of a subscription renewal attempt
 */
export interface RenewalResult {
  subscriptionId: string;
  success: boolean;
  invoiceId?: string;
  transactionId?: string;
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };
  newPeriodStart?: Date;
  newPeriodEnd?: Date;
}

/**
 * Calculate the next period end based on plan interval
 */
export function calculateNextPeriodEnd(
  currentPeriodEnd: Date,
  interval: string,
  intervalCount: number = 1
): Date {
  const next = new Date(currentPeriodEnd);

  switch (interval) {
    case 'weekly':
      next.setDate(next.getDate() + 7 * intervalCount);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + intervalCount);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3 * intervalCount);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + intervalCount);
      break;
    default:
      throw new Error(`Unknown billing interval: ${interval}`);
  }

  return next;
}

/**
 * Decrypt API key for gateway operations
 * In production, this would use a proper KMS/encryption service
 */
async function decryptApiKey(encryptedKey: Uint8Array): Promise<string> {
  // Placeholder - implement with your encryption service
  return new TextDecoder().decode(encryptedKey);
}

/**
 * Fetch subscription with all related data for renewal
 */
export async function fetchSubscriptionForRenewal(
  subscriptionId: string
): Promise<{
  subscription: SubscriptionForRenewal;
  plan: PlanDetails;
  gateway: TenantGatewayDetails;
} | null> {
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
      s.trial_end,
      s.canceled_at,
      s.paused_at,
      s.pause_resumes_at,
      s.cancel_at_period_end,
      s.seat_quantity,
      s.quantity,
      s.metadata,
      s.gateway_subscription_id,
      s.gateway_customer_id,
      p.id as plan_id,
      p.tenant_id as plan_tenant_id,
      p.name as plan_name,
      p.amount as plan_amount,
      p.currency as plan_currency,
      p.interval as plan_interval,
      p.interval_count as plan_interval_count,
      tg.id as gateway_id,
      tg.tenant_id as gateway_tenant_id,
      tg.gateway,
      tg.mode,
      tg.encrypted_api_key,
      tg.encrypted_webhook_secret,
      tg.is_active
    FROM subscriptions s
    JOIN plans p ON s.plan_id = p.id
    JOIN tenant_gateways tg ON s.tenant_gateway_id = tg.id
    WHERE s.id = $1
      AND s.status IN ('active', 'trial', 'past_due')
      AND p.is_archived = false
      AND tg.is_active = true
  `;

  const { rows } = await query(sql, [subscriptionId]);
  if (rows.length === 0) return null;

  const row = rows[0];

  return {
    subscription: {
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
      trialEnd: row.trial_end ? new Date(row.trial_end) : null,
      canceledAt: row.canceled_at ? new Date(row.canceled_at) : null,
      pausedAt: row.paused_at ? new Date(row.paused_at) : null,
      pauseResumesAt: row.pause_resumes_at ? new Date(row.pause_resumes_at) : null,
      cancelAtPeriodEnd: row.cancel_at_period_end,
      seatQuantity: row.seat_quantity,
      quantity: row.quantity,
      metadata: row.metadata ?? {},
      gatewaySubscriptionId: row.gateway_subscription_id,
      gatewayCustomerId: row.gateway_customer_id,
    },
    plan: {
      id: row.plan_id,
      tenantId: row.plan_tenant_id,
      name: row.plan_name,
      amount: BigInt(row.plan_amount),
      currency: row.plan_currency,
      interval: row.plan_interval,
      intervalCount: row.plan_interval_count,
    },
    gateway: {
      id: row.gateway_id,
      tenantId: row.gateway_tenant_id,
      gateway: row.gateway,
      mode: row.mode,
      encryptedApiKey: row.encrypted_api_key,
      encryptedWebhookSecret: row.encrypted_webhook_secret,
      isActive: row.is_active,
    },
  };
}

/**
 * Create an invoice record for the renewal
 */
async function createRenewalInvoice(
  client: any,
  subscription: SubscriptionForRenewal,
  plan: PlanDetails,
  amount: bigint,
  periodStart: Date,
  periodEnd: Date
): Promise<string> {
  const { rows } = await client.query(`
    INSERT INTO invoices (
      tenant_id, customer_id, subscription_id, plan_id,
      amount, currency, status, description,
      period_start, period_end, due_at,
      line_items, metadata, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, 'open',
      $7, $8, $9, $10,
      $11, $12, now())
    RETURNING id
  `, [
    subscription.tenantId,
    subscription.customerId,
    subscription.id,
    subscription.planId,
    amount,
    plan.currency,
    `${plan.name} subscription renewal`,
    periodStart,
    periodEnd,
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Due in 7 days
    JSON.stringify([{
      description: `${plan.name} renewal`,
      quantity: subscription.quantity,
      unitAmount: amount,
      amount: amount,
      type: 'base_fee',
    }]),
    JSON.stringify({ seatQuantity: subscription.seatQuantity }),
  ]);

  return rows[0].id;
}

/**
 * Update subscription period after successful renewal
 */
async function updateSubscriptionPeriod(
  client: any,
  subscriptionId: string,
  newPeriodStart: Date,
  newPeriodEnd: Date,
  gatewayTransactionId?: string
): Promise<void> {
  const updates: string[] = [
    `current_period_start = $2`,
    `current_period_end = $3`,
    `status = 'active'`,
    `updated_at = now()`,
  ];
  const params = [subscriptionId, newPeriodStart, newPeriodEnd];
  let idx = 4;

  if (gatewayTransactionId) {
    updates.push(`gateway_payment_intent_id = $${idx++}`);
    params.push(gatewayTransactionId);
  }

  await client.query(
    `UPDATE subscriptions SET ${updates.join(', ')} WHERE id = $1`,
    params
  );
}

/**
 * Mark subscription as past_due
 */
async function markSubscriptionPastDue(
  client: any,
  subscriptionId: string,
  error: { code: string; message: string; recoverable: boolean }
): Promise<void> {
  await client.query(`
    UPDATE subscriptions 
    SET status = 'past_due', 
        metadata = metadata || jsonb_build_object(
          'last_renewal_error', jsonb_build_object(
            'code', $2,
            'message', $3,
            'recoverable', $4,
            'at', now()
          )
        ),
        updated_at = now()
    WHERE id = $1
  `, [subscriptionId, error.code, error.message, error.recoverable]);
}

/**
 * Core function: Execute subscription renewal
 * 
 * This is the core non-custodial billing operation that:
 * 1. Fetches subscription, plan, and gateway details
 * 2. Decrypts gateway API key
 * 3. Calculates billing amount (amount * quantity * seatQuantity)
 * 4. Charges the saved payment token via the gateway adapter
 * 8. On success: creates invoice, updates subscription period
 * 9. On failure: marks subscription past_due
 * 
 * @param subscriptionId - The subscription to renew
 * @returns Renewal result with success status and details
 */
export async function executeSubscriptionRenewal(
  subscriptionId: string
): Promise<RenewalResult> {
  // 1. Fetch all required data
  const data = await fetchSubscriptionForRenewal(subscriptionId);
  if (!data) {
    return {
      subscriptionId,
      success: false,
      error: {
        code: 'SUBSCRIPTION_NOT_FOUND',
        message: 'Subscription not found or not eligible for renewal',
        recoverable: false,
      },
    };
  }

  const { subscription, plan, gateway } = data;

  // 2. Check subscription eligibility
  if (subscription.status === 'canceled' || subscription.status === 'paused') {
    return {
      subscriptionId,
      success: false,
      error: {
        code: 'INELIGIBLE_STATUS',
        message: `Cannot renew subscription with status: ${subscription.status}`,
        recoverable: false,
      },
    };
  }

  // 3. Decrypt the gateway API key
  let secretKey: string;
  try {
    secretKey = await decryptApiKey(gateway.encryptedApiKey);
  } catch (err) {
    return {
      subscriptionId,
      success: false,
      error: {
        code: 'DECRYPTION_FAILED',
        message: 'Failed to decrypt gateway API key',
        recoverable: false,
      },
    };
  }

  // 4. Get the non-custodial gateway adapter
  let gatewayAdapter: NonCustodialPaymentGateway;
  try {
    gatewayAdapter = getNonCustodialGateway(gateway.gateway);
  } catch (err) {
    return {
      subscriptionId,
      success: false,
      error: {
        code: 'GATEWAY_NOT_FOUND',
        message: `No non-custodial adapter for gateway: ${gateway.gateway}`,
        recoverable: false,
      },
    };
  }

  // 5. Calculate billing amount
  // Base amount * quantity * seatQuantity (all in lowest denomination)
  const baseAmount = plan.amount;
  const totalAmount = baseAmount * BigInt(subscription.quantity) * BigInt(subscription.seatQuantity);

  // 6. Charge the saved payment token
  try {
    const chargeParams = {
      secretKey,
      customerToken: subscription.gatewayCustomerToken,
      paymentToken: subscription.gatewayPaymentToken,
      amount: totalAmount,
      currency: plan.currency.toLowerCase(),
      description: `${plan.name} subscription renewal`,
      metadata: {
        subscriptionId: subscription.id,
        planId: plan.id,
        tenantId: subscription.tenantId,
        seatQuantity: String(subscription.seatQuantity),
        quantity: String(subscription.quantity),
      },
    };

    const chargeResult = await gatewayAdapter.chargeToken(chargeParams);

    if (chargeResult.status !== 'succeeded' && chargeResult.status !== 'processing') {
      throw new Error(`Charge failed with status: ${chargeResult.status}`);
    }

    // 7. On success - use transaction to update everything atomically
    return await withTransaction(async (client) => {
      // Calculate new period dates
      const periodStart = new Date();
      const periodEnd = calculateNextPeriodEnd(
        new Date(subscription.currentPeriodEnd),
        plan.interval,
        plan.intervalCount
      );

      // Create invoice
      const invoiceId = await createRenewalInvoice(
        client,
        subscription,
        { ...plan, amount: totalAmount },
        totalAmount,
        periodStart,
        periodEnd
      );

      // Update subscription period
      await updateSubscriptionPeriod(
        client,
        subscription.id,
        periodStart,
        periodEnd,
        chargeResult.transactionId
      );

      return {
        subscriptionId,
        success: true,
        invoiceId,
        transactionId: chargeResult.transactionId,
        newPeriodStart: periodStart,
        newPeriodEnd: periodEnd,
      };
    });
  } catch (err) {
    // 8. Handle charge failure
    const billingError = err instanceof NonCustodialBillingError
      ? err
      : NonCustodialBillingError.fromGatewayError(gateway.gateway, err, 'Subscription renewal charge');

    await withTransaction(async (client) => {
      await markSubscriptionPastDue(client, subscription.id, {
        code: billingError.code,
        message: billingError.message,
        recoverable: billingError.recoverable,
      });
    });

    return {
      subscriptionId,
      success: false,
      error: {
        code: billingError.code,
        message: billingError.message,
        recoverable: billingError.recoverable,
      },
    };
  }
}

/**
 * Batch renew all subscriptions due for renewal
 */
export async function batchRenewSubscriptions(
  beforeDate: Date = new Date(),
  limit: number = 100
): Promise<RenewalResult[]> {
  // Find subscriptions due for renewal
  const { rows } = await query(
    `SELECT id FROM subscriptions
     WHERE status IN ('active', 'trial', 'past_due')
       AND current_period_end <= $1
     ORDER BY current_period_end ASC
     LIMIT $2`,
    [beforeDate, limit]
  );

  const results: RenewalResult[] = [];

  for (const row of rows) {
    const result = await executeSubscriptionRenewal(row.id);
    results.push(result);

    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 50));
  }

  return results;
}

/**
 * Manually retry a failed renewal
 */
export async function retrySubscriptionRenewal(
  subscriptionId: string
): Promise<RenewalResult> {
  return executeSubscriptionRenewal(subscriptionId);
}