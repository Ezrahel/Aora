// ============================================================
// Billing Sync Service
// Routes billing CRUD operations through connected gateway adapters.
// When no gateway is connected, falls back to local-only operations.
// ============================================================

import { gatewayRepo, customerRepo, subscriptionRepo, invoiceRepo, query } from "../db.ts";
import { getAdapter, decrypt } from "../../gateways/index.ts";

/**
 * Find the best gateway connection for a workspace.
 * Prefers live over test, verified over unverified.
 */
export async function findActiveGateway(workspaceId: string) {
  return gatewayRepo.findActive(workspaceId);
}

/**
 * Create a subscription on the connected gateway and locally.
 * If no gateway is connected, creates locally only.
 */
export async function createSubscriptionOnGateway(
  workspaceId: string,
  customerId: string,
  planId: string,
  options: { trialDays?: number; seatQuantity?: number },
) {
  const gateway = await findActiveGateway(workspaceId);

  // Always create locally first
  const now = new Date().toISOString();
  const subId = "sub_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const localSub = await subscriptionRepo.create(null, {
    id: subId,
    customerId,
    planId,
    status: (options.trialDays && options.trialDays > 0) ? "trial" : "active",
    currentPeriodStart: now,
    currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
    trialEnd: options.trialDays && options.trialDays > 0
      ? new Date(Date.now() + options.trialDays * 86400000).toISOString()
      : undefined,
    seatQuantity: options.seatQuantity || 1,
  });

  if (!gateway) {
    return { local: localSub, gateway: null };
  }

  // Create on gateway
  try {
    const apiKey = decrypt(gateway.encrypted_api_key);
    const adapter = getAdapter(gateway.gateway);

    // Find or create customer on gateway
    const customer = await customerRepo.findById(null, customerId);
    let gatewayCustomer = null;
    if (customer) {
      try {
        gatewayCustomer = await adapter.findCustomer(apiKey, customer.email);
      } catch { /* ignore */ }
    }

    if (!gatewayCustomer) {
      gatewayCustomer = await adapter.createCustomer(apiKey, {
        name: customer?.name || customerId,
        email: customer?.email || `customer-${customerId}@example.com`,
        metadata: { aoraCustomerId: customerId },
      });
    }

    const gatewaySub = await adapter.createSubscription(apiKey, {
      customerGatewayId: gatewayCustomer.gatewayId,
      interval: "monthly",
      trialDays: options.trialDays || 0,
      metadata: { aoraCustomerId: customerId, aoraPlanId: planId },
    });

    // Update local subscription with gateway IDs via raw query
    await query(
      "UPDATE subscriptions SET gateway_subscription_id = $1, gateway_customer_id = $2, current_period_start = $3, current_period_end = $4 WHERE id = $5",
      [gatewaySub.gatewayId, gatewayCustomer.gatewayId, gatewaySub.currentPeriodStart, gatewaySub.currentPeriodEnd, subId],
    );

    const updated = await subscriptionRepo.findById(null, subId);
    return { local: updated || localSub, gateway: gatewaySub };
  } catch (err) {
    console.error("Gateway subscription creation failed, using local-only:", err);
    return { local: localSub, gateway: null };
  }
}

/**
 * Cancel a subscription on the gateway and locally.
 */
export async function cancelSubscriptionOnGateway(
  workspaceId: string,
  subscriptionId: string,
  immediately = false,
) {
  const sub = await subscriptionRepo.findById(null, subscriptionId);
  if (!sub) throw new Error("Subscription not found");

  const now = new Date().toISOString();

  // Check gateway_subscription_id via query
  const { rows } = await query(
    "SELECT gateway_subscription_id FROM subscriptions WHERE id = $1",
    [subscriptionId],
  );
  const gatewaySubId = rows[0]?.gateway_subscription_id;

  if (gatewaySubId) {
    const gateway = await findActiveGateway(workspaceId);
    if (gateway) {
      try {
        const apiKey = decrypt(gateway.encrypted_api_key);
        const adapter = getAdapter(gateway.gateway);
        await adapter.cancelSubscription(apiKey, gatewaySubId);
      } catch (err) {
        console.error("Gateway cancellation failed:", err);
      }
    }
  }

  return subscriptionRepo.update(null, subscriptionId, {
    status: "canceled",
    canceledAt: now,
    ...(immediately ? {} : { cancelAtPeriodEnd: true }),
  });
}

/**
 * Create an invoice on the connected gateway and locally.
 */
export async function createInvoiceOnGateway(
  workspaceId: string,
  customerId: string,
  amount: number,
  currency: string,
) {
  const gateway = await findActiveGateway(workspaceId);

  const inv = await invoiceRepo.create(null, {
    id: "inv_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    workspaceId,
    customerId,
    amount,
    currency,
    status: "draft",
    usageUnits: 0,
  });

  if (!gateway) {
    return { local: inv, gateway: null };
  }

  try {
    const apiKey = decrypt(gateway.encrypted_api_key);
    const adapter = getAdapter(gateway.gateway);

    // Get customer gateway ID from subscriptions
    const { rows } = await query(
      "SELECT gateway_customer_id FROM subscriptions WHERE customer_id = $1 AND gateway_customer_id IS NOT NULL LIMIT 1",
      [customerId],
    );
    const gatewayCustomerId = rows[0]?.gateway_customer_id;

    if (gatewayCustomerId) {
      const gatewayInv = await adapter.createInvoice(apiKey, {
        customerGatewayId: gatewayCustomerId,
        amount,
        currency,
      });

      // Update invoice with gateway info
      await query(
        "UPDATE invoices SET gateway_invoice_id = $1, gateway_hosted_url = $2, gateway_pdf_url = $3 WHERE id = $4",
        [gatewayInv.gatewayId, gatewayInv.hostedUrl || null, gatewayInv.pdfUrl || null, inv.id],
      );

      const updated = await invoiceRepo.findById(null, inv.id);
      return { local: updated || inv, gateway: gatewayInv };
    }
  } catch (err) {
    console.error("Gateway invoice creation failed:", err);
  }

  return { local: inv, gateway: null };
}

/**
 * Sync a subscription's status from the gateway.
 */
export async function syncSubscriptionFromGateway(
  workspaceId: string,
  subscriptionId: string,
) {
  const sub = await subscriptionRepo.findById(null, subscriptionId);
  if (!sub) return null;

  const { rows } = await query(
    "SELECT gateway_subscription_id FROM subscriptions WHERE id = $1",
    [subscriptionId],
  );
  const gatewaySubId = rows[0]?.gateway_subscription_id;
  if (!gatewaySubId) return sub;

  const gateway = await findActiveGateway(workspaceId);
  if (!gateway) return sub;

  try {
    const apiKey = decrypt(gateway.encrypted_api_key);
    const adapter = getAdapter(gateway.gateway);

    if (adapter.getSubscription) {
      const gatewaySub = await adapter.getSubscription(apiKey, gatewaySubId);
      return subscriptionRepo.update(null, subscriptionId, {
        currentPeriodStart: gatewaySub.currentPeriodStart,
        currentPeriodEnd: gatewaySub.currentPeriodEnd,
        status: gatewaySub.status as any,
      });
    }
  } catch (err) {
    console.error("Gateway sync failed:", err);
  }

  return sub;
}
