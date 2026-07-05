// ============================================================
// Flutterwave Payment Gateway Adapter
// ============================================================

import type {
  PaymentGatewayAdapter,
  VerifyConnectionResult,
  CreateCustomerParams,
  GatewayCustomer,
  CreateSubscriptionParams,
  UpdateSubscriptionParams,
  GatewaySubscription,
  CreateInvoiceParams,
  GatewayInvoice,
  GatewayWebhookEvent,
  GatewayCapabilities,
} from '../adapter.ts';

const BASE_URL = 'https://api.flutterwave.com/v3';

async function flwFetch(path: string, apiKey: string, options: RequestInit = {}): Promise<any> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  const response = await fetch(url, { ...options, headers });
  const data = await response.json();

  if (data.status !== 'success' && data.status !== 'pending') {
    const msg = data.message || data.data?.message || `HTTP ${response.status}`;
    throw new Error(`Flutterwave API error: ${msg}`);
  }

  return data;
}

export class FlutterwaveAdapter implements PaymentGatewayAdapter {
  name = 'flutterwave';

  capabilities: GatewayCapabilities = {
    supportsUsageRecords: false,
    supportsPaymentMethods: false,
    supportsSubscriptions: false,
    supportsInvoices: true,
    usesWebhookSignatures: true,
  };

  // ── Connection ────────────────────────────────────────────

  async verifyConnection(apiKey: string): Promise<VerifyConnectionResult> {
    try {
      const result = await flwFetch('/balances', apiKey);
      const bal = result.data?.[0];
      return {
        verified: true,
        accountId: bal?.currency || undefined,
        accountName: bal?.customer?.name || undefined,
        accountEmail: bal?.customer?.email || undefined,
      };
    } catch (err: any) {
      return { verified: false, error: err.message };
    }
  }

  // ── Customers ─────────────────────────────────────────────

  async createCustomer(apiKey: string, data: CreateCustomerParams): Promise<GatewayCustomer> {
    const result = await flwFetch('/customers', apiKey, {
      method: 'POST',
      body: JSON.stringify({
        email: data.email,
        first_name: data.name.split(' ')[0] || data.name,
        last_name: data.name.split(' ').slice(1).join(' ') || '',
        name: data.name,
      }),
    });
    const c = result.data;
    return {
      gatewayId: c.id?.toString() || c.customer_id,
      name: c.name || data.name,
      email: c.email,
      createdAt: c.created_at || new Date().toISOString(),
    };
  }

  async findCustomer(apiKey: string, email: string): Promise<GatewayCustomer | null> {
    try {
      const result = await flwFetch(`/customers?email=${encodeURIComponent(email)}`, apiKey);
      const c = result.data?.[0];
      if (!c) return null;
      return {
        gatewayId: c.id?.toString() || c.customer_id,
        name: c.name || '',
        email: c.email,
        createdAt: c.created_at || new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  // ── Subscriptions (via recurring payment plans) ──────────

  async createSubscription(apiKey: string, data: CreateSubscriptionParams): Promise<GatewaySubscription> {
    // Flutterwave doesn't have native subscriptions in the traditional sense.
    // We use payment links or payment plans. This creates a payment plan
    // and returns a reference that can be used for recurring charges.
    const now = new Date();
    const endDate = new Date(now.getTime() + 30 * 86400000);

    const result = await flwFetch('/payment-plans', apiKey, {
      method: 'POST',
      body: JSON.stringify({
        amount: data.priceAmount || 0,
        name: `AoraHQ Subscription ${now.toISOString().split('T')[0]}`,
        interval: data.interval === 'yearly' ? 'yearly' : 'monthly',
        duration: 0, // indefinite
        currency: (data.currency || 'NGN').toUpperCase(),
      }),
    });

    return {
      gatewayId: result.data?.id?.toString() || result.data?.plan_token || 'unknown',
      customerGatewayId: data.customerGatewayId,
      status: 'active',
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: endDate.toISOString(),
      trialEnd: data.trialDays && data.trialDays > 0
        ? new Date(now.getTime() + data.trialDays * 86400000).toISOString()
        : undefined,
    };
  }

  async cancelSubscription(apiKey: string, id: string): Promise<{ status: string; canceledAt: string }> {
    try {
      await flwFetch(`/payment-plans/${id}/cancel`, apiKey, { method: 'PUT' });
    } catch {
      // Best-effort cancellation
    }
    return { status: 'canceled', canceledAt: new Date().toISOString() };
  }

  async updateSubscription(apiKey: string, id: string, data: UpdateSubscriptionParams): Promise<GatewaySubscription> {
    // Flutterwave doesn't support plan updates post-creation
    return {
      gatewayId: id,
      customerGatewayId: '',
      status: 'active',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
    };
  }

  async getSubscription(apiKey: string, id: string): Promise<GatewaySubscription> {
    try {
      const result = await flwFetch(`/payment-plans/${id}`, apiKey);
      return {
        gatewayId: id,
        customerGatewayId: '',
        status: result.data?.status || 'active',
        currentPeriodStart: result.data?.created_at || new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
      };
    } catch {
      return {
        gatewayId: id,
        customerGatewayId: '',
        status: 'active' as const,
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
      };
    }
  }

  // ── Invoices (payment links) ─────────────────────────────

  async createInvoice(apiKey: string, data: CreateInvoiceParams): Promise<GatewayInvoice> {
    const txRef = `aora_inv_${Date.now()}`;
    const result = await flwFetch('/payments', apiKey, {
      method: 'POST',
      body: JSON.stringify({
        tx_ref: txRef,
        amount: data.amount,
        currency: (data.currency || 'NGN').toUpperCase(),
        customer: {
          email: data.metadata?.customer_email || 'customer@example.com',
          name: data.metadata?.customer_name || '',
        },
        meta: data.metadata || {},
        redirect_url: process.env.APP_URL ? `${process.env.APP_URL}/payments/callback` : undefined,
      }),
    });

    return {
      gatewayId: result.data?.id?.toString() || txRef,
      hostedUrl: result.data?.link || undefined,
      status: result.data?.status || 'pending',
      amount: data.amount,
      currency: data.currency || 'NGN',
    };
  }

  async finalizeInvoice(apiKey: string, id: string): Promise<GatewayInvoice> {
    return { gatewayId: id, status: 'open', amount: 0, currency: 'NGN' };
  }

  // ── Webhooks ──────────────────────────────────────────────

  verifyWebhookSignature(payload: string, signatureHeader: string, secret: string): boolean {
    try {
      const crypto = require('crypto');
      const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      if (expected.length !== signatureHeader.length) return false;
      let diff = 0;
      for (let i = 0; i < expected.length; i++) {
        diff |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
      }
      return diff === 0;
    } catch {
      return false;
    }
  }

  mapWebhookEvent(gateway: string, event: any): GatewayWebhookEvent | null {
    if (!event || !event.event) return null;

    const base: GatewayWebhookEvent = {
      type: event.event?.type || event.event,
      eventId: event.event?.id || `${event.event}_${Date.now()}`,
      gateway: 'flutterwave',
      raw: event,
    };

    const data = event.data || event;

    switch (event.event?.type || event.event) {
      case 'charge.completed':
      case 'charge.success':
        return {
          ...base,
          customerId: data?.customer?.id?.toString() || data?.customer?.email,
          subscriptionId: data?.plan?.id?.toString() || data?.payment_plan,
          invoiceId: data?.id?.toString() || data?.tx_ref,
          paymentIntentId: data?.flw_ref || data?.transaction_id?.toString(),
          amount: data?.amount ? Number(data.amount) : undefined,
          currency: data?.currency,
          status: 'success',
        };

      case 'charge.failed':
        return {
          ...base,
          customerId: data?.customer?.id?.toString() || data?.customer?.email,
          amount: data?.amount ? Number(data.amount) : undefined,
          currency: data?.currency,
          status: 'failed',
        };

      case 'transfer.completed':
      case 'transfer.failed':
        return base;

      default:
        return base;
    }
  }
}
