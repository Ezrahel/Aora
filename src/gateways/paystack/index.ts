// ============================================================
// Paystack Payment Gateway Adapter
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

const BASE_URL = 'https://api.paystack.co';

async function paystackFetch(path: string, apiKey: string, options: RequestInit = {}): Promise<any> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  const response = await fetch(url, { ...options, headers });
  const data = await response.json();

  if (!response.ok || data.status === false) {
    const msg = data.message || data.gateway_response || `HTTP ${response.status}`;
    throw new Error(`Paystack API error: ${msg}`);
  }

  return data;
}

export class PaystackAdapter implements PaymentGatewayAdapter {
  name = 'paystack';

  capabilities: GatewayCapabilities = {
    supportsUsageRecords: false,
    supportsPaymentMethods: true,
    supportsSubscriptions: true,
    supportsInvoices: true,
    usesWebhookSignatures: true,
  };

  // ── Connection ────────────────────────────────────────────

  async verifyConnection(apiKey: string): Promise<VerifyConnectionResult> {
    try {
      const result = await paystackFetch('/transaction/balance', apiKey);
      return {
        verified: true,
        accountId: undefined,
        accountName: undefined,
        accountEmail: undefined,
      };
    } catch (err: any) {
      return { verified: false, error: err.message };
    }
  }

  // ── Customers ─────────────────────────────────────────────

  async createCustomer(apiKey: string, data: CreateCustomerParams): Promise<GatewayCustomer> {
    const result = await paystackFetch('/customer', apiKey, {
      method: 'POST',
      body: JSON.stringify({
        email: data.email,
        first_name: data.name.split(' ')[0] || data.name,
        last_name: data.name.split(' ').slice(1).join(' ') || '',
        ...(data.metadata ? { metadata: data.metadata } : {}),
      }),
    });
    const c = result.data;
    return {
      gatewayId: c.id?.toString() || c.customer_code,
      name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || data.name,
      email: c.email,
      createdAt: c.createdAt || new Date().toISOString(),
    };
  }

  async findCustomer(apiKey: string, email: string): Promise<GatewayCustomer | null> {
    try {
      const result = await paystackFetch(`/customer/${encodeURIComponent(email)}`, apiKey);
      const c = result.data;
      return {
        gatewayId: c.customer_code || c.id?.toString(),
        name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || '',
        email: c.email,
        createdAt: c.createdAt || new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  // ── Payment Methods ───────────────────────────────────────

  async listPaymentMethods(apiKey: string, customerGatewayId: string) {
    const result = await paystackFetch(`/customer/${customerGatewayId}`, apiKey);
    const auth = result.data?.authorizations || [];
    return auth.map((a: any) => ({
      id: a.authorization_code,
      brand: a.brand || 'unknown',
      last4: a.last4 || '0000',
      expiryMonth: parseInt(a.exp_month) || 0,
      expiryYear: parseInt(a.exp_year) || 0,
    }));
  }

  async attachPaymentMethod(apiKey: string, customerGatewayId: string, paymentMethodId: string) {
    // Paystack uses authorization codes, not PM IDs
    return null;
  }

  // ── Subscriptions ─────────────────────────────────────────

  async createSubscription(apiKey: string, data: CreateSubscriptionParams): Promise<GatewaySubscription> {
    // Paystack requires an existing plan code. For dynamic pricing, we create
    // a customer + invoice approach. Subscription is via plan.
    // This is a simplified version — in production you'd first create a plan.
    const now = Math.floor(Date.now() / 1000);
    const body: Record<string, any> = {
      customer: data.customerGatewayId,
      // Paystack requires plan or authorization + amount
      amount: data.priceAmount ? Math.round(data.priceAmount * 100) : 0,
      ...(data.metadata ? { metadata: data.metadata } : {}),
    };
    if (data.trialDays && data.trialDays > 0) {
      body.trial_days = data.trialDays;
    }

    const result = await paystackFetch('/paymentrequest', apiKey, {
      method: 'POST',
      body: JSON.stringify({
        customer: data.customerGatewayId,
        amount: data.priceAmount ? Math.round(data.priceAmount * 100) : 0,
        currency: (data.currency || 'NGN').toUpperCase(),
        description: 'AoraHQ subscription',
        due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      }),
    });

    return {
      gatewayId: result.data?.id?.toString() || result.data?.request_code || 'unknown',
      customerGatewayId: data.customerGatewayId,
      status: 'active',
      currentPeriodStart: new Date(now * 1000).toISOString(),
      currentPeriodEnd: new Date((now + 30 * 86400) * 1000).toISOString(),
    };
  }

  async cancelSubscription(apiKey: string, id: string): Promise<{ status: string; canceledAt: string }> {
    await paystackFetch(`/paymentrequest/${id}/finalize`, apiKey, { method: 'POST' });
    return { status: 'canceled', canceledAt: new Date().toISOString() };
  }

  async updateSubscription(apiKey: string, id: string, data: UpdateSubscriptionParams): Promise<GatewaySubscription> {
    const result = await paystackFetch(`/paymentrequest/${id}`, apiKey, {
      method: 'PUT',
      body: JSON.stringify({
        amount: data.priceAmount ? Math.round(data.priceAmount * 100) : undefined,
      }),
    });
    return {
      gatewayId: result.data?.id?.toString() || id,
      customerGatewayId: result.data?.customer?.customer_code || result.data?.customer || '',
      status: 'active',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
    };
  }

  async getSubscription(apiKey: string, id: string): Promise<GatewaySubscription> {
    const result = await paystackFetch(`/paymentrequest/${id}`, apiKey);
    return {
      gatewayId: result.data?.id?.toString() || id,
      customerGatewayId: result.data?.customer?.customer_code || '',
      status: result.data?.status || 'unknown',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
    };
  }

  // ── Invoices ──────────────────────────────────────────────

  async createInvoice(apiKey: string, data: CreateInvoiceParams): Promise<GatewayInvoice> {
    const result = await paystackFetch('/paymentrequest', apiKey, {
      method: 'POST',
      body: JSON.stringify({
        customer: data.customerGatewayId,
        amount: Math.round(data.amount * 100),
        currency: (data.currency || 'NGN').toUpperCase(),
        description: data.description || 'AoraHQ invoice',
        due_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      }),
    });
    return {
      gatewayId: result.data?.id?.toString() || result.data?.request_code,
      hostedUrl: result.data?.request_url || undefined,
      status: result.data?.status || 'pending',
      amount: data.amount,
      currency: data.currency || 'NGN',
    };
  }

  async finalizeInvoice(apiKey: string, id: string): Promise<GatewayInvoice> {
    const result = await paystackFetch(`/paymentrequest/${id}/finalize`, apiKey, { method: 'POST' });
    return {
      gatewayId: id,
      status: result.data?.status || 'open',
      amount: 0,
      currency: 'NGN',
    };
  }

  // ── Webhooks ──────────────────────────────────────────────

  verifyWebhookSignature(payload: string, signatureHeader: string, secret: string): boolean {
    try {
      const crypto = require('crypto');
      const expected = crypto.createHmac('sha512', secret).update(payload).digest('hex');
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
      type: event.event,
      eventId: event.id || `${event.event}_${Date.now()}`,
      gateway: 'paystack',
      raw: event,
    };

    const data = event.data;

    switch (event.event) {
      case 'charge.success':
        return {
          ...base,
          customerId: data?.customer?.customer_code || data?.customer?.id?.toString(),
          subscriptionId: data?.subscription?.subscription_code || data?.subscription?.id?.toString(),
          invoiceId: data?.invoice?.id?.toString() || data?.reference,
          amount: data?.amount ? data.amount / 100 : undefined,
          currency: data?.currency,
          status: 'success',
        };

      case 'charge.failed':
        return {
          ...base,
          customerId: data?.customer?.customer_code || data?.customer?.id?.toString(),
          amount: data?.amount ? data.amount / 100 : undefined,
          currency: data?.currency,
          status: 'failed',
        };

      case 'invoice.create:success':
      case 'invoice.update:success':
        return {
          ...base,
          customerId: data?.customer?.customer_code || data?.customer?.id?.toString(),
          invoiceId: data?.id?.toString() || data?.request_code,
          amount: data?.amount ? data.amount / 100 : undefined,
          currency: data?.currency,
          status: data?.status,
        };

      case 'subscription.create:success':
      case 'subscription.disable':
        return {
          ...base,
          customerId: data?.customer?.customer_code || data?.customer?.id?.toString(),
          subscriptionId: data?.subscription_code || data?.id?.toString(),
          status: event.event === 'subscription.disable' ? 'canceled' : 'active',
        };

      case 'transfer.success':
      case 'transfer.failed':
        return base;

      default:
        return base;
    }
  }
}
