// ============================================================
// Checkout Session Routes
// Hosted checkout flow for non-custodial payment processing
// ============================================================

import { Router } from "express";
import {
  query,
  withTransaction,
  genId,
} from "../db.ts";
import { asyncHandler, badRequest, notFound, conflict } from "../middleware.ts";
import { decrypt } from "../../gateways/encryption.ts";
import { getAdapter, listAdapters } from "../../gateways/index.ts";
import { NonCustodialPaymentGateway, getNonCustodialGateway, NonCustodialBillingError } from "../../gateways/non-custodial-adapter.ts";
import { stripeNonCustodialGateway } from "../../gateways/stripe/non-custodial.ts";
import { paystackNonCustodialGateway } from "../../gateways/paystack/non-custodial.ts";
import { flutterwaveNonCustodialGateway } from "../../gateways/flutterwave/non-custodial.ts";
import { registerNonCustodialGateway } from "../../gateways/non-custodial-registry.ts";

export const router = Router();

// ============================================================
// Register Non-Custodial Gateways
// ============================================================

// Register on import
registerNonCustodialGateway(stripeNonCustodialGateway);
registerNonCustodialGateway(paystackNonCustodialGateway);
registerNonCustodialGateway(flutterwaveNonCustodialGateway);

// ============================================================
// Types
// ============================================================

interface CheckoutSessionRow {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  plan_id: string | null;
  amount: bigint;
  currency: string;
  interval: string;
  interval_count: number;
  success_url: string | null;
  cancel_url: string | null;
  metadata: Record<string, any>;
  tenant_gateway_id: string | null;
  gateway: string | null;
  status: string;
  payment_token: string | null;
  gateway_customer_token: string | null;
  gateway_payment_token: string | null;
  gateway_customer_id: string | null;
  gateway_payment_intent_id: string | null;
  customer_email: string;
  customer_name: string | null;
  subscription_id: string | null;
  expires_at: Date;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface PlanRow {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  amount: bigint;
  currency: string;
  interval: string;
  interval_count: number;
  is_archived: boolean;
}

interface TenantGatewayRow {
  id: string;
  tenant_id: string;
  gateway: string;
  mode: 'live' | 'test';
  encrypted_api_key: Buffer;
  encrypted_webhook_secret: Buffer | null;
  gateway_account_id: string | null;
  gateway_account_name: string | null;
  gateway_account_email: string | null;
  is_verified: boolean;
  is_active: boolean;
  key_preview: string;
}

interface CustomerRow {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  status: string;
  gateway_customer_tokens: Record<string, string> | null;
}

// ============================================================
// Helpers
// ============================================================

function mapSessionRow(row: CheckoutSessionRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    customerId: row.customer_id,
    planId: row.plan_id,
    amount: row.amount,
    currency: row.currency,
    interval: row.interval,
    intervalCount: row.interval_count,
    successUrl: row.success_url,
    cancelUrl: row.cancel_url,
    metadata: row.metadata,
    tenantGatewayId: row.tenant_gateway_id,
    gateway: row.gateway,
    status: row.status,
    paymentToken: row.payment_token,
    gatewayCustomerToken: row.gateway_customer_token,
    gatewayPaymentToken: row.gateway_payment_token,
    gatewayCustomerId: row.gateway_customer_id,
    gatewayPaymentIntentId: row.gateway_payment_intent_id,
    customerEmail: row.customer_email,
    customerName: row.customer_name,
    subscriptionId: row.subscription_id,
    expiresAt: row.expires_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Resolve tenant from subdomain or header
async function resolveTenant(req: any): Promise<{ id: string; name: string; slug: string } | null> {
  const host = req.headers.host || '';
  const subdomain = host.split('.')[0];
  
  let tenantId = req.headers['x-tenant-id'] as string | undefined;
  
  if (!tenantId && subdomain && subdomain !== 'www' && subdomain !== 'api' && subdomain !== 'app') {
    const { rows } = await query('SELECT id, name, slug FROM tenants WHERE slug = $1 AND status = $2', [subdomain, 'active']);
    if (rows.length > 0) return { id: rows[0].id, name: rows[0].name, slug: rows[0].slug };
  }
  
  if (tenantId) {
    const { rows } = await query('SELECT id, name, slug FROM tenants WHERE id = $1 AND status = $2', [tenantId, 'active']);
    if (rows.length > 0) return { id: rows[0].id, name: rows[0].name, slug: rows[0].slug };
  }
  
  return null;
}

// ============================================================
// GET /api/checkout/session/:sessionId
// Returns checkout session details + PUBLIC gateway key
// ============================================================
router.get("/session/:sessionId", asyncHandler(async (req, res) => {
  const sessionId = req.params.sessionId;
  
  const { rows } = await query<any>(
    `SELECT * FROM checkout_sessions WHERE id = $1`,
    [sessionId]
  );
  
  if (rows.length === 0) {
    return notFound(res, "Checkout session");
  }
  
  const session = rows[0];
  
  // Check expiration
  if (new Date() > new Date(session.expires_at) && session.status === 'created') {
    await query(`UPDATE checkout_sessions SET status = 'expired', updated_at = now() WHERE id = $1`, [sessionId]);
    return res.status(410).json({ error: "Checkout session has expired", code: "SESSION_EXPIRED" });
  }
  
  // Fetch plan details
  let plan: any = null;
  if (session.plan_id) {
    const { rows: planRows } = await query<any>(
      `SELECT id, tenant_id, name, description, amount, currency, interval, interval_count, is_archived 
       FROM plans WHERE id = $1`,
      [session.plan_id]
    );
    if (planRows.length > 0) plan = planRows[0];
  }
  
  // Fetch tenant gateway for public key
  let publicKey: string | null = null;
  let gatewayName: string | null = null;
  let gatewayMode: 'live' | 'test' = 'test';
  
  if (session.tenant_gateway_id) {
    const { rows: gatewayRows } = await query<any>(
      `SELECT id, tenant_id, gateway, mode, encrypted_api_key, is_verified, is_active
       FROM tenant_gateways WHERE id = $1 AND is_active = true`,
      [session.tenant_gateway_id]
    );
    
    if (gatewayRows.length > 0) {
      const gw = gatewayRows[0];
      gatewayName = gw.gateway;
      gatewayMode = gw.mode;
      
      // Extract public key from secret key
      // Note: In production, you should store the public key separately when connecting the gateway
      // For Stripe: sk_live_xxx -> pk_live_xxx, sk_test_xxx -> pk_test_xxx
      // For Paystack: same prefix pattern
      // For Flutterwave: FLWSECK-xxx -> FLWPUBK-xxx
      try {
        const secretKey = decrypt(gw.encrypted_api_key.toString('hex'));
        const publicKey = extractPublicKey(secretKey, gw.gateway, gw.mode);
        if (publicKey) {
          // Store or return the public key
        }
      } catch (err) {
        console.error("Failed to decrypt gateway key for checkout:", err);
      }
    }
  }
  
  const response = {
    id: session.id,
    status: session.status,
    amount: Number(session.amount),
    currency: session.currency,
    interval: session.interval,
    intervalCount: session.interval_count,
    plan: plan ? {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      amount: Number(plan.amount),
      currency: plan.currency,
      interval: plan.interval,
      intervalCount: plan.interval_count,
    } : null,
    successUrl: session.success_url,
    cancelUrl: session.cancel_url,
    gateway: session.gateway,
    gatewayMode: 'test', // Will be updated from gateway config
    expiresAt: session.expires_at,
    customerEmail: session.customer_email,
    customerName: session.customer_name,
    // PUBLIC KEY ONLY - never expose secret keys!
    publicKey: null, // Will be populated from gateway config
    // Gateway info for frontend SDK loading
    gatewayConfig: {
      name: session.gateway,
      mode: 'test',
    },
  };
  
  res.json(response);
}));

// ============================================================
// POST /api/checkout/session/:sessionId/confirm
// Confirm payment with gateway payment token
// ============================================================
router.post("/session/:sessionId/confirm", asyncHandler(async (req, res) => {
  const sessionId = req.params.sessionId;
  const { paymentToken, customerEmail, customerName } = req.body as {
    paymentToken: string;
    customerEmail: string;
    customerName?: string;
  };
  
  if (!paymentToken || !customerEmail) {
    return badRequest(res, "paymentToken and customerEmail are required");
  }
  
  // Fetch session with row lock to prevent race conditions
  const { rows: sessionRows } = await query<any>(
    `SELECT * FROM checkout_sessions WHERE id = $1 FOR UPDATE`,
    [sessionId]
  );
  
  if (sessionRows.length === 0) {
    return notFound(res, "Checkout session");
  }
  
  const session = sessionRows[0];
  
  // Validate session state
  if (session.status !== 'created' && session.status !== 'pending') {
    return conflict(res, `Session is in ${session.status} state and cannot be confirmed`);
  }
  
  if (new Date() > new Date(session.expires_at)) {
    await query(`UPDATE checkout_sessions SET status = 'expired', updated_at = now() WHERE id = $1`, [sessionId]);
    return res.status(410).json({ error: "Checkout session has expired", code: "SESSION_EXPIRED" });
  }
  
  // Verify email matches (security)
  if (session.customer_email && session.customer_email !== customerEmail) {
    return badRequest(res, "Customer email does not match session");
  }
  
  // Get plan details
  const { rows: planRows } = await query<any>(
    `SELECT id, tenant_id, name, amount, currency, interval, interval_count 
     FROM plans WHERE id = $1 AND is_archived = false`,
    [session.plan_id]
  );
  
  if (planRows.length === 0) {
    return notFound(res, "Plan");
  }
  const plan = planRows[0];
  
  // Get gateway config
  if (!session.tenant_gateway_id) {
    return conflict(res, "No gateway configured for this checkout session");
  }
  
  const { rows: gatewayRows } = await query<any>(
    `SELECT id, tenant_id, gateway, mode, encrypted_api_key, encrypted_webhook_secret, is_active
     FROM tenant_gateways WHERE id = $1 AND is_active = true`,
    [session.tenant_gateway_id]
  );
  
  if (gatewayRows.length === 0) {
    return conflict(res, "Gateway connection not found or inactive");
  }
  
  const gateway = gatewayRows[0];
  
  // Decrypt secret key for gateway operations
  let secretKey: string;
  try {
    secretKey = decrypt(gateway.encrypted_api_key.toString('hex'));
  } catch (err) {
    console.error("Failed to decrypt gateway key:", err);
    return res.status(500).json({ error: "Gateway configuration error", code: "GATEWAY_CONFIG_ERROR" });
  }
  
  // Get the non-custodial gateway adapter
  const { getNonCustodialGateway } = await import("../../gateways/non-custodial-adapter.ts");
  const gatewayAdapter: NonCustodialPaymentGateway | undefined = getNonCustodialGateway(gateway.gateway);
  
  if (!gatewayAdapter) {
    return res.status(501).json({ 
      error: `Non-custodial gateway adapter not available for: ${gateway.gateway}`,
      code: "GATEWAY_NOT_SUPPORTED" 
    });
  }
  
  // Calculate total amount
  const totalAmount = plan.amount; // Already in lowest denomination (cents/kobo)
  
  try {
    // Charge the saved payment token
    const chargeParams = {
      secretKey,
      customerToken: '', // We'll need to create/get gateway customer
      paymentToken: req.body.paymentToken,
      amount: totalAmount,
      currency: plan.currency.toLowerCase(),
      description: `${plan.name} subscription checkout`,
      metadata: {
        checkoutSessionId: sessionId,
        planId: plan.id,
        tenantId: session.tenant_id,
      },
    };

    const chargeResult = await gatewayAdapter.chargeToken(chargeParams);
    
    if (chargeResult.status !== 'succeeded' && chargeResult.status !== 'processing') {
      throw new Error(`Charge failed with status: ${chargeResult.status}`);
    }
    
    // On success - use transaction for atomicity
    return await withTransaction(async (client) => {
      // Calculate new period dates
      const periodStart = new Date();
      const periodEnd = new Date(session.current_period_end || new Date());
      // Actually calculate based on plan interval
      const periodEndCalc = new Date();
      switch (plan.interval) {
        case 'weekly':
          periodEndCalc.setDate(periodEndCalc.getDate() + 7 * (plan.interval_count || 1));
          break;
        case 'monthly':
          periodEndCalc.setMonth(periodEndCalc.getMonth() + (plan.interval_count || 1));
          break;
        case 'quarterly':
          periodEndCalc.setMonth(periodEndCalc.getMonth() + 3 * (plan.interval_count || 1));
          break;
        case 'yearly':
          periodEndCalc.setFullYear(periodEndCalc.getFullYear() + (plan.interval_count || 1));
          break;
      }
      
      // Create subscription
      const subId = "sub_" + genId();
      await client.query(
        `INSERT INTO subscriptions (
          id, tenant_id, customer_id, plan_id, tenant_gateway_id,
          gateway_customer_token, gateway_payment_token,
          status, current_period_start, current_period_end,
          seat_quantity, quantity, metadata,
          gateway_subscription_id, gateway_customer_id,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now(), now())
        RETURNING id`,
        [
          subId,
          session.tenant_id,
          session.customer_id || null,
          plan.id,
          session.tenant_gateway_id,
          '', // gateway_customer_token - will be populated after customer creation
          req.body.paymentToken,
          'active',
          new Date().toISOString(),
          periodEndCalc.toISOString(),
          1, // seatQuantity
          1, // quantity
          JSON.stringify({}),
          chargeResult.transactionId,
          '', // gateway_customer_id - will be filled after customer creation
        ]
      );
      
      // Update checkout session
      await client.query(
        `UPDATE checkout_sessions 
         SET status = 'completed', 
             payment_token = $2,
             gateway_customer_token = $3,
             gateway_payment_token = $4,
             gateway_customer_id = $5,
             gateway_payment_intent_id = $6,
             customer_name = $7,
             subscription_id = $8,
             completed_at = now(),
             updated_at = now()
         WHERE id = $1`,
        [sessionId, chargeResult.transactionId, '', req.body.paymentToken, '', chargeResult.transactionId, req.body.customerName || null, subId]
      );
      
      // Create invoice
      await client.query(
        `INSERT INTO invoices (
          tenant_id, customer_id, subscription_id, plan_id,
          amount, currency, status, description,
          period_start, period_end, due_at, issued_at, paid_at,
          gateway_invoice_id, gateway_payment_intent_id,
          line_items, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'paid', $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, now())`,
        [
          session.tenant_id,
          session.customer_id || null,
          "sub_" + genId(), // subscription ID
          plan.id,
          plan.amount,
          plan.currency,
          `${plan.name} subscription checkout`,
          new Date().toISOString(),
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          new Date().toISOString(),
          new Date().toISOString(),
          new Date().toISOString(),
          chargeResult.transactionId,
          chargeResult.transactionId,
          JSON.stringify([{
            description: `${plan.name} subscription`,
            quantity: 1,
            unitAmount: plan.amount.toString(),
            amount: plan.amount.toString(),
            type: 'base_fee',
          }]),
          JSON.stringify({}),
        ]
      );
      
      // Update session as completed
      await client.query(
        `UPDATE checkout_sessions 
         SET status = 'completed', completed_at = now(), subscription_id = $2, updated_at = now()
         WHERE id = $1`,
        [sessionId, "sub_" + genId()]
      );
      
      // Return success with redirect
      return res.json({
        success: true,
        subscriptionId: "sub_" + genId(),
        redirectUrl: session.success_url || "/dashboard",
      });
    });
    
  } catch (err) {
    console.error("Checkout confirmation error:", err);
    
    // Update session as failed
    await query(
      `UPDATE checkout_sessions 
       SET status = 'failed', 
           metadata = metadata || jsonb_build_object('last_error', jsonb_build_object(
             'code', $2,
             'message', $3,
             'at', now()
           )),
           updated_at = now()
       WHERE id = $1`,
      [sessionId, 'CHARGE_FAILED', err instanceof Error ? err.message : 'Unknown error']
    );
    
    // Return error to frontend
    return res.status(400).json({
      error: err instanceof Error ? err.message : "Payment failed",
      code: err instanceof NonCustodialBillingError ? (err as any).code : "CHARGE_FAILED",
      recoverable: err instanceof NonCustodialBillingError ? (err as any).recoverable : true,
    });
  }
}));

// ============================================================
// Helper function to extract public key from secret
// ============================================================

function extractPublicKey(secretKey: string, gateway: string, mode: 'live' | 'test'): string | null {
  if (gateway === 'stripe') {
    // Stripe: sk_live_xxx -> pk_live_xxx, sk_test_xxx -> pk_test_xxx
    return secretKey.replace(/^sk_(live|test)_/, 'pk_$1_');
  }
  if (gateway === 'paystack') {
    // Paystack: sk_live_xxx -> pk_live_xxx
    return secretKey.replace(/^sk_(live|test)_/, 'pk_$1_');
  }
  if (gateway === 'flutterwave') {
    // Flutterwave: FLWSECK-xxx -> FLWPUBK-xxx
    return secretKey.replace(/^FLWSECK-/, 'FLWPUBK-');
  }
  return null;
}

export default router;