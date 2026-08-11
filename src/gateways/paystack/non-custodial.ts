// ============================================================
// Paystack Non-Custodial Payment Gateway Adapter
// ============================================================

import type {
  NonCustodialPaymentGateway,
  NonCustodialBillingError,
  RefundResult,
} from '../non-custodial-adapter.ts';
import { NonCustodialBillingError as BillingError } from '../non-custodial-adapter.ts';

const PAYSTACK_API_URL = 'https://api.paystack.co';

async function paystackFetch(
  path: string,
  secretKey: string,
  body?: Record<string, any>,
  method: 'GET' | 'POST' = 'POST'
): Promise<any> {
  const url = path.startsWith('http') ? path : `${PAYSTACK_API_URL}${path}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok || !data.status) {
    const msg = data.message || `HTTP ${response.status}`;
    throw new BillingError(
      msg,
      data.code || 'PAYSTACK_API_ERROR',
      'paystack',
      response.status >= 500 || response.status === 429,
    );
  }

  return data.data;
}

export class PaystackNonCustodialGateway {
  readonly name = 'paystack';

  readonly capabilities = {
    supportsRecurring: true,
    supportsRefunds: true,
    supportsPartialRefunds: true,
    minimumAmount: 100n, // 1 kobo
  };

  async chargeToken(params: {
    secretKey: string;
    customerToken: string;
    paymentToken: string;
    amount: bigint;
    currency: string;
    description?: string;
    metadata?: Record<string, string>;
  }) {
    const amountInKobo = Number(params.amount);

    const body = {
      amount: amountInKobo,
      currency: params.currency.toUpperCase(),
      email: params.customerToken, // Paystack uses email as customer identifier
      authorization_code: params.paymentToken,
      description: params.description,
      metadata: params.metadata,
      off_session: true,
    };

    const data = await paystackFetch('/transaction/charge_authorization', params.secretKey, body);

    return {
      transactionId: data.reference,
      amount: BigInt(data.amount),
      currency: data.currency,
      status: data.status === 'success' ? 'succeeded' : data.status,
      rawResponse: data,
    };
  }

  async refund(params: {
    secretKey: string;
    transactionId: string;
    amount?: bigint;
    currency: string;
    reason?: string;
  }): Promise<RefundResult> {
    const body: Record<string, any> = {
      transaction: params.transactionId,
    };

    if (params.amount !== undefined) {
      body.amount = Number(params.amount);
    }

    if (params.reason) {
      body.customer_note = params.reason;
    }

    const data = await paystackFetch('/refund', params.secretKey, body);

    const status: RefundResult['status'] =
      data.status === 'success' ? 'succeeded' : data.status === 'pending' ? 'pending' : 'failed';

    return {
      refundId: data.reference,
      amount: BigInt(data.amount),
      currency: data.currency,
      status,
      rawResponse: data,
    };
  }
}

export const paystackNonCustodialGateway = new PaystackNonCustodialGateway();