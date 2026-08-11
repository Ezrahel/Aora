export interface Plan {
  id: string;
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
  status?: "active" | "draft" | "archived";
  pricingType?: "flat" | "per_seat" | "usage" | "hybrid";
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
  status: "paid" | "open" | "past_due" | "draft";
  pdfUrl?: string;
  usageUnits: number;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  gatewayInvoiceId?: string;
  gatewayHostedUrl?: string;
  gatewaySynced?: boolean;
}

export interface Customer {
  id: string;
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

export interface Entitlement {
  featureId: string;
  featureName: string;
  description: string;
  requiredPlanId: string;
  isEnabled: boolean;
}

export interface DashboardStats {
  baseMRR: number;
  overageMRR: number;
  mrr: number;
  arr: number;
  activeSubscriptions: number;
  trialConversionRate: number;
  churnRate: number;
  failedPaymentsCount: number;
  usageVolumeEvents: number;
  invoiceCollectionRate: number;
  growthTrendPercent: number;
  currencySymbol: string;
  historicalChartData: {
    date: string;
    baseMRR: number;
    overageMRR: number;
    total: number;
    subscriptions: number;
  }[];
  conversionFunnel: {
    stage: string;
    count: number;
  }[];
  planPerformance: {
    name: string;
    price: number;
    count: number;
    revenueShare: number;
  }[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "model" | "system";
  text: string;
  actionExecuted?: string | null;
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
  value: number; // e.g. 20 for 20%, 5000 for 5000 NGN
  appliesTo: "all" | "base_fee" | "overage" | "seat_fee";
  duration: "once" | "forever" | "repeating";
  durationMonths?: number;
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
  createdAt: string;
}

