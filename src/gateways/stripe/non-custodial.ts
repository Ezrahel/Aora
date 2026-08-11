// ============================================================
// Stripe Non-Custodial Payment Gateway Adapter
// Implements chargeToken and refund for non-custodial billing
// ============================================================

import type {
  NonCustodialPaymentGateway,
  NonCustodialBillingError,
} from '../non-custodial-adapter.ts';

const STRIPE_API_URL = 'https://api.stripe.com/v1';
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

async function stripeFetch(
  path: string,
  apiKey: string,
  body?: Record<string, any>,
  method: 'GET' | 'POST' | 'DELETE' = body ? 'POST' : 'GET'
): Promise<any> {
  const url = path.startsWith('http') ? path : `${STRIPE_API_URL}${path}`;
  const formBody = body ? toFormBody(body) : undefined;

  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Stripe-Version': '2025-02-24.acacia',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formBody,
  });

  const data = await response.json();

  if (!response.ok) {
    const msg = data.error?.message || data.error?.code || `HTTP ${response.status}`;
    const error = new Error(msg) as Error & { code?: string; gateway?: string; recoverable?: boolean; originalError?: Error };
    error.code = data.error?.code || 'STRIPE_API_ERROR';
    error.gateway = 'stripe';
    error.recoverable = response.status >= 500 || response.status === 429;
    error.originalError = new Error(msg);
    throw error;
  }

  return data;
}

export class StripeNonCustodialGateway {
  readonly name = 'stripe';

  /**
   * Charge a saved payment method/token
   * 
   * In non-custodial mode, we use the merchant's secret key and the
   * customer's saved payment method (payment_method_id) to create
   * a charge directly. We don't create subscriptions at the gateway level.
   */
  async chargeToken(params: {
    secretKey: string;
    customerToken: string;
    paymentToken: string;
    amount: bigint;
    currency: string;
    description?: string;
    metadata?: Record<string, string>;
  }): Promise<{
    transactionId: string;
    amount: bigint;
    currency: string;
    status: string;
    rawResponse: any;
  }> {
    // For non-custodial, we use the PaymentIntent API with the saved payment method
    // This charges the saved payment method on the customer
    const amountInLowestDenom = Number(params.amount); // Already in lowest denom

    const body: Record<string, any> = {
      amount: amountInLowestDenom,
      currency: params.currency,
      customer: params.customerToken,
      payment_method: params.paymentToken,
      off_session: 'true',
      confirm: 'true',
      description: params.description,
      metadata: params.metadata,
    };

    const data = await stripeFetch('/payment_intents', params.secretKey, body);

    return {
      transactionId: data.id,
      amount: BigInt(data.amount),
      currency: data.currency,
      status: data.status,
      rawResponse: data,
    };
  }

  async refund(params: {
    secretKey: string;
    transactionId: string;
    amount?: bigint;
    currency: string;
    reason?: string;
  }): Promise<{
    refundId: string;
    amount: bigint;
    currency: string;
    status: 'succeeded' | 'pending' | 'failed';
    rawResponse: any;
  }> {
    const body: Record<string, any> = {
      payment_intent: params.transactionId,
    };

    if (params.amount !== undefined) {
      body.amount = Number(params.amount);
    }

    if (params.reason) {
      body.reason = params.reason;
    }

    const data = await stripeFetch(
      '/refunds',
      params.secretKey,
      body,
      'POST'
    );

    return {
      refundId: data.id,
      amount: BigInt(data.amount),
      currency: data.currency,
      status: data.status as 'succeeded' | 'pending' | 'failed',
      rawResponse: data,
    };
  }
}

// Export singleton instance
export const stripeNonCustodialGateway = new StripeNonCustodialGateway();