// ============================================================
// AoraHQ Non-Custodial Gateway Interface
// Minimal interface for non-custodial billing (chargeToken + refund)
// ============================================================

/** Parameters for charging a saved payment token */
export interface ChargeTokenParams {
  /** Gateway secret API key (decrypted from tenant_gateways) */
  secretKey: string;
  /** Gateway's customer identifier (e.g., Stripe customer_id) */
  customerToken: string;
  /** Gateway's saved payment method/token (e.g., Stripe payment_method_id) */
  paymentToken: string;
  /** Amount in lowest denomination (cents, kobo, etc.) */
  amount: bigint;
  /** 3-letter ISO currency code (usd, ngn, etc.) */
  currency: string;
  /** Human-readable description for the charge */
  description?: string;
  /** Metadata to attach to the charge */
  metadata?: Record<string, string>;
}

/** Parameters for refunding a charge */
export interface RefundParams {
  /** Gateway secret API key */
  secretKey: string;
  /** Gateway's transaction/charge ID to refund */
  transactionId: string;
  /** Amount to refund (partial if specified, full if omitted) */
  amount?: bigint;
  /** 3-letter ISO currency code */
  currency: string;
  /** Reason for refund */
  reason?: string;
}

/** Result of a successful charge */
export interface ChargeResult {
  /** Gateway's transaction/charge ID */
  transactionId: string;
  /** Amount actually charged (may differ from requested) */
  amount: bigint;
  /** Currency code */
  currency: string;
  /** Gateway-specific status */
  status: string;
  /** Raw gateway response for debugging */
  rawResponse: any;
}

/** Result of a refund operation */
export interface RefundResult {
  /** Gateway's refund ID */
  refundId: string;
  /** Amount refunded */
  amount: bigint;
  /** Currency code */
  currency: string;
  /** Refund status */
  status: 'succeeded' | 'pending' | 'failed';
  /** Raw gateway response */
  rawResponse: any;
}

/** Error class for non-custodial billing operations */
export class NonCustodialBillingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly gateway: string,
    public readonly recoverable: boolean = true,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'NonCustodialBillingError';
    Error.captureStackTrace(this, NonCustodialBillingError);
  }

  /** Wrap an arbitrary error into a NonCustodialBillingError */
  static fromGatewayError(
    gateway: string,
    error: unknown,
    _context?: string
  ): NonCustodialBillingError {
    const err = error instanceof Error ? error : new Error(String(error));
    const code = (err as any).code
      ? String((err as any).code)
      : 'GATEWAY_ERROR';
    const recoverable = Boolean((err as any).recoverable);
    return new NonCustodialBillingError(err.message, code, gateway, recoverable, err);
  }
}

/**
 * Non-Custodial Payment Gateway Interface
 * Minimal interface for charging saved payment tokens and processing refunds
 * without managing subscriptions or invoices at the gateway level
 */
export interface NonCustodialPaymentGateway {
  /** Gateway identifier (e.g., 'stripe', 'paystack', 'flutterwave') */
  readonly name: string;

  /**
   * Charge a saved payment token
   * This is the core non-custodial operation - we call the gateway
   * with the merchant's secret key and the customer's saved token
   */
  chargeToken(params: ChargeTokenParams): Promise<ChargeResult>;

  /**
   * Refund a previous charge
   */
  refund(params: RefundParams): Promise<RefundResult>;
}

// Registry for non-custodial gateways
const nonCustodialGateways = new Map<string, NonCustodialPaymentGateway>();

/** Register a non-custodial gateway implementation */
export function registerNonCustodialGateway(gateway: NonCustodialPaymentGateway): void {
  nonCustodialGateways.set(gateway.name, gateway);
}

/** Get a non-custodial gateway by name */
export function getNonCustodialGateway(name: string): NonCustodialPaymentGateway | undefined {
  return nonCustodialGateways.get(name);
}

/** List all registered non-custodial gateways */
export function listNonCustodialGateways(): string[] {
  return Array.from(nonCustodialGateways.keys());
}