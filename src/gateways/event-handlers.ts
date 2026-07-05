// ============================================================
// Gateway Event Handlers
// Maps gateway webhook events to AoraHQ internal operations.
// ============================================================

import type pg from "pg";
import { query, retryable, invoiceRepo, subscriptionRepo, customerRepo, dunningRepo, gatewayEventRepo } from "../api/db.ts";
import type { GatewayWebhookEvent } from "./adapter.ts";
import type { Workspace } from "../api/types.ts";

interface HandlerResult {
  processed: boolean;
  skipped?: boolean;
  reason?: string;
}

type EventHandler = (
  ws: Workspace,
  event: GatewayWebhookEvent,
  client: pg.PoolClient,
) => Promise<HandlerResult>;

// ── Handlers ───────────────────────────────────────────────

const handlePaymentSuccess: EventHandler = async (ws, event, client) => {
  // Find subscription by gateway subscription ID
  let sub = null;
  if (event.subscriptionId) {
    const { rows } = await client.query(
      "SELECT id, customer_id, plan_id, status FROM subscriptions WHERE gateway_subscription_id = $1 LIMIT 1",
      [event.subscriptionId],
    );
    sub = rows[0] ?? null;
  }

  // If no subscription found, try finding by gateway customer ID
  if (!sub && event.customerId) {
    const { rows } = await client.query(
      "SELECT id, customer_id, plan_id, status FROM subscriptions WHERE gateway_customer_id = $1 AND status IN ('active', 'trial') LIMIT 1",
      [event.customerId],
    );
    sub = rows[0] ?? null;
  }

  if (!sub) {
    return { processed: false, skipped: true, reason: "No matching subscription found" };
  }

  // Find and mark invoice as paid if we have a gateway invoice ID
  if (event.invoiceId) {
    const { rows: invRows } = await client.query(
      "SELECT id, status FROM invoices WHERE gateway_invoice_id = $1 AND status != 'paid' LIMIT 1",
      [event.invoiceId],
    );
    if (invRows[0]) {
      await invoiceRepo.patchStatus(client, invRows[0].id, "paid");
    }
  }

  // Update subscription last synced timestamp
  await client.query(
    "UPDATE subscriptions SET last_synced_at = now() WHERE id = $1",
    [sub.id],
  );

  return { processed: true };
};

const handlePaymentFailed: EventHandler = async (ws, event, client) => {
  let sub = null;
  if (event.subscriptionId) {
    const { rows } = await client.query(
      "SELECT id, customer_id, plan_id FROM subscriptions WHERE gateway_subscription_id = $1 LIMIT 1",
      [event.subscriptionId],
    );
    sub = rows[0] ?? null;
  }

  if (!sub && event.customerId) {
    const { rows } = await client.query(
      "SELECT id, customer_id FROM subscriptions WHERE gateway_customer_id = $1 AND status IN ('active', 'trial') LIMIT 1",
      [event.customerId],
    );
    sub = rows[0] ?? null;
  }

  if (!sub) {
    return { processed: false, skipped: true, reason: "No matching subscription" };
  }

  // Mark the latest invoice as past_due
  if (event.invoiceId) {
    const { rows: invRows } = await client.query(
      "SELECT id, status FROM invoices WHERE gateway_invoice_id = $1 LIMIT 1",
      [event.invoiceId],
    );
    if (invRows[0] && invRows[0].status !== "past_due" && invRows[0].status !== "paid") {
      await invoiceRepo.patchStatus(client, invRows[0].id, "past_due");

      // Schedule first dunning attempt
      await dunningRepo.create(client, {
        id: "dun_" + Date.now(),
        invoiceId: invRows[0].id,
        attemptNumber: 1,
        action: "email_reminder",
        scheduledAt: new Date(Date.now() + 86400000).toISOString(), // 1 day
      });
    }
  } else {
    // Find the latest invoice for this customer
    const { rows: invoices } = await client.query(
      "SELECT id, status FROM invoices WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 1",
      [sub.customer_id],
    );
    if (invoices[0] && invoices[0].status !== "paid") {
      await invoiceRepo.patchStatus(client, invoices[0].id, "past_due");
    }
  }

  return { processed: true };
};

const handleInvoicePaid: EventHandler = async (ws, event, client) => {
  if (!event.invoiceId) return { processed: false, skipped: true, reason: "No invoice ID" };

  const { rows } = await client.query(
    "SELECT id, status FROM invoices WHERE gateway_invoice_id = $1 LIMIT 1",
    [event.invoiceId],
  );

  if (rows[0] && rows[0].status !== "paid") {
    await invoiceRepo.patchStatus(client, rows[0].id, "paid");
    // Cancel any pending dunning attempts
    await dunningRepo.markAllSkipped(client, rows[0].id);
  }

  return { processed: true };
};

const handleSubscriptionCreated: EventHandler = async (ws, event, client) => {
  if (!event.subscriptionId || !event.customerId) {
    return { processed: false, skipped: true, reason: "Missing subscription or customer ID" };
  }

  // Update existing subscription with gateway IDs
  const { rows } = await client.query(
    "SELECT id FROM subscriptions WHERE gateway_customer_id = $1 AND gateway_subscription_id IS NULL LIMIT 1",
    [event.customerId],
  );

  if (rows[0]) {
    await client.query(
      "UPDATE subscriptions SET gateway_subscription_id = $1, last_synced_at = now() WHERE id = $2",
      [event.subscriptionId, rows[0].id],
    );
  }

  return { processed: true };
};

const handleSubscriptionUpdated: EventHandler = async (ws, event, client) => {
  if (!event.subscriptionId) return { processed: false, skipped: true, reason: "No subscription ID" };

  await client.query(
    "UPDATE subscriptions SET last_synced_at = now() WHERE gateway_subscription_id = $1",
    [event.subscriptionId],
  );

  return { processed: true };
};

const handleSubscriptionDeleted: EventHandler = async (ws, event, client) => {
  if (!event.subscriptionId) return { processed: false, skipped: true, reason: "No subscription ID" };

  const { rows } = await client.query(
    "SELECT id, customer_id FROM subscriptions WHERE gateway_subscription_id = $1 LIMIT 1",
    [event.subscriptionId],
  );

  if (rows[0]) {
    await subscriptionRepo.update(client, rows[0].id, {
      status: "canceled",
      canceledAt: new Date().toISOString(),
    });
    await customerRepo.update(client, rows[0].customer_id, { status: "canceled" });
  }

  return { processed: true };
};

// ── Handler Registry ───────────────────────────────────────

const HANDLERS: Record<string, EventHandler> = {
  // Stripe
  "charge.succeeded": handlePaymentSuccess,
  "charge.failed": handlePaymentFailed,
  "charge.refunded": handlePaymentFailed,
  "invoice.payment_succeeded": handleInvoicePaid,
  "invoice.payment_failed": handlePaymentFailed,
  "invoice.finalized": handleInvoicePaid,
  "customer.subscription.created": handleSubscriptionCreated,
  "customer.subscription.updated": handleSubscriptionUpdated,
  "customer.subscription.deleted": handleSubscriptionDeleted,

  // Paystack
  "charge.success": handlePaymentSuccess,
  "invoice.create:success": handleInvoicePaid,
  "invoice.update:success": handleInvoicePaid,
  "subscription.create:success": handleSubscriptionCreated,
  "subscription.disable": handleSubscriptionDeleted,

  // Flutterwave
  "charge.completed": handlePaymentSuccess,
};

/**
 * Dispatch a gateway event to the appropriate handler.
 * Runs inside a retryable SERIALIZABLE transaction.
 */
export async function dispatchGatewayEvent(ws: Workspace, event: GatewayWebhookEvent): Promise<HandlerResult> {
  const handler = HANDLERS[event.type];
  if (!handler) {
    return { processed: false, skipped: true, reason: `No handler for event type: ${event.type}` };
  }

  try {
    return await retryable(async (client) => {
      const result = await handler(ws, event, client);
      if (result.processed) {
        await gatewayEventRepo.markProcessed(client, event.eventId);
      }
      return result;
    });
  } catch (err: any) {
    await gatewayEventRepo.markFailed(null, event.eventId, err.message);
    return { processed: false, reason: err.message };
  }
}
