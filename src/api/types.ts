// ============================================================
// Aora Billing OS — Canonical Server-Side Type Definitions
// All interfaces are exported for use by routes, db, and middleware.
// ============================================================

export interface Organization {
  id: string;
  name: string;
  status: "active" | "suspended";
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceProfile {
  tagline: string;
  description: string;
  website: string;
  industry: string;
  region: string;
  timezone: string;
  address: string;
  billingEmail: string;
  supportEmail: string;
  phone: string;
  logoUrl: string;
  coverUrl: string;
  accentColor: string;
  locale: string;
}

export interface WorkspaceSettings {
  currency: string;
  taxId: string;
  enableAutomaticDunning: boolean;
  enforceEntitlements: boolean;
}

export interface Workspace {
  id: string;
  organizationId: string;
  name: string;
  environment: "production" | "sandbox" | "development";
  apiKeys: string[];
  createdAt: string;
  profile: WorkspaceProfile;
  settings: WorkspaceSettings;
}

export interface Member {
  id: string;
  workspaceId: string;
  email: string;
  role: "owner" | "admin" | "billing_manager" | "developer" | "viewer";
  permissions: string[];
  createdAt: string;
}

export interface Product {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  isArchived?: boolean;
  createdAt: string;
}

export interface Feature {
  id: string;
  workspaceId: string;
  slug: string;
  name: string;
  description: string;
  type: "boolean" | "limit";
  isArchived?: boolean;
  createdAt: string;
}

export interface Plan {
  id: string;
  productId: string;
  name: string;
  price: number;
  currency: string;
  billingPeriod: "monthly" | "yearly";
  includedSeats: number;
  includedUsage: number;
  apiAccess: boolean;
  overageUnitPrice: number;
  description: string;
  code?: string;
  pricingType?: "flat" | "per_seat" | "usage" | "hybrid";
  isArchived?: boolean;
  createdAt: string;
}

export interface Entitlement {
  id: string;
  planId: string;
  featureId: string;
  value: string | number | boolean;
  isEnabled: boolean;
  createdAt: string;
}

export interface ClientEntitlement {
  featureId: string;
  featureName: string;
  description: string;
  requiredPlanId: string;
  isEnabled: boolean;
}

export interface CustomerNote {
  id: string;
  timestamp: string;
  text: string;
  author: string;
}

export interface Invoice {
  id: string;
  amount: number;
  currency: string;
  date: string;
  status: "paid" | "open" | "past_due" | "draft" | "void";
  pdfUrl?: string;
  usageUnits: number;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  periodStart?: string;
  periodEnd?: string;
  lineItems?: InvoiceLineItem[];
  voidedAt?: string;
  finalizedAt?: string;
  paidAt?: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  type: "base_fee" | "seat_charge" | "usage_overage" | "addon" | "discount" | "credit" | "tax";
}

export interface Customer {
  id: string;
  workspaceId: string;
  name: string;
  domain: string;
  email: string;
  logoColor: string;
  createdDate: string;
  planId: string;
  status: "active" | "canceled" | "trial" | "paused";
  paymentMethod: {
    brand: string;
    last4: string;
    expiry: string;
  } | null;
  seatsUsed: number;
  usageUnits: number;
  notes: CustomerNote[];
  invoices: Invoice[];
  contracts: {
    title: string;
    status: "signed" | "pending";
    value: string;
  }[];
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface Subscription {
  id: string;
  customerId: string;
  planId: string;
  status: "active" | "trial" | "canceled" | "paused";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEnd?: string;
  canceledAt?: string;
  pausedAt?: string;
  resumeAt?: string;
  cancelAtPeriodEnd?: boolean;
  seatQuantity: number;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt?: string;
}

export interface MeterDefinition {
  id: string;
  name: string;
  description: string;
  aggregationType: "sum" | "count" | "max" | "latest" | "min" | "average";
  targetField: string;
  slug?: string;
  eventSource?: string;
  unit?: string;
  status?: "draft" | "active" | "archived";
}

export interface Quota {
  id: string;
  customerId: string;
  meterId: string;
  limitValue: number;
  usedValue: number;
  period: "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "unlimited";
  createdAt: string;
}

export interface CreditLedgerEntry {
  id: string;
  customerId: string;
  amount: number;
  type: "credit_issued" | "credit_consumed" | "credit_expired" | "credit_reversed";
  description: string;
  createdAt: string;
  expireAt?: string;
}

export interface UsageEvent {
  id: string;
  customerId: string;
  meterId: string;
  timestamp: string;
  value: number;
  metadata: Record<string, any>;
}

export interface AuditLog {
  id: string;
  workspaceId: string;
  actor: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "ACCESS_VERIFY" | "ADJUST" | "INGEST" | "GRANT" | "DEDUCT" | "FINALIZE" | "PAY" | "VOID" | "REFUND" | "REVOKE" | "TEST";
  entityType:
    | "ORGANIZATION" | "WORKSPACE" | "MEMBER" | "PRODUCT" | "FEATURE"
    | "PLAN" | "ENTITLEMENT" | "CUSTOMER" | "SUBSCRIPTION" | "INVOICE"
    | "EVENT" | "METER" | "QUOTA" | "CREDIT" | "PRICE" | "RATE_CARD"
    | "DISCOUNT" | "COUPON" | "CONTRACT" | "WEBHOOK"
    | "CHAT_MESSAGE" | "USAGE";
  entityId: string;
  beforeState: any;
  afterState: any;
  createdAt: string;
}

export interface Tier {
  upTo: number | "infinity";
  unitPrice: number;
  flatFee?: number;
}

export interface Price {
  id: string;
  planId: string;
  name: string;
  type: "flat" | "usage" | "seat" | "tiered" | "volume" | "package" | "hybrid" | "custom_contract";
  billingPeriod: "monthly" | "yearly" | "quarterly" | "unlimited";
  currency: string;
  baseFee: number;
  seatPrice?: number;
  includedSeats?: number;
  meterId?: string;
  includedUsage?: number;
  overageUnitPrice?: number;
  tiers?: Tier[];
  volumePricing?: boolean;
  packageSize?: number;
  packagePrice?: number;
  version: number;
  isActive: boolean;
  isArchived?: boolean;
  createdAt: string;
}

export interface RateCard {
  id: string;
  name: string;
  description: string;
  meterId: string;
  priceType: "flat" | "tiered" | "volume" | "package";
  unitPrice?: number;
  tiers?: Tier[];
  includedUnits?: number;
  currency: string;
  isActive: boolean;
  createdAt: string;
}

export interface Discount {
  id: string;
  name: string;
  type: "percentage" | "fixed";
  value: number;
  appliesTo: "all" | "base_fee" | "overage" | "seat_fee";
  duration: "once" | "forever" | "repeating";
  durationMonths?: number;
  isDeleted?: boolean;
  createdAt: string;
}

export interface Coupon {
  id: string;
  name: string;
  discountId: string;
  code: string;
  isActive: boolean;
  expireAt?: string;
  maxRedemptions?: number;
  timesRedeemed: number;
  createdAt: string;
}

export interface CustomContract {
  id: string;
  customerId: string;
  name: string;
  customBaseFee: number;
  customSeatPrice?: number;
  customOverageUnitPrice?: number;
  minimumSpend?: number;
  additionalDiscountPercentage?: number;
  expireAt: string;
  isDeleted?: boolean;
  createdAt: string;
}

// ── Webhook System ──────────────────────────────────────────

export type WebhookEventType =
  | "subscription.created" | "subscription.updated" | "subscription.canceled"
  | "subscription.paused" | "subscription.resumed" | "subscription.trial_converted"
  | "invoice.created" | "invoice.finalized" | "invoice.paid" | "invoice.past_due" | "invoice.voided"
  | "customer.created" | "customer.updated" | "customer.deleted"
  | "plan.created" | "plan.updated"
  | "usage.limit_reached" | "usage.limit_warning"
  | "credit.issued" | "credit.consumed"
  | "payment.failed" | "payment.recovered";

export interface WebhookEndpoint {
  id: string;
  workspaceId: string;
  url: string;
  description?: string;
  events: WebhookEventType[];   // empty = listen to all
  secret: string;               // HMAC signing secret
  isActive: boolean;
  createdAt: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: WebhookEventType;
  payload: Record<string, any>;
  status: "delivered" | "failed" | "pending";
  httpStatus?: number;
  attempts: number;
  lastAttemptAt: string;
  createdAt: string;
}

// ── DB State ─────────────────────────────────────────────────

export interface DBState {
  organizations: Organization[];
  workspaces: Workspace[];
  members: Member[];
  products: Product[];
  features: Feature[];
  plans: Plan[];
  entitlements: Entitlement[];
  customers: Customer[];
  subscriptions: Subscription[];
  meters: MeterDefinition[];
  usageEvents: UsageEvent[];
  auditLogs: AuditLog[];
  quotas: Quota[];
  creditLedger: CreditLedgerEntry[];
  prices: Price[];
  rateCards: RateCard[];
  discounts: Discount[];
  coupons: Coupon[];
  customContracts: CustomContract[];
  webhooks: WebhookEndpoint[];
  webhookDeliveries: WebhookDelivery[];
}

// ── Shared API shapes ────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ApiError {
  error: string;
  code?: string;
  details?: Record<string, any>;
}
