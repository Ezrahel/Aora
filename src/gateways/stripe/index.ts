// ============================================================
// Stripe Payment Gateway Adapter
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
  CreateUsageRecordParams,
  GatewayWebhookEvent,
  GatewayCapabilities,
} from '../adapter.ts';
import crypto from 'crypto';

const BASE_URL = 'https://api.stripe.com/v1';
const STRIPE_API_VERSION = '2025-02-24.acacia';

function toFormBody(data: Record<string, any>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach((v, i) => params.append(`${key}[${i}]`, String(v)));
      } else if (typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) {
          if (v !== undefined) {
            if (Array.isArray(v)) {
              v.forEach((arrItem, arrIdx) => params.append(`${key}[${k}][${arrIdx}]`, String(arrItem)));
            } else if (typeof v === 'object') {
              for (const [sk, sv] of Object.entries(v)) {
                params.append(`${key}[${k}][${sk}]`, String(sv));
              }
            } else {
              params.append(`${key}[${k}]`, String(v));
            }
          }
        }
      } else {
        params.append(key, String(value));
      }
    }
  }
  return params.toString();
}

async function stripeFetch(path: string, apiKey: string, body?: Record<string, any>): Promise<any> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const formBody = body ? toFormBody(body) : undefined;

  const response = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Stripe-Version': STRIPE_API_VERSION,
      ...(formBody ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: formBody,
  });

  const data = await response.json();

  if (!response.ok) {
    const msg = data.error?.message || data.error?.code || `HTTP ${response.status}`;
    throw new Error(`Stripe API error: ${msg}`);
  }

  return data;
}

async function stripeFetchRaw(path: string, apiKey: string, formParams?: URLSearchParams): Promise<any> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const formBody = formParams?.toString();

  const response = await fetch(url, {
    method: formBody ? 'POST' : 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Stripe-Version': STRIPE_API_VERSION,
      ...(formBody ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: formBody,
  });

  const data = await response.json();

  if (!response.ok) {
    const msg = data.error?.message || data.error?.code || `HTTP ${response.status}`;
    throw new Error(`Stripe API error: ${msg}`);
  }

  return data;
}

function mapInterval(interval: string): string {
  switch (interval) {
    case 'weekly': return 'week';
    case 'monthly': return 'month';
    case 'yearly': return 'year';
    case 'quarterly': return 'month';
    case 'day': case 'week': case 'month': case 'year': return interval;
    default: return 'month';
  }
}

export class StripeAdapter implements PaymentGatewayAdapter {
  name = 'stripe';

  capabilities: GatewayCapabilities = {
    supportsUsageRecords: true,
    supportsPaymentMethods: true,
    supportsSubscriptions: true,
    supportsInvoices: true,
    usesWebhookSignatures: true,
  };

  async verifyConnection(apiKey: string): Promise<VerifyConnectionResult> {
    try {
      const account = await stripeFetch('/account', apiKey);
      return {
        verified: true,
        accountId: account.id,
        accountName: account.settings?.dashboard?.display_name || account.business_profile?.name || account.id,
        accountEmail: account.email || undefined,
      };
    } catch (err: any) {
      return { verified: false, error: err.message };
    }
  }

  async createCustomer(apiKey: string, data: CreateCustomerParams): Promise<GatewayCustomer> {
    const body: Record<string, any> = { name: data.name, email: data.email };
    if (data.description) body.description = data.description;
    if (data.metadata) body.metadata = data.metadata;
    const customer = await stripeFetch('/customers', apiKey, body);
    return {
      gatewayId: customer.id,
      name: customer.name || data.name,
      email: customer.email || data.email,
      createdAt: new Date(customer.created * 1000).toISOString(),
    };
  }

  async findCustomer(apiKey: string, email: string): Promise<GatewayCustomer | null> {
    const result = await stripeFetch(`/customers?email=${encodeURIComponent(email)}&limit=1`, apiKey);
    if (!result.data?.length) return null;
    const c = result.data[0];
    return {
      gatewayId: c.id,
      name: c.name || '',
      email: c.email || email,
      createdAt: new Date(c.created * 1000).toISOString(),
    };
  }

  async attachPaymentMethod(apiKey: string, customerGatewayId: string, paymentMethodId: string) {
    return stripeFetch(`/payment_methods/${paymentMethodId}/attach`, apiKey, { customer: customerGatewayId });
  }

  async listPaymentMethods(apiKey: string, customerGatewayId: string) {
    const result = await stripeFetch(`/payment_methods?customer=${customerGatewayId}&type=card`, apiKey);
    return (result.data || []).map((pm: any) => ({
      id: pm.id,
      brand: pm.card?.brand || 'unknown',
      last4: pm.card?.last4 || '0000',
      expiryMonth: pm.card?.exp_month || 0,
      expiryYear: pm.card?.exp_year || 0,
    }));
  }

  async createSubscription(apiKey: string, data: CreateSubscriptionParams): Promise<GatewaySubscription> {
    const interval = mapInterval(data.interval || 'monthly');
    const productName =
      (data.metadata as any)?.planName || (data.metadata as any)?.name || 'AoraHQ Plan';
    // Stripe inline price creation uses product_data (not a placeholder product ID).
    // Flattened manually because generic toFormBody cannot encode arrays of objects.
    const params = new URLSearchParams();
    params.append('customer', data.customerGatewayId);
    params.append('items[0][price_data][currency]', (data.currency || 'usd').toLowerCase());
    params.append('items[0][price_data][product_data][name]', productName);
    params.append('items[0][price_data][unit_amount]', String(Math.round((data.priceAmount || 0) * 100)));
    params.append('items[0][price_data][recurring][interval]', interval);
    if (data.metadata) {
      for (const [k, v] of Object.entries(data.metadata)) {
        params.append(`metadata[${k}]`, String(v));
      }
    }
    if (data.trialDays && data.trialDays > 0) params.append('trial_period_days', String(data.trialDays));

    const sub = await stripeFetchRaw('/subscriptions', apiKey, params);
    return this._mapSubscription(sub);
  }

  async cancelSubscription(apiKey: string, id: string): Promise<{ status: string; canceledAt: string }> {
    const sub = await stripeFetch(`/subscriptions/${id}`, apiKey, {});
    return {
      status: sub.status === 'canceled' ? 'canceled' : sub.status,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : new Date().toISOString(),
    };
  }

  async updateSubscription(apiKey: string, id: string, data: UpdateSubscriptionParams): Promise<GatewaySubscription> {
    if (data.priceAmount === undefined) {
      const sub = await stripeFetch(`/subscriptions/${id}`, apiKey, data.metadata ? { metadata: data.metadata } : undefined);
      return this._mapSubscription(sub);
    }
    const interval = mapInterval(data.interval || 'monthly');
    const productName =
      (data.metadata as any)?.planName || (data.metadata as any)?.name || 'AoraHQ Plan';
    const params = new URLSearchParams();
    params.append('items[0][price_data][currency]', (data.currency || 'usd').toLowerCase());
    params.append('items[0][price_data][product_data][name]', productName);
    params.append('items[0][price_data][unit_amount]', String(Math.round(data.priceAmount * 100)));
    params.append('items[0][price_data][recurring][interval]', interval);
    if (data.metadata) {
      for (const [k, v] of Object.entries(data.metadata)) {
        params.append(`metadata[${k}]`, String(v));
      }
    }
    const sub = await stripeFetchRaw(`/subscriptions/${id}`, apiKey, params);
    return this._mapSubscription(sub);
  }

  async getSubscription(apiKey: string, id: string): Promise<GatewaySubscription> {
    const sub = await stripeFetch(`/subscriptions/${id}`, apiKey);
    return this._mapSubscription(sub);
  }

  async createInvoice(apiKey: string, data: CreateInvoiceParams): Promise<GatewayInvoice> {
    const body: Record<string, any> = { customer: data.customerGatewayId };
    if (data.description) body.description = data.description;
    if (data.metadata) body.metadata = data.metadata;
    const inv = await stripeFetch('/invoices', apiKey, body);
    return this._mapInvoice(inv);
  }

  async finalizeInvoice(apiKey: string, id: string): Promise<GatewayInvoice> {
    const inv = await stripeFetch(`/invoices/${id}/finalize`, apiKey, {});
    return this._mapInvoice(inv);
  }

  async voidInvoice(apiKey: string, id: string): Promise<GatewayInvoice> {
    const inv = await stripeFetch(`/invoices/${id}/void`, apiKey, {});
    return this._mapInvoice(inv);
  }

  async getInvoice(apiKey: string, id: string): Promise<GatewayInvoice> {
    const inv = await stripeFetch(`/invoices/${id}`, apiKey);
    return this._mapInvoice(inv);
  }

  async recordUsage(apiKey: string, data: CreateUsageRecordParams): Promise<void> {
    await stripeFetch(
      `/subscription_items/${data.subscriptionItemGatewayId}/usage_records`,
      apiKey,
      {
        quantity: data.quantity,
        timestamp: data.timestamp ? Math.floor(new Date(data.timestamp).getTime() / 1000) : Math.floor(Date.now() / 1000),
        action: 'increment',
      },
    );
  }

  verifyWebhookSignature(payload: string, signatureHeader: string, secret: string): boolean {
    try {
      const parts = signatureHeader.split(',').reduce((acc: Record<string, string>, part: string) => {
        const [k, v] = part.trim().split('=');
        if (k && v) acc[k] = v;
        return acc;
      }, {});

      const signedPayload = parts['t'] ? `${parts['t']}.${payload}` : payload;
      const expectedSig = parts['v1'];
      if (!expectedSig) return false;

      const computed = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

      if (computed.length !== expectedSig.length) return false;
      let diff = 0;
      for (let i = 0; i < computed.length; i++) {
        diff |= computed.charCodeAt(i) ^ expectedSig.charCodeAt(i);
      }
      return diff === 0;
    } catch {
      return false;
    }
  }

  mapWebhookEvent(gateway: string, event: any): GatewayWebhookEvent | null {
    if (!event || !event.type) return null;

    const base: GatewayWebhookEvent = {
      type: event.type,
      eventId: event.id,
      gateway: 'stripe',
      raw: event,
    };

    const data = event.data?.object;
    switch (event.type) {
      case 'charge.succeeded':
      case 'charge.failed':
      case 'charge.refunded':
        return { ...base, customerId: data?.customer, subscriptionId: data?.subscription, invoiceId: data?.invoice, paymentIntentId: data?.payment_intent, amount: data?.amount ? data.amount / 100 : undefined, currency: data?.currency, status: data?.status };
      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed':
      case 'invoice.finalized':
      case 'invoice.voided':
        return { ...base, customerId: data?.customer, subscriptionId: data?.subscription, invoiceId: data?.id, paymentIntentId: data?.payment_intent, amount: data?.total ? data.total / 100 : undefined, currency: data?.currency, status: data?.status };
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.trial_will_end':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed':
        return { ...base, customerId: data?.customer, subscriptionId: data?.id, status: data?.status };
      case 'payment_intent.succeeded':
      case 'payment_intent.payment_failed':
        return { ...base, customerId: data?.customer, invoiceId: data?.invoice, paymentIntentId: data?.id, amount: data?.amount ? data.amount / 100 : undefined, currency: data?.currency, status: data?.status };
      default:
        return base;
    }
  }

  private _mapSubscription(sub: any): GatewaySubscription {
    return {
      gatewayId: sub.id,
      customerGatewayId: sub.customer,
      status: sub.status,
      currentPeriodStart: new Date(sub.current_period_start * 1000).toISOString(),
      currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
      trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : undefined,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : undefined,
      latestInvoice: sub.latest_invoice ? {
        id: typeof sub.latest_invoice === 'string' ? sub.latest_invoice : sub.latest_invoice.id,
        amount: (sub.latest_invoice.total || sub.latest_invoice.amount_due || 0) / 100,
        currency: sub.latest_invoice.currency || 'usd',
        status: sub.latest_invoice.status || 'unknown',
      } : undefined,
      planId: sub.items?.data?.[0]?.price?.id,
    };
  }

  private _mapInvoice(inv: any): GatewayInvoice {
    return {
      gatewayId: inv.id,
      hostedUrl: inv.hosted_invoice_url || undefined,
      pdfUrl: inv.invoice_pdf || undefined,
      status: inv.status,
      amount: (inv.total || inv.amount_due || 0) / 100,
      currency: inv.currency || 'usd',
      paymentIntentId: inv.payment_intent || undefined,
    };
  }
}
