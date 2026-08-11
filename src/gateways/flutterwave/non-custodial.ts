// ============================================================
// Flutterwave Non-Custodial Payment Gateway Adapter
// ============================================================

import type {
  NonCustodialPaymentGateway,
  NonCustodialBillingError,
  RefundResult,
} from '../non-custodial-adapter.ts';
import { NonCustodialBillingError as BillingError } from '../non-custodial-adapter.ts';

const FLUTTERWAVE_API_URL = 'https://api.flutterwave.com/v3';

async function flutterwaveFetch(
  path: string,
  secretKey: string,
  body?: Record<string, any>,
  method: 'GET' | 'POST' = 'POST'
): Promise<any> {
  const url = path.startsWith('http') ? path : `${FLUTTERWAVE_API_URL}${path}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok || data.status !== 'success') {
    const msg = data.message || `HTTP ${response.status}`;
    throw new BillingError(
      msg,
      data.code || 'FLUTTERWAVE_API_ERROR',
      'flutterwave',
      response.status >= 500 || response.status === 429,
    );
  }

  return data.data;
}

export class FlutterwaveNonCustodialGateway {
  readonly name = 'flutterwave';

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
    const amountInLowest = Number(params.amount);

    const body = {
      amount: amountInLowest,
      currency: params.currency.toUpperCase(),
      customer: params.customerToken,
      token: params.paymentToken,
      description: params.description,
      metadata: params.metadata,
    };

    const data = await flutterwaveFetch('/charges', params.secretKey, body);

    return {
      transactionId: data.id || data.tx_ref,
      amount: BigInt(data.amount || amountInLowest),
      currency: data.currency,
      status: data.status === 'successful' ? 'succeeded' : data.status,
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
      transaction_id: params.transactionId,
    };

    if (params.amount !== undefined) {
      body.amount = Number(params.amount);
    }

    if (params.reason) {
      body.reason = params.reason;
    }

    const data = await flutterwaveFetch('/refunds', params.secretKey, body);

    const status: RefundResult['status'] =
      data.status === 'successful' ? 'succeeded' : data.status === 'pending' ? 'pending' : 'failed';

    return {
      refundId: data.id,
      amount: BigInt(data.amount),
      currency: data.currency,
      status,
      rawResponse: data,
    };
  }
}

export const flutterwaveNonCustodialGateway = new FlutterwaveNonCustodialGateway();