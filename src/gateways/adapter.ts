// ============================================================
// AoraHQ Gateway Abstraction Layer — Core Interface
// Every payment gateway adapter implements this interface.
// ============================================================

export interface GatewayCapabilities {
  supportsUsageRecords: boolean;
  supportsPaymentMethods: boolean;
  supportsSubscriptions: boolean;
  supportsInvoices: boolean;
  usesWebhookSignatures: boolean;
}

// ── Connection ─────────────────────────────────────────────

export interface VerifyConnectionResult {
  verified: boolean;
  accountId?: string;
  accountName?: string;
  accountEmail?: string;
  error?: string;
}

// ── Customers ──────────────────────────────────────────────

export interface CreateCustomerParams {
  name: string;
  email: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface GatewayCustomer {
  gatewayId: string;
  name: string;
  email: string;
  createdAt: string;
}

// ── Payment Methods ────────────────────────────────────────

export interface GatewayPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
}

// ── Subscriptions ──────────────────────────────────────────

export interface CreateSubscriptionParams {
  customerGatewayId: string;
  priceAmount?: number;
  currency?: string;
  interval?: 'monthly' | 'yearly';
  trialDays?: number;
  metadata?: Record<string, string>;
}

export interface UpdateSubscriptionParams {
  priceAmount?: number;
  currency?: string;
  interval?: 'monthly' | 'yearly';
  metadata?: Record<string, string>;
}

export interface GatewaySubscription {
  gatewayId: string;
  customerGatewayId: string;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEnd?: string;
  canceledAt?: string;
  latestInvoice?: {
    id: string;
    hostedUrl?: string;
    pdfUrl?: string;
    amount: number;
    currency: string;
    status: string;
  };
  planId?: string;
}

// ── Invoices ───────────────────────────────────────────────

export interface CreateInvoiceParams {
  customerGatewayId: string;
  amount: number;
  currency: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface GatewayInvoice {
  gatewayId: string;
  hostedUrl?: string;
  pdfUrl?: string;
  status: string;
  amount: number;
  currency: string;
  paymentIntentId?: string;
}

// ── Usage Records ──────────────────────────────────────────

export interface CreateUsageRecordParams {
  subscriptionItemGatewayId: string;
  quantity: number;
  timestamp?: string;
}

// ── Webhook Events ─────────────────────────────────────────

export interface GatewayWebhookEvent {
  type: string;
  eventId: string;
  gateway: string;
  customerId?: string;
  subscriptionId?: string;
  invoiceId?: string;
  paymentIntentId?: string;
  amount?: number;
  currency?: string;
  status?: string;
  raw: any;
}

// ── The Adapter Interface ──────────────────────────────────

export interface PaymentGatewayAdapter {
  /** Human-readable name, e.g. 'stripe', 'paystack' */
  name: string;

  /** Declare what this gateway supports */
  capabilities: GatewayCapabilities;

  // ── Connection ──
  verifyConnection(apiKey: string): Promise<VerifyConnectionResult>;

  // ── Customers ──
  createCustomer(apiKey: string, data: CreateCustomerParams): Promise<GatewayCustomer>;
  findCustomer(apiKey: string, email: string): Promise<GatewayCustomer | null>;

  // ── Payment Methods ──
  attachPaymentMethod?(apiKey: string, customerGatewayId: string, paymentMethodId: string): Promise<GatewayPaymentMethod>;
  listPaymentMethods?(apiKey: string, customerGatewayId: string): Promise<GatewayPaymentMethod[]>;

  // ── Subscriptions ──
  createSubscription(apiKey: string, data: CreateSubscriptionParams): Promise<GatewaySubscription>;
  cancelSubscription(apiKey: string, id: string): Promise<{ status: string; canceledAt: string }>;
  updateSubscription?(apiKey: string, id: string, data: UpdateSubscriptionParams): Promise<GatewaySubscription>;
  getSubscription?(apiKey: string, id: string): Promise<GatewaySubscription>;

  // ── Invoices ──
  createInvoice(apiKey: string, data: CreateInvoiceParams): Promise<GatewayInvoice>;
  finalizeInvoice?(apiKey: string, id: string): Promise<GatewayInvoice>;
  voidInvoice?(apiKey: string, id: string): Promise<GatewayInvoice>;
  getInvoice?(apiKey: string, id: string): Promise<GatewayInvoice>;

  // ── Usage Records ──
  recordUsage?(apiKey: string, data: CreateUsageRecordParams): Promise<void>;

  // ── Webhooks ──
  verifyWebhookSignature(payload: string, signatureHeader: string, secret: string): boolean;
  mapWebhookEvent(gateway: string, event: any): GatewayWebhookEvent | null;
}
