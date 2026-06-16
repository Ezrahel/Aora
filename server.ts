import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "billing_db.json");

// ==========================================
// LAZY-LOADED GEMINI CLIENT SETUP
// ==========================================
let aiClient: GoogleGenAI | null = null;
function getAI() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn(
        "GEMINI_API_KEY is not defined. AI interactions will fallback to high-fidelity simulated responses.",
      );
      return null;
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// ==========================================
// DB DOMAIN SCHEMA INTERFACES (PHASE 1)
// ==========================================

export interface Organization {
  id: string;
  name: string;
  status: "active" | "suspended";
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  organizationId: string;
  name: string;
  environment: "production" | "sandbox" | "development";
  apiKeys: string[];
  createdAt: string;
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
  createdAt: string;
}

export interface Feature {
  id: string; // feature identifier e.g. "feature_api_access"
  workspaceId: string;
  slug: string; // e.g. "api_access"
  name: string;
  description: string;
  type: "boolean" | "limit";
  createdAt: string;
}

// Compatible with frontend layout but enriched for Phase 1
export interface Plan {
  id: string; // e.g. "free", "growth", "scale"
  productId: string;
  name: string;
  price: number; // base price (retains backward compatibility)
  currency: string;
  billingPeriod: "monthly" | "yearly";
  includedSeats: number;
  includedUsage: number;
  apiAccess: boolean;
  overageUnitPrice: number;
  description: string;
  code?: string;
  pricingType?: "flat" | "per_seat" | "usage" | "hybrid";
  createdAt: string;
}

// Core entitlement mapping plan-to-features
export interface Entitlement {
  id: string;
  planId: string;
  featureId: string;
  value: string | number | boolean;
  isEnabled: boolean; // active enforcing toggle
  createdAt: string;
}

// Client-friendly entitlement mapper
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
  status: "paid" | "open" | "past_due" | "draft";
  pdfUrl?: string;
  usageUnits: number;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
}

// Tenant isolated Customer model
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
}

export interface Subscription {
  id: string;
  customerId: string;
  planId: string;
  status: "active" | "trial" | "canceled" | "paused";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  seatQuantity: number;
  createdAt: string;
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
  type:
    | "credit_issued"
    | "credit_consumed"
    | "credit_expired"
    | "credit_reversed";
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

// Multi-tenant audit trail with states snapshot comparison
export interface AuditLog {
  id: string;
  workspaceId: string;
  actor: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "ACCESS_VERIFY" | "ADJUST";
  entityType:
    | "ORGANIZATION"
    | "WORKSPACE"
    | "MEMBER"
    | "PRODUCT"
    | "FEATURE"
    | "PLAN"
    | "ENTITLEMENT"
    | "CUSTOMER"
    | "SUBSCRIPTION"
    | "INVOICE"
    | "EVENT"
    | "METER"
    | "QUOTA"
    | "CREDIT"
    | "PRICE"
    | "RATE_CARD"
    | "DISCOUNT"
    | "COUPON"
    | "CONTRACT";
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
  type:
    | "flat"
    | "usage"
    | "seat"
    | "tiered"
    | "volume"
    | "package"
    | "hybrid"
    | "custom_contract";
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
  value: number;
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

// Absolute Multi-tenant backing store
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
}

let db: DBState = {
  organizations: [],
  workspaces: [],
  members: [],
  products: [],
  features: [],
  plans: [],
  entitlements: [],
  customers: [],
  subscriptions: [],
  meters: [],
  usageEvents: [],
  auditLogs: [],
  quotas: [],
  creditLedger: [],
  prices: [],
  rateCards: [],
  discounts: [],
  coupons: [],
  customContracts: [],
};

// Global in-memory chat message state
let chatMessageLog: {
  role: "user" | "model" | "system";
  text: string;
  id: string;
}[] = [
  {
    id: "chat_0",
    role: "system",
    text: "You are the Premium Billing Assistant, representing an operating system that operates precisely like Stripe, Paddle and lago combined.",
  },
];

// ==========================================
// DB PERSISTENCE MODULES
// ==========================================
function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
    console.log("Persistence ledger written successfully to:", DB_FILE);
  } catch (err) {
    console.error(
      "Critical: Failed to persist multi-tenant billing core to disk:",
      err,
    );
  }
}

function initDatabase() {
  if (fs.existsSync(DB_FILE)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
      // Ensure phase 2 structures are fully initialized
      if (!db.quotas) {
        db.quotas = [
          {
            id: "q_linear_compute_quota",
            customerId: "linear",
            meterId: "compute_meter",
            limitValue: 100000,
            usedValue: 48200,
            period: "monthly",
            createdAt: "2026-06-01T00:00:00Z",
          },
          {
            id: "q_linear_compute",
            customerId: "linear",
            meterId: "compute_meter",
            limitValue: 10000,
            usedValue: 2450,
            period: "monthly",
            createdAt: "2026-06-01T00:00:00Z",
          },
          {
            id: "q_vercel_api",
            customerId: "vercel",
            meterId: "api_meter",
            limitValue: 500000,
            usedValue: 198000,
            period: "monthly",
            createdAt: "2026-06-01T00:00:00Z",
          },
          {
            id: "q_retool_compute",
            customerId: "retool",
            meterId: "compute_meter",
            limitValue: 1000,
            usedValue: 420,
            period: "monthly",
            createdAt: "2026-06-01T00:00:00Z",
          },
          {
            id: "q_notion_compute",
            customerId: "notion",
            meterId: "compute_meter",
            limitValue: 75000,
            usedValue: 54000,
            period: "monthly",
            createdAt: "2026-06-01T00:00:00Z",
          },
          {
            id: "q_acme_compute",
            customerId: "acme",
            meterId: "compute_meter",
            limitValue: 300000,
            usedValue: 265000,
            period: "monthly",
            createdAt: "2026-06-01T00:00:00Z",
          },
        ];
      }
      if (!db.creditLedger) {
        db.creditLedger = [
          {
            id: "c_linear_grant",
            customerId: "linear",
            amount: 10000,
            type: "credit_issued",
            description: "Startup Program Welcome Credits",
            createdAt: "2026-06-01T00:00:00Z",
            expireAt: "2026-12-01T00:00:00Z",
          },
          {
            id: "c_linear_use_1",
            customerId: "linear",
            amount: -4500,
            type: "credit_consumed",
            description: "Compute Overage Auto Debt",
            createdAt: "2026-06-05T12:00:00Z",
          },
          {
            id: "c_vercel_grant",
            customerId: "vercel",
            amount: 25000,
            type: "credit_issued",
            description: "Enterprise Tier Partnership Grant",
            createdAt: "2026-06-01T00:00:00Z",
            expireAt: "2027-06-01T00:00:00Z",
          },
          {
            id: "c_retool_grant",
            customerId: "retool",
            amount: 500,
            type: "credit_issued",
            description: "Trial Period Promotion Balance",
            createdAt: "2026-06-01T08:00:00Z",
            expireAt: "2026-07-01T00:00:00Z",
          },
        ];
      }
      if (!db.prices || db.prices.length === 0) {
        db.prices = [
          {
            id: "pr_free_v1",
            planId: "free",
            name: "Starter Free v1",
            type: "flat",
            billingPeriod: "monthly",
            currency: "NGN",
            baseFee: 0,
            includedSeats: 2,
            includedUsage: 1000,
            overageUnitPrice: 0,
            meterId: "compute_meter",
            version: 1,
            isActive: true,
            createdAt: "2026-01-10T12:00:00Z",
          },
          {
            id: "pr_growth_v1",
            planId: "growth",
            name: "Growth Plan legacy v1",
            type: "hybrid",
            billingPeriod: "monthly",
            currency: "NGN",
            baseFee: 10000,
            seatPrice: 1000,
            includedSeats: 5,
            includedUsage: 30000,
            overageUnitPrice: 2.5,
            meterId: "compute_meter",
            version: 1,
            isActive: false,
            createdAt: "2026-01-10T12:00:00Z",
          },
          {
            id: "pr_growth_v2",
            planId: "growth",
            name: "Growth Scale v2",
            type: "hybrid",
            billingPeriod: "monthly",
            currency: "NGN",
            baseFee: 15000,
            seatPrice: 2000,
            includedSeats: 10,
            includedUsage: 50000,
            overageUnitPrice: 2.0,
            meterId: "compute_meter",
            version: 2,
            isActive: true,
            createdAt: "2026-05-01T00:00:00Z",
          },
          {
            id: "pr_scale_v1",
            planId: "scale",
            name: "AI Tokens scale v1",
            type: "hybrid",
            billingPeriod: "monthly",
            currency: "NGN",
            baseFee: 45000,
            seatPrice: 3000,
            includedSeats: 20,
            includedUsage: 200000,
            overageUnitPrice: 1.5,
            meterId: "compute_meter",
            version: 1,
            isActive: true,
            createdAt: "2026-01-10T12:00:00Z",
          },
        ];
      }
      if (!db.rateCards || db.rateCards.length === 0) {
        db.rateCards = [
          {
            id: "rc_compute_tiered",
            name: "Compute Tiered Rate Card",
            description:
              "Tiered pricing structure for high density compute management",
            meterId: "compute_meter",
            priceType: "tiered",
            currency: "NGN",
            tiers: [
              { upTo: 1000, unitPrice: 0 },
              { upTo: 10000, unitPrice: 2.0 },
              { upTo: 50000, unitPrice: 1.5 },
              { upTo: "infinity", unitPrice: 1.0 },
            ],
            isActive: true,
            createdAt: "2026-06-01T00:00:00Z",
          },
          {
            id: "rc_api_volume",
            name: "Developer API Calls Rate Card",
            description:
              "Volume-based model where total consumption sets the tier",
            meterId: "api_meter",
            priceType: "volume",
            currency: "USD",
            tiers: [
              { upTo: 50000, unitPrice: 0.05 },
              { upTo: 200000, unitPrice: 0.03 },
              { upTo: "infinity", unitPrice: 0.01 },
            ],
            isActive: true,
            createdAt: "2026-06-01T00:00:00Z",
          },
        ];
      }
      if (!db.discounts || db.discounts.length === 0) {
        db.discounts = [
          {
            id: "disc_summer20",
            name: "Summer Launch Special",
            type: "percentage",
            value: 20,
            appliesTo: "all",
            duration: "forever",
            createdAt: "2026-06-01T00:00:00Z",
          },
          {
            id: "disc_welcome5k",
            name: "Welcome Onboarding Credit",
            type: "fixed",
            value: 5000,
            appliesTo: "base_fee",
            duration: "once",
            createdAt: "2026-06-01T00:00:00Z",
          },
        ];
      }
      if (!db.coupons || db.coupons.length === 0) {
        db.coupons = [
          {
            id: "cp_summer20",
            name: "Summer Promo Code",
            discountId: "disc_summer20",
            code: "SUMMER20",
            isActive: true,
            timesRedeemed: 3,
            createdAt: "2026-06-01T00:00:00Z",
          },
          {
            id: "cp_welcome5k",
            name: "Welcome 5K Promo Code",
            discountId: "disc_welcome5k",
            code: "WELCOME5K",
            isActive: true,
            timesRedeemed: 1,
            createdAt: "2026-06-01T00:00:00Z",
          },
        ];
      }
      if (!db.customContracts || db.customContracts.length === 0) {
        db.customContracts = [
          {
            id: "cc_notion_ent",
            customerId: "notion",
            name: "Notion Enterprise Special",
            customBaseFee: 30000,
            customSeatPrice: 1200,
            customOverageUnitPrice: 1.0,
            minimumSpend: 50000,
            expireAt: "2027-06-01T00:00:00Z",
            createdAt: "2026-06-01T00:00:00Z",
          },
        ];
      }
      console.log(
        "Successfully retrieved multi-tenant billing system logs. Records active:",
        db.customers.length,
      );
      return;
    } catch (e) {
      console.error(
        "Error reading database ledger file. Rebuilding pristine sandbox defaults...",
        e,
      );
    }
  }

  // Baseline seeds
  const organizations: Organization[] = [
    {
      id: "org_aora",
      name: "Aora Technologies Group",
      status: "active",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    },
    {
      id: "org_acme",
      name: "Acme Holdings LLC",
      status: "active",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    },
  ];

  const workspaces: Workspace[] = [
    {
      id: "ws_aora",
      organizationId: "org_aora",
      name: "Aora Technologies Ltd",
      environment: "production",
      apiKeys: ["sk_live_aora_5f2d93e810cb9921e42f2bca01"],
      createdAt: "2025-01-10T12:00:00Z",
    },
    {
      id: "ws_sandbox",
      organizationId: "org_aora",
      name: "Sandbox Environment",
      environment: "sandbox",
      apiKeys: ["sk_test_aora_8812739178239a"],
      createdAt: "2025-01-12T12:00:00Z",
    },
    {
      id: "ws_acme",
      organizationId: "org_acme",
      name: "Acme Corporation Workspace",
      environment: "sandbox",
      apiKeys: ["sk_test_acme_8a2e1281cb9f0"],
      createdAt: "2025-01-15T12:00:00Z",
    },
  ];

  const members: Member[] = [
    {
      id: "mem_ademola",
      workspaceId: "ws_aora",
      email: "ademola@aora.co",
      role: "owner",
      permissions: ["*"],
      createdAt: "2025-01-10T12:00:00Z",
    },
    {
      id: "mem_sarah",
      workspaceId: "ws_aora",
      email: "sarah.jenkins@aora.co",
      role: "developer",
      permissions: ["read", "write_events"],
      createdAt: "2025-02-14T09:00:00Z",
    },
    {
      id: "mem_acme_owner",
      workspaceId: "ws_acme",
      email: "finance@acme.sh",
      role: "owner",
      permissions: ["*"],
      createdAt: "2025-01-15T12:00:00Z",
    },
  ];

  const products: Product[] = [
    {
      id: "prod_compute",
      workspaceId: "ws_aora",
      name: "Compute Processor Engine",
      description:
        "High-performance compute instances and general event analytics metrics tracking",
      createdAt: "2025-01-10T12:15:00Z",
    },
    {
      id: "prod_compute_sandbox",
      workspaceId: "ws_sandbox",
      name: "Compute Processor Engine",
      description: "Sandbox copy",
      createdAt: "2025-01-12T12:15:00Z",
    },
    {
      id: "prod_acme_metering",
      workspaceId: "ws_acme",
      name: "Acme Metering Core",
      description: "Core metering infrastructure for Acme",
      createdAt: "2025-01-15T12:15:00Z",
    },
  ];

  const features: Feature[] = [
    {
      id: "feature_api_access",
      workspaceId: "ws_aora",
      slug: "api_access",
      name: "API Integrations & SDK Access",
      description:
        "Allows developer tools access to query credentials programmatically.",
      type: "boolean",
      createdAt: "2024-11-20T00:00:00Z",
    },
    {
      id: "feature_custom_branding",
      workspaceId: "ws_aora",
      slug: "custom_branding",
      name: "Custom Branding & Whitelabel Invoice Logos",
      description:
        "Removes standard checkout watermarks and embeds custom logos into client dashboards.",
      type: "boolean",
      createdAt: "2024-11-20T00:00:00Z",
    },
    {
      id: "feature_dedicated_support",
      workspaceId: "ws_aora",
      slug: "dedicated_support",
      name: "Dedicated Enterprise Support Concierge",
      description:
        "Provides 15-minute SLA target windows and slack direct response channels.",
      type: "boolean",
      createdAt: "2024-11-20T00:00:00Z",
    },
    {
      id: "feature_sso_auth",
      workspaceId: "ws_aora",
      slug: "sso_auth",
      name: "Single Sign-On (SAML Auth)",
      description:
        "Allows enterprise user logs synchronized state credentials securely via Okta/Ping.",
      type: "boolean",
      createdAt: "2024-11-20T00:00:00Z",
    },
  ];

  const plans: Plan[] = [
    {
      id: "free",
      productId: "prod_compute",
      name: "Starter Free",
      description: "Ideal for micro projects & hobby experimentation.",
      code: "free",
      pricingType: "flat",
      billingPeriod: "monthly",
      currency: "NGN",
      price: 0,
      includedSeats: 2,
      includedUsage: 1000,
      overageUnitPrice: 0,
      apiAccess: false,
      createdAt: "2025-01-10T12:30:00Z",
    },
    {
      id: "growth",
      productId: "prod_compute",
      name: "Growth Scale",
      description:
        "The ideal plan for scaling startups requiring professional volume and API integration.",
      code: "growth",
      pricingType: "hybrid",
      billingPeriod: "monthly",
      currency: "NGN",
      price: 15000,
      includedSeats: 10,
      includedUsage: 50000,
      overageUnitPrice: 2,
      apiAccess: true,
      createdAt: "2025-01-10T12:30:00Z",
    },
    {
      id: "scale",
      productId: "prod_compute",
      name: "Enterprise Pro",
      description:
        "Robust structure for high-growth operations demanding generous allowances.",
      code: "scale",
      pricingType: "hybrid",
      billingPeriod: "monthly",
      currency: "NGN",
      price: 49000,
      includedSeats: 50,
      includedUsage: 250000,
      overageUnitPrice: 1.5,
      apiAccess: true,
      createdAt: "2025-01-10T12:30:00Z",
    },
  ];

  const entitlements: Entitlement[] = [
    {
      id: "ent_free_api",
      planId: "free",
      featureId: "feature_api_access",
      value: false,
      isEnabled: false,
      createdAt: "2025-01-10T12:30:00Z",
    },
    {
      id: "ent_free_brand",
      planId: "free",
      featureId: "feature_custom_branding",
      value: false,
      isEnabled: false,
      createdAt: "2025-01-10T12:30:00Z",
    },
    {
      id: "ent_free_support",
      planId: "free",
      featureId: "feature_dedicated_support",
      value: false,
      isEnabled: false,
      createdAt: "2025-01-10T12:30:00Z",
    },
    {
      id: "ent_free_sso",
      planId: "free",
      featureId: "feature_sso_auth",
      value: false,
      isEnabled: false,
      createdAt: "2025-01-10T12:30:00Z",
    },

    {
      id: "ent_growth_api",
      planId: "growth",
      featureId: "feature_api_access",
      value: true,
      isEnabled: true,
      createdAt: "2025-01-10T12:30:00Z",
    },
    {
      id: "ent_growth_brand",
      planId: "growth",
      featureId: "feature_custom_branding",
      value: false,
      isEnabled: true,
      createdAt: "2025-01-10T12:30:00Z",
    },
    {
      id: "ent_growth_support",
      planId: "growth",
      featureId: "feature_dedicated_support",
      value: false,
      isEnabled: false,
      createdAt: "2025-01-10T12:30:00Z",
    },
    {
      id: "ent_growth_sso",
      planId: "growth",
      featureId: "feature_sso_auth",
      value: false,
      isEnabled: false,
      createdAt: "2025-01-10T12:30:00Z",
    },

    {
      id: "ent_scale_api",
      planId: "scale",
      featureId: "feature_api_access",
      value: true,
      isEnabled: true,
      createdAt: "2025-01-10T12:30:00Z",
    },
    {
      id: "ent_scale_brand",
      planId: "scale",
      featureId: "feature_custom_branding",
      value: true,
      isEnabled: true,
      createdAt: "2025-01-10T12:30:00Z",
    },
    {
      id: "ent_scale_support",
      planId: "scale",
      featureId: "feature_dedicated_support",
      value: false,
      isEnabled: false,
      createdAt: "2025-01-10T12:30:00Z",
    },
    {
      id: "ent_scale_sso",
      planId: "scale",
      featureId: "feature_sso_auth",
      value: false,
      isEnabled: false,
      createdAt: "2025-01-10T12:30:00Z",
    },
  ];

  const customers: Customer[] = [
    {
      id: "linear",
      workspaceId: "ws_aora",
      name: "Linear Technology",
      domain: "linear.app",
      email: "billing@linear.app",
      logoColor: "bg-neutral-900 border-neutral-800 text-white",
      createdDate: "2025-02-14",
      planId: "growth",
      status: "active",
      seatsUsed: 8,
      usageUnits: 48200,
      paymentMethod: { brand: "Visa", last4: "4242", expiry: "12/28" },
      notes: [
        {
          id: "note_1",
          timestamp: "2026-05-10T14:30:00Z",
          text: "Customer completed automatic payment setup.",
          author: "System Server",
        },
        {
          id: "note_2",
          timestamp: "2026-06-01T09:00:00Z",
          text: "Requested inquiry regarding customized invoice timelines.",
          author: "Sarah Jenkins",
        },
      ],
      invoices: [
        {
          id: "INV-2026-005",
          amount: 15000,
          currency: "NGN",
          date: "2026-05-15",
          status: "paid",
          usageUnits: 41200,
        },
        {
          id: "INV-2026-004",
          amount: 15000,
          currency: "NGN",
          date: "2026-04-15",
          status: "paid",
          usageUnits: 38900,
        },
      ],
      contracts: [
        {
          title: "Standard Growth Service Agreement",
          status: "signed",
          value: "₦15,000 / mo",
        },
      ],
    },
    {
      id: "vercel",
      workspaceId: "ws_aora",
      name: "Vercel Inc",
      domain: "vercel.com",
      email: "billing@vercel.com",
      logoColor: "bg-black text-white",
      createdDate: "2024-11-20",
      planId: "scale",
      status: "active",
      seatsUsed: 12,
      usageUnits: 198000,
      paymentMethod: {
        brand: "American Express",
        last4: "0007",
        expiry: "11/29",
      },
      notes: [
        {
          id: "note_4",
          timestamp: "2026-05-20T11:00:00Z",
          text: "Enquired about direct ACH payments for high volume discounts.",
          author: "Alexander Vance",
        },
      ],
      invoices: [
        {
          id: "INV-2026-007",
          amount: 49000,
          currency: "NGN",
          date: "2026-05-25",
          status: "paid",
          usageUnits: 198000,
        },
        {
          id: "INV-2026-002",
          amount: 49000,
          currency: "NGN",
          date: "2026-04-25",
          status: "paid",
          usageUnits: 172000,
        },
      ],
      contracts: [],
    },
    {
      id: "retool",
      workspaceId: "ws_aora",
      name: "Retool Co",
      domain: "retool.com",
      email: "trial@retool.com",
      logoColor: "bg-rose-500 text-white",
      createdDate: "2026-06-01",
      planId: "free",
      status: "trial",
      seatsUsed: 1,
      usageUnits: 420,
      paymentMethod: null,
      notes: [
        {
          id: "note_5",
          timestamp: "2026-06-01T08:00:00Z",
          text: "Onboarded automatically onto Starter Free trial pack.",
          author: "System Autopilot",
        },
      ],
      invoices: [],
      contracts: [],
    },
    {
      id: "notion",
      workspaceId: "ws_sandbox",
      name: "Notion Enterprise",
      domain: "notion.so",
      email: "operations@notion.so",
      logoColor: "bg-amber-100 text-stone-900 border-stone-200",
      createdDate: "2025-05-01",
      planId: "growth",
      status: "active",
      seatsUsed: 14,
      usageUnits: 54000,
      paymentMethod: { brand: "Visa", last4: "1111", expiry: "06/30" },
      notes: [],
      invoices: [
        {
          id: "INV-2026-008",
          amount: 23000,
          currency: "NGN",
          date: "2026-05-01",
          status: "past_due",
          usageUnits: 54000,
        },
      ],
      contracts: [],
    },
    {
      id: "acme",
      workspaceId: "ws_acme",
      name: "Acme Corporation",
      domain: "acme.sh",
      email: "finance@acme.sh",
      logoColor: "bg-blue-600 text-white",
      createdDate: "2025-01-10",
      planId: "scale",
      status: "active",
      seatsUsed: 42,
      usageUnits: 265000,
      paymentMethod: { brand: "Mastercard", last4: "8821", expiry: "09/27" },
      notes: [
        {
          id: "note_3",
          timestamp: "2026-06-02T16:00:00Z",
          text: "Upgraded automatically to scale plan to handle increased incoming telemetry flows.",
          author: "Engine Auto",
        },
      ],
      invoices: [
        {
          id: "INV-2026-006",
          amount: 71500,
          currency: "NGN",
          date: "2026-05-10",
          status: "paid",
          usageUnits: 265000,
        },
        {
          id: "INV-2026-003",
          amount: 49000,
          currency: "NGN",
          date: "2026-04-10",
          status: "paid",
          usageUnits: 232000,
        },
      ],
      contracts: [
        {
          title: "Enterprise Service Level SLA",
          status: "signed",
          value: "₦49,000 / mo",
        },
      ],
    },
  ];

  const subscriptions: Subscription[] = [
    {
      id: "sub_1",
      customerId: "linear",
      planId: "growth",
      status: "active",
      currentPeriodStart: "2026-06-15T00:00:00Z",
      currentPeriodEnd: "2026-07-15T00:00:00Z",
      seatQuantity: 8,
      createdAt: "2025-02-14T00:00:00Z",
    },
    {
      id: "sub_2",
      customerId: "vercel",
      planId: "scale",
      status: "active",
      currentPeriodStart: "2026-06-25T00:00:00Z",
      currentPeriodEnd: "2026-07-25T00:00:00Z",
      seatQuantity: 12,
      createdAt: "2024-11-20T00:00:00Z",
    },
    {
      id: "sub_3",
      customerId: "retool",
      planId: "free",
      status: "trial",
      currentPeriodStart: "2026-06-01T00:00:00Z",
      currentPeriodEnd: "2026-07-01T00:00:00Z",
      seatQuantity: 1,
      createdAt: "2026-06-01T08:00:00Z",
    },
    {
      id: "sub_4",
      customerId: "notion",
      planId: "growth",
      status: "active",
      currentPeriodStart: "2026-06-01T00:00:00Z",
      currentPeriodEnd: "2026-07-01T00:00:00Z",
      seatQuantity: 14,
      createdAt: "2025-05-01T00:00:00Z",
    },
    {
      id: "sub_5",
      customerId: "acme",
      planId: "scale",
      status: "active",
      currentPeriodStart: "2026-06-10T00:00:00Z",
      currentPeriodEnd: "2026-07-10T00:00:00Z",
      seatQuantity: 42,
      createdAt: "2025-01-10T00:00:00Z",
    },
  ];

  const meters: MeterDefinition[] = [
    {
      id: "compute_meter",
      name: "Compute Server Usage",
      description:
        "Sum of analytical execution metrics measured in compute units.",
      aggregationType: "sum",
      targetField: "compute_units",
    },
    {
      id: "api_meter",
      name: "API Operations Meter",
      description:
        "Aggregates absolute volume of custom rest endpoint triggers.",
      aggregationType: "count",
      targetField: "calls",
    },
  ];

  const usageEvents: UsageEvent[] = [
    {
      id: "evt_1",
      customerId: "linear",
      meterId: "compute_meter",
      timestamp: "2026-06-14T22:30:00Z",
      value: 450,
      metadata: { source: "background_worker", task: "analytics_aggregation" },
    },
    {
      id: "evt_2",
      customerId: "acme",
      meterId: "compute_meter",
      timestamp: "2026-06-15T02:15:00Z",
      value: 1200,
      metadata: { source: "serverless_function" },
    },
    {
      id: "evt_3",
      customerId: "vercel",
      meterId: "api_meter",
      timestamp: "2026-06-15T01:00:00Z",
      value: 1,
      metadata: { endpoint: "/v2/deploy" },
    },
    {
      id: "evt_4",
      customerId: "notion",
      meterId: "compute_meter",
      timestamp: "2026-06-15T03:00:00Z",
      value: 80,
      metadata: { source: "data_ingest" },
    },
  ];

  const auditLogs: AuditLog[] = [
    {
      id: "aud_init",
      workspaceId: "ws_aora",
      actor: "Ademola Olushola",
      action: "CREATE",
      entityType: "WORKSPACE",
      entityId: "ws_aora",
      beforeState: null,
      afterState: { name: "Aora Technologies Ltd", environment: "production" },
      createdAt: "2025-01-10T12:00:00Z",
    },
    {
      id: "aud_init_plan",
      workspaceId: "ws_aora",
      actor: "Ademola Olushola",
      action: "CREATE",
      entityType: "PLAN",
      entityId: "growth",
      beforeState: null,
      afterState: { name: "Growth Scale", price: 15000, code: "growth" },
      createdAt: "2025-01-10T12:35:00Z",
    },
  ];

  const quotas: Quota[] = [
    {
      id: "q_linear_compute_quota",
      customerId: "linear",
      meterId: "compute_meter",
      limitValue: 100000,
      usedValue: 48200,
      period: "monthly",
      createdAt: "2026-06-01T00:00:00Z",
    },
    {
      id: "q_linear_compute",
      customerId: "linear",
      meterId: "compute_meter",
      limitValue: 10000,
      usedValue: 2450,
      period: "monthly",
      createdAt: "2026-06-01T00:00:00Z",
    },
    {
      id: "q_vercel_api",
      customerId: "vercel",
      meterId: "api_meter",
      limitValue: 500000,
      usedValue: 198000,
      period: "monthly",
      createdAt: "2026-06-01T00:00:00Z",
    },
    {
      id: "q_retool_compute",
      customerId: "retool",
      meterId: "compute_meter",
      limitValue: 1000,
      usedValue: 420,
      period: "monthly",
      createdAt: "2026-06-01T00:00:00Z",
    },
    {
      id: "q_notion_compute",
      customerId: "notion",
      meterId: "compute_meter",
      limitValue: 75000,
      usedValue: 54000,
      period: "monthly",
      createdAt: "2026-06-01T00:00:00Z",
    },
    {
      id: "q_acme_compute",
      customerId: "acme",
      meterId: "compute_meter",
      limitValue: 300000,
      usedValue: 265000,
      period: "monthly",
      createdAt: "2026-06-01T00:00:00Z",
    },
  ];

  const creditLedger: CreditLedgerEntry[] = [
    {
      id: "c_linear_grant",
      customerId: "linear",
      amount: 10000,
      type: "credit_issued",
      description: "Startup Program Welcome Credits",
      createdAt: "2026-06-01T00:00:00Z",
      expireAt: "2026-12-01T00:00:00Z",
    },
    {
      id: "c_linear_use_1",
      customerId: "linear",
      amount: -4500,
      type: "credit_consumed",
      description: "Compute Overage Auto Debt",
      createdAt: "2026-06-05T12:00:00Z",
    },
    {
      id: "c_vercel_grant",
      customerId: "vercel",
      amount: 25000,
      type: "credit_issued",
      description: "Enterprise Tier Partnership Grant",
      createdAt: "2026-06-01T00:00:00Z",
      expireAt: "2027-06-01T00:00:00Z",
    },
    {
      id: "c_retool_grant",
      customerId: "retool",
      amount: 500,
      type: "credit_issued",
      description: "Trial Period Promotion Balance",
      createdAt: "2026-06-01T08:00:00Z",
      expireAt: "2026-07-01T00:00:00Z",
    },
  ];

  const seedPrices: Price[] = [
    {
      id: "pr_free_v1",
      planId: "free",
      name: "Starter Free v1",
      type: "flat",
      billingPeriod: "monthly",
      currency: "NGN",
      baseFee: 0,
      includedSeats: 2,
      includedUsage: 1000,
      overageUnitPrice: 0,
      meterId: "compute_meter",
      version: 1,
      isActive: true,
      createdAt: "2026-01-10T12:00:00Z",
    },
    {
      id: "pr_growth_v1",
      planId: "growth",
      name: "Growth Plan legacy v1",
      type: "hybrid",
      billingPeriod: "monthly",
      currency: "NGN",
      baseFee: 10000,
      seatPrice: 1000,
      includedSeats: 5,
      includedUsage: 30000,
      overageUnitPrice: 2.5,
      meterId: "compute_meter",
      version: 1,
      isActive: false,
      createdAt: "2026-01-10T12:00:00Z",
    },
    {
      id: "pr_growth_v2",
      planId: "growth",
      name: "Growth Scale v2",
      type: "hybrid",
      billingPeriod: "monthly",
      currency: "NGN",
      baseFee: 15000,
      seatPrice: 2000,
      includedSeats: 10,
      includedUsage: 50000,
      overageUnitPrice: 2.0,
      meterId: "compute_meter",
      version: 2,
      isActive: true,
      createdAt: "2026-05-01T00:00:00Z",
    },
    {
      id: "pr_scale_v1",
      planId: "scale",
      name: "AI Tokens scale v1",
      type: "hybrid",
      billingPeriod: "monthly",
      currency: "NGN",
      baseFee: 45000,
      seatPrice: 3000,
      includedSeats: 20,
      includedUsage: 200000,
      overageUnitPrice: 1.5,
      meterId: "compute_meter",
      version: 1,
      isActive: true,
      createdAt: "2026-01-10T12:00:00Z",
    },
  ];

  const seedRateCards: RateCard[] = [
    {
      id: "rc_compute_tiered",
      name: "Compute Tiered Rate Card",
      description:
        "Tiered pricing structure for high density compute management",
      meterId: "compute_meter",
      priceType: "tiered",
      currency: "NGN",
      tiers: [
        { upTo: 1000, unitPrice: 0 },
        { upTo: 10000, unitPrice: 2.0 },
        { upTo: 50000, unitPrice: 1.5 },
        { upTo: "infinity", unitPrice: 1.0 },
      ],
      isActive: true,
      createdAt: "2026-06-01T00:00:00Z",
    },
    {
      id: "rc_api_volume",
      name: "Developer API Calls Rate Card",
      description: "Volume-based model where total consumption sets the tier",
      meterId: "api_meter",
      priceType: "volume",
      currency: "USD",
      tiers: [
        { upTo: 50000, unitPrice: 0.05 },
        { upTo: 200000, unitPrice: 0.03 },
        { upTo: "infinity", unitPrice: 0.01 },
      ],
      isActive: true,
      createdAt: "2026-06-01T00:00:00Z",
    },
  ];

  const seedDiscounts: Discount[] = [
    {
      id: "disc_summer20",
      name: "Summer Launch Special",
      type: "percentage",
      value: 20,
      appliesTo: "all",
      duration: "forever",
      createdAt: "2026-06-01T00:00:00Z",
    },
    {
      id: "disc_welcome5k",
      name: "Welcome Onboarding Credit",
      type: "fixed",
      value: 5000,
      appliesTo: "base_fee",
      duration: "once",
      createdAt: "2026-06-01T00:00:00Z",
    },
  ];

  const seedCoupons: Coupon[] = [
    {
      id: "cp_summer20",
      name: "Summer Promo Code",
      discountId: "disc_summer20",
      code: "SUMMER20",
      isActive: true,
      timesRedeemed: 3,
      createdAt: "2026-06-01T00:00:00Z",
    },
    {
      id: "cp_welcome5k",
      name: "Welcome 5K Promo Code",
      discountId: "disc_welcome5k",
      code: "WELCOME5K",
      isActive: true,
      timesRedeemed: 1,
      createdAt: "2026-06-01T00:00:00Z",
    },
  ];

  const seedCustomContracts: CustomContract[] = [
    {
      id: "cc_notion_ent",
      customerId: "notion",
      name: "Notion Enterprise Special",
      customBaseFee: 30000,
      customSeatPrice: 1200,
      customOverageUnitPrice: 1.0,
      minimumSpend: 50000,
      expireAt: "2027-06-01T00:00:00Z",
      createdAt: "2026-06-01T00:00:00Z",
    },
  ];

  db = {
    organizations,
    workspaces,
    members,
    products,
    features,
    plans,
    entitlements,
    customers,
    subscriptions,
    meters,
    usageEvents,
    auditLogs,
    quotas,
    creditLedger,
    prices: seedPrices,
    rateCards: seedRateCards,
    discounts: seedDiscounts,
    coupons: seedCoupons,
    customContracts: seedCustomContracts,
  };

  saveDatabase();
}

// Write high-fidelity compliance Audit history capturing states
function writeAuditLog(
  workspaceId: string,
  actor: string,
  action: "CREATE" | "UPDATE" | "DELETE" | "ACCESS_VERIFY" | "ADJUST",
  entityType: any,
  entityId: string,
  before: any,
  after: any,
) {
  const newLog: AuditLog = {
    id: "aud_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    workspaceId,
    actor: actor || "Ademola Olushola",
    action,
    entityType,
    entityId,
    beforeState: before ? JSON.parse(JSON.stringify(before)) : null,
    afterState: after ? JSON.parse(JSON.stringify(after)) : null,
    createdAt: new Date().toISOString(),
  };
  db.auditLogs.unshift(newLog);
  saveDatabase();
}

// Resolve Tenant isolating Workspace ID from the header, parameters or query string
function resolveWorkspace(req: express.Request): Workspace {
  const wsQuery = req.query.workspace as string;
  if (wsQuery) {
    const matched = db.workspaces.find(
      (w) =>
        w.id === wsQuery ||
        w.name.toLowerCase() === wsQuery.toLowerCase() ||
        wsQuery.toLowerCase().includes(w.name.toLowerCase()),
    );
    if (matched) return matched;
  }
  // absolute defaults (Aora Technologies Production)
  return db.workspaces[0];
}

// Trigger initial ledger mapping
initDatabase();

// ==========================================
// API REST ENDPOINTS WITH TENANCY INTEGRITY
// ==========================================

// GET ALL REGISTRANT WORKSPACES (Dropdown Switcher helper metadata)
app.get("/api/workspaces", (req, res) => {
  res.json(db.workspaces);
});

// GET COMPLIANCE AUDIT TRAILS EXPOSED FOR METRICS VISUALIZERS
app.get("/api/audit-logs", (req, res) => {
  const ws = resolveWorkspace(req);
  const filtered = db.auditLogs.filter((log) => log.workspaceId === ws.id);
  res.json(filtered);
});

// GET LIVE WORKSPACE INFORMATION PROFILE ENRICHMENTS
app.get("/api/workspace-info", (req, res) => {
  const ws = resolveWorkspace(req);
  const activeMembers = db.members.filter((m) => m.workspaceId === ws.id);
  const org = db.organizations.find((o) => o.id === ws.organizationId);
  res.json({
    workspace: ws,
    organization: org || null,
    members: activeMembers,
    telemetryStatus: "Operational",
    tenantId: ws.id,
    environmentMode: ws.environment,
    apiIssued: ws.apiKeys,
  });
});

// 1. Get Stats and Revenue Metrics (Multi-tenant calculation!)
app.get("/api/revenue-metrics", (req, res) => {
  const ws = resolveWorkspace(req);

  // Filter registered customers by active tenant
  const tenantCustomers = db.customers.filter((c) => c.workspaceId === ws.id);

  const activeSubs = tenantCustomers.filter(
    (c) => c.status === "active",
  ).length;
  const trialCount = tenantCustomers.filter((c) => c.status === "trial").length;

  let calculatedMRR = 0;
  let usageOverageRevenue = 0;

  tenantCustomers.forEach((cust) => {
    if (cust.status === "active") {
      const plan = db.plans.find((p) => p.id === cust.planId);
      if (plan) {
        calculatedMRR += plan.price;
        const delta = cust.usageUnits - plan.includedUsage;
        if (delta > 0 && plan.overageUnitPrice > 0) {
          usageOverageRevenue += delta * plan.overageUnitPrice;
        }
      }
    }
  });

  const totalMRR = calculatedMRR + usageOverageRevenue;

  // Isolate telemetry volume events belonging to this tenant's customers too
  const customerIds = new Set(tenantCustomers.map((c) => c.id));
  const tenantEvents = db.usageEvents.filter((evt) =>
    customerIds.has(evt.customerId),
  );

  // Determine standard static parameters mapped cleanly
  const currencySymbol =
    ws.name.includes("Aora") || ws.name.includes("Acme") ? "₦" : "$";

  res.json({
    baseMRR: calculatedMRR,
    overageMRR: usageOverageRevenue,
    mrr: totalMRR,
    arr: totalMRR * 12,
    activeSubscriptions: activeSubs,
    trialConversionRate:
      tenantCustomers.length > 0
        ? Number(((activeSubs / tenantCustomers.length) * 100).toFixed(1))
        : 75.0,
    churnRate: ws.environment === "production" ? 1.4 : 0.0,
    failedPaymentsCount: tenantCustomers.some((c) =>
      c.invoices.some((i) => i.status === "past_due"),
    )
      ? 1
      : 0,
    usageVolumeEvents:
      tenantEvents.length + (ws.environment === "production" ? 348220 : 1240),
    invoiceCollectionRate: 98.4,
    growthTrendPercent: 14.8,
    currencySymbol,
    historicalChartData: [
      {
        date: "Jan 15",
        baseMRR: calculatedMRR * 0.7,
        overageMRR: usageOverageRevenue * 0.6,
        total: calculatedMRR * 0.7 + usageOverageRevenue * 0.6,
        subscriptions: Math.max(1, activeSubs - 2),
      },
      {
        date: "Feb 15",
        baseMRR: calculatedMRR * 0.8,
        overageMRR: usageOverageRevenue * 0.7,
        total: calculatedMRR * 0.8 + usageOverageRevenue * 0.7,
        subscriptions: Math.max(1, activeSubs - 1),
      },
      {
        date: "Mar 15",
        baseMRR: calculatedMRR * 0.9,
        overageMRR: usageOverageRevenue * 0.9,
        total: calculatedMRR * 0.9 + usageOverageRevenue * 0.9,
        subscriptions: activeSubs,
      },
      {
        date: "Jun 15 (Present)",
        baseMRR: calculatedMRR,
        overageMRR: usageOverageRevenue,
        total: totalMRR,
        subscriptions: activeSubs,
      },
    ],
    conversionFunnel: [
      {
        stage: "Platform Visits",
        count: ws.environment === "production" ? 850020 : 12400,
      },
      {
        stage: "Trial Onboarding",
        count: ws.environment === "production" ? 12400 : 850,
      },
      {
        stage: "Active Usage Trigger",
        count: ws.environment === "production" ? 9800 : 700,
      },
      {
        stage: "Paying Conversions",
        count: ws.environment === "production" ? 4850 : 420,
      },
    ],
    planPerformance: db.plans.map((p) => {
      const usersCount = tenantCustomers.filter(
        (c) => c.planId === p.id,
      ).length;
      return {
        name: p.name,
        price: p.price,
        count: usersCount,
        revenueShare: usersCount * p.price,
      };
    }),
  });
});

// 2. Pricing Plans Endpoints
app.get("/api/plans", (req, res) => {
  // Plans are global template models or associated with products
  res.json(db.plans);
});

app.post("/api/plans", (req, res) => {
  const ws = resolveWorkspace(req);
  const {
    name,
    price,
    currency,
    billingPeriod,
    includedSeats,
    includedUsage,
    apiAccess,
    overageUnitPrice,
    description,
  } = req.body;
  if (!name) {
    return res.status(400).json({ error: "Name is a required field." });
  }

  const generatedId = name.toLowerCase().replace(/[^a-z0-9]/g, "-");
  const newPlan: Plan = {
    id: generatedId,
    productId: "prod_compute",
    name,
    price: Number(price) || 0,
    currency: currency || "NGN",
    billingPeriod: billingPeriod || "monthly",
    includedSeats: Number(includedSeats) || 0,
    includedUsage: Number(includedUsage) || 0,
    apiAccess: !!apiAccess,
    overageUnitPrice: Number(overageUnitPrice) || 0,
    description: description || "",
    createdAt: new Date().toISOString(),
  };

  db.plans.push(newPlan);

  // Generate corresponding entitlements for this newly registered plan dynamically
  const planEntitlements = db.features.map((feat) => {
    return {
      id: `ent_${generatedId}_${feat.slug}`,
      planId: generatedId,
      featureId: feat.id,
      value: feat.slug === "api_access" ? !!apiAccess : false,
      isEnabled: true,
      createdAt: new Date().toISOString(),
    };
  });

  db.entitlements.push(...planEntitlements);

  // compliance Auditing entry
  writeAuditLog(
    ws.id,
    "Ademola Olushola",
    "CREATE",
    "PLAN",
    newPlan.id,
    null,
    newPlan,
  );

  res.status(201).json(newPlan);
});

// 3. Customers Endpoints
app.get("/api/customers", (req, res) => {
  const ws = resolveWorkspace(req);
  const filtered = db.customers.filter((c) => c.workspaceId === ws.id);
  res.json(filtered);
});

app.post("/api/customers", (req, res) => {
  const ws = resolveWorkspace(req);
  const { name, domain, email, planId } = req.body;
  if (!name || !email) {
    return res
      .status(400)
      .json({ error: "Name and Email are required fields." });
  }

  const newCustId =
    name.toLowerCase().replace(/[^a-z0-9]/g, "-") +
    "_" +
    Math.floor(Math.random() * 100);
  const newCustomer: Customer = {
    id: newCustId,
    workspaceId: ws.id,
    name,
    domain: domain || `${name.toLowerCase().replace(/\s+/g, "")}.com`,
    email,
    logoColor: "bg-neutral-100 text-neutral-800 border-neutral-300",
    createdDate: new Date().toISOString().split("T")[0],
    planId: planId || "free",
    status: "trial",
    paymentMethod: null,
    seatsUsed: 1,
    usageUnits: 0,
    notes: [
      {
        id: "note_" + Date.now(),
        timestamp: new Date().toISOString(),
        text: `Customer workspace created on the multi-tenant operating platform under workspace: ${ws.name}`,
        author: "System Administrator",
      },
    ],
    invoices: [],
    contracts: [],
  };

  db.customers.push(newCustomer);

  // Seed associated basic subscription record as per domain architecture
  const newSub: Subscription = {
    id: "sub_" + Date.now(),
    customerId: newCustId,
    planId: planId || "free",
    status: "trial",
    currentPeriodStart: new Date().toISOString(),
    currentPeriodEnd: new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    seatQuantity: 1,
    createdAt: new Date().toISOString(),
  };
  db.subscriptions.push(newSub);

  // Auditing compliance
  writeAuditLog(
    ws.id,
    "Ademola Olushola",
    "CREATE",
    "CUSTOMER",
    newCustomer.id,
    null,
    newCustomer,
  );

  res.status(201).json(newCustomer);
});

// Customer note trigger endpoint
app.post("/api/customers/:id/notes", (req, res) => {
  const { id } = req.params;
  const { text, author } = req.body;
  const customer = db.customers.find((c) => c.id === id);
  if (!customer) {
    return res.status(404).json({ error: "Customer not found." });
  }

  const beforeState = JSON.parse(JSON.stringify(customer));
  const newNote: CustomerNote = {
    id: "note_" + Date.now(),
    timestamp: new Date().toISOString(),
    text: text || "",
    author: author || "Staff Specialist",
  };
  customer.notes.unshift(newNote);

  // Audit change
  writeAuditLog(
    customer.workspaceId,
    author || "System Specialist",
    "UPDATE",
    "CUSTOMER",
    customer.id,
    beforeState,
    customer,
  );

  res.status(201).json(customer);
});

// Adjust customer plan
app.post("/api/customers/:id/adjustPlan", (req, res) => {
  const { id } = req.params;
  const { planId, status } = req.body;
  const customer = db.customers.find((c) => c.id === id);
  if (!customer) {
    return res.status(404).json({ error: "Customer not found" });
  }

  const beforeState = JSON.parse(JSON.stringify(customer));

  if (planId) {
    customer.planId = planId;
    customer.notes.unshift({
      id: "note_" + Date.now(),
      timestamp: new Date().toISOString(),
      text: `Customer plan modified to: ${planId} on user plan adjust control.`,
      author: "Admin Control",
    });

    // Sync active subscription index if exists
    const sub = db.subscriptions.find((s) => s.customerId === id);
    if (sub) {
      sub.planId = planId;
      sub.status = status || "active";
    }
  }
  if (status) {
    customer.status = status;
  }

  writeAuditLog(
    customer.workspaceId,
    "Ademola Olushola",
    "ADJUST",
    "CUSTOMER",
    customer.id,
    beforeState,
    customer,
  );

  res.json(customer);
});

// 4. Usage Metering Endpoints
app.get("/api/meters", (req, res) => {
  res.json(db.meters);
});

app.post("/api/meters", (req, res) => {
  const ws = resolveWorkspace(req);
  const { name, description, aggregationType, targetField } = req.body;
  const newMeter: MeterDefinition = {
    id: name.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_meter",
    name,
    description,
    aggregationType: aggregationType || "sum",
    targetField: targetField || "value",
  };

  db.meters.push(newMeter);

  writeAuditLog(
    ws.id,
    "Ademola Olushola",
    "CREATE",
    "FEATURE", // meters qualify as metering features
    newMeter.id,
    null,
    newMeter,
  );

  res.status(201).json(newMeter);
});

app.get("/api/usage-events", (req, res) => {
  const ws = resolveWorkspace(req);
  // Filter events belonging to customers in this active workspace
  const tenantCustIds = new Set(
    db.customers.filter((c) => c.workspaceId === ws.id).map((c) => c.id),
  );
  const filtered = db.usageEvents.filter((evt) =>
    tenantCustIds.has(evt.customerId),
  );
  res.json(filtered);
});

app.post("/api/usage-events", (req, res) => {
  const ws = resolveWorkspace(req);
  const { customerId, meterId, value, metadata } = req.body;
  const targetCust = db.customers.find((c) => c.id === customerId);
  if (!targetCust) {
    return res.status(404).json({ error: "Customer not found." });
  }

  const beforeCustomer = JSON.parse(JSON.stringify(targetCust));

  const newEvt: UsageEvent = {
    id: "evt_" + Date.now(),
    customerId,
    meterId: meterId || "compute_meter",
    timestamp: new Date().toISOString(),
    value: Number(value) || 1,
    metadata: metadata || {},
  };

  db.usageEvents.unshift(newEvt);

  // Accumulate usage dynamically on target customer if it's the leading meter
  if (newEvt.meterId === "compute_meter") {
    targetCust.usageUnits += newEvt.value;
  }

  saveDatabase();

  writeAuditLog(
    ws.id,
    "API Trigger Gateway",
    "CREATE",
    "EVENT",
    newEvt.id,
    null,
    {
      event: newEvt,
      customerBefore: beforeCustomer,
      customerAfter: targetCust,
    },
  );

  res.status(201).json(newEvt);
});

// --- Phase 2: Complete Metering, Quotas & Credits APIs ---

// GET /api/quotas
app.get("/api/quotas", (req, res) => {
  const ws = resolveWorkspace(req);
  const tenantCustIds = new Set(
    db.customers.filter((c) => c.workspaceId === ws.id).map((c) => c.id),
  );
  const filteredQuotas = db.quotas.filter((q) =>
    tenantCustIds.has(q.customerId),
  );
  res.json(filteredQuotas);
});

// POST /api/quotas
app.post("/api/quotas", (req, res) => {
  const ws = resolveWorkspace(req);
  const { customerId, meterId, limitValue, period } = req.body;

  const customer = db.customers.find((c) => c.id === customerId);
  if (!customer) {
    return res.status(404).json({ error: "Customer not found." });
  }

  const existingIdx = db.quotas.findIndex(
    (q) => q.customerId === customerId && q.meterId === meterId,
  );
  const beforeState =
    existingIdx > -1
      ? JSON.parse(JSON.stringify(db.quotas[existingIdx]))
      : null;

  const newQuota: Quota = {
    id:
      existingIdx > -1
        ? db.quotas[existingIdx].id
        : "q_" + customerId + "_" + meterId,
    customerId,
    meterId,
    limitValue: Number(limitValue) || 10000,
    usedValue: existingIdx > -1 ? db.quotas[existingIdx].usedValue : 0,
    period: period || "monthly",
    createdAt:
      existingIdx > -1
        ? db.quotas[existingIdx].createdAt
        : new Date().toISOString(),
  };

  if (existingIdx > -1) {
    db.quotas[existingIdx] = newQuota;
  } else {
    db.quotas.push(newQuota);
  }

  saveDatabase();

  writeAuditLog(
    ws.id,
    "Ademola Olushola",
    existingIdx > -1 ? "UPDATE" : "CREATE",
    "QUOTA",
    newQuota.id,
    beforeState,
    newQuota,
  );

  res.status(201).json(newQuota);
});

// GET /api/credits/ledger
app.get("/api/credits/ledger", (req, res) => {
  const ws = resolveWorkspace(req);
  const tenantCustIds = new Set(
    db.customers.filter((c) => c.workspaceId === ws.id).map((c) => c.id),
  );
  const filteredLedger = db.creditLedger.filter((c) =>
    tenantCustIds.has(c.customerId),
  );
  res.json(filteredLedger);
});

// POST /api/credits/ledger
app.post("/api/credits/ledger", (req, res) => {
  const ws = resolveWorkspace(req);
  const { customerId, amount, type, description, expireAt } = req.body;

  const customer = db.customers.find((c) => c.id === customerId);
  if (!customer) {
    return res.status(404).json({ error: "Customer not found." });
  }

  const entry: CreditLedgerEntry = {
    id: "c_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    customerId,
    amount: Number(amount) || 0,
    type: type || "credit_issued",
    description: description || "Adjustment Transaction",
    createdAt: new Date().toISOString(),
    expireAt: expireAt || undefined,
  };

  db.creditLedger.push(entry);
  saveDatabase();

  writeAuditLog(
    ws.id,
    "Ademola Olushola",
    "CREATE",
    "CREDIT",
    entry.id,
    null,
    entry,
  );

  res.status(201).json(entry);
});

// POST /api/events/bulk
app.post("/api/events/bulk", (req, res) => {
  const ws = resolveWorkspace(req);
  const eventsArray = req.body;
  if (!Array.isArray(eventsArray)) {
    return res
      .status(400)
      .json({ error: "Expected an array of usage events." });
  }

  const results: any[] = [];
  let duplicates = 0;

  for (const item of eventsArray) {
    const { customerId, meterId, value, metadata } = item;
    const targetCust = db.customers.find((c) => c.id === customerId);
    if (!targetCust) continue;

    const dedupeId = metadata?.idempotencyKey || metadata?.dedupeId;
    if (dedupeId) {
      const isDuplicated = db.usageEvents.some(
        (e) =>
          e.metadata?.idempotencyKey === dedupeId ||
          e.metadata?.dedupeId === dedupeId,
      );
      if (isDuplicated) {
        duplicates++;
        continue;
      }
    }

    const newEvt: UsageEvent = {
      id: "evt_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      customerId,
      meterId: meterId || "compute_meter",
      timestamp: item.timestamp || new Date().toISOString(),
      value: Number(value) || 1,
      metadata: metadata || {},
    };

    db.usageEvents.unshift(newEvt);

    if (newEvt.meterId === "compute_meter") {
      targetCust.usageUnits += newEvt.value;
    }

    // Accumulate under Quota if exists
    const quota = db.quotas.find(
      (q) => q.customerId === customerId && q.meterId === newEvt.meterId,
    );
    if (quota) {
      quota.usedValue += newEvt.value;
    }

    results.push(newEvt);
  }

  saveDatabase();

  if (results.length > 0) {
    writeAuditLog(
      ws.id,
      "Bulk REST Ingest Gateway",
      "CREATE",
      "EVENT",
      "bulk_" + Date.now(),
      null,
      { count: results.length, duplicates },
    );
  }

  res.json({ status: "processed", processedCount: results.length, duplicates });
});

// POST /api/events/import
app.post("/api/events/import", (req, res) => {
  const ws = resolveWorkspace(req);
  const eventsArray = req.body;
  if (!Array.isArray(eventsArray)) {
    return res
      .status(400)
      .json({ error: "Expected an array of usage events for import." });
  }

  let importedCount = 0;
  for (const item of eventsArray) {
    const { customerId, meterId, value, timestamp, metadata } = item;
    const targetCust = db.customers.find((c) => c.id === customerId);
    if (!targetCust) continue;

    const newEvt: UsageEvent = {
      id: "evt_import_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      customerId,
      meterId: meterId || "compute_meter",
      timestamp: timestamp || new Date().toISOString(),
      value: Number(value) || 1,
      metadata: { ...metadata, imported: true },
    };

    db.usageEvents.push(newEvt); // append at end for historic

    if (newEvt.meterId === "compute_meter") {
      targetCust.usageUnits += newEvt.value;
    }

    const quota = db.quotas.find(
      (q) => q.customerId === customerId && q.meterId === newEvt.meterId,
    );
    if (quota) {
      quota.usedValue += newEvt.value;
    }

    importedCount++;
  }

  saveDatabase();

  writeAuditLog(
    ws.id,
    "Imports Ingestion Engine",
    "CREATE",
    "EVENT",
    "import_" + Date.now(),
    null,
    { count: importedCount },
  );

  res.json({ status: "success", importedCount });
});

// GET /api/can-consume
app.get("/api/can-consume", (req, res) => {
  const ws = resolveWorkspace(req);
  const { customerId, meterId, amount } = req.query;

  const customerIdStr = String(customerId || "");
  const meterIdStr = String(meterId || "compute_meter");
  const numAmount = Number(amount) || 1;

  const customer = db.customers.find((c) => c.id === customerIdStr);
  if (!customer) {
    return res.status(404).json({ error: "Customer not found." });
  }

  // Calculate overall quota remaining for this customer + meter
  const quota = db.quotas.find(
    (q) => q.customerId === customerIdStr && q.meterId === meterIdStr,
  );
  const limitVal = quota ? quota.limitValue : 100000;
  const usedVal = quota
    ? quota.usedValue
    : meterIdStr === "compute_meter"
      ? customer.usageUnits
      : 0;

  const isOverage = usedVal + numAmount > limitVal;

  // Let's compute credits
  const credits = db.creditLedger
    .filter((c) => c.customerId === customerIdStr)
    .reduce((sum, entry) => sum + entry.amount, 0);

  if (isOverage) {
    // If we have credits, check if they can offset the overage at flat rate
    if (credits > 0) {
      return res.json({
        allowed: true,
        reason: "quota_exceeded_with_credit_offset",
        details: {
          limitValue: limitVal,
          currentUsed: usedVal,
          requested: numAmount,
          creditBalance: credits,
          canOffset: true,
        },
      });
    }

    return res.json({
      allowed: false,
      reason: "quota_exceeded",
      details: {
        limitValue: limitVal,
        currentUsed: usedVal,
        requested: numAmount,
        creditBalance: credits,
        canOffset: false,
      },
    });
  }

  return res.json({
    allowed: true,
    reason: "quota_available",
    details: {
      limitValue: limitVal,
      currentUsed: usedVal,
      requested: numAmount,
      creditBalance: credits,
      canOffset: true,
    },
  });
});

// POST /api/events/replay
app.post("/api/events/replay", (req, res) => {
  const ws = resolveWorkspace(req);
  const { eventId } = req.body;

  const event = db.usageEvents.find((e) => e.id === eventId);
  if (!event) {
    return res.status(404).json({ error: "Event not found." });
  }

  // Trigger re-accounting audit trace
  writeAuditLog(
    ws.id,
    "Reprocessor Daemon",
    "UPDATE",
    "EVENT",
    event.id,
    { reason: "reconciliation_backfill", status: "replayed" },
    event,
  );

  res.json({
    status: "replayed",
    eventId: event.id,
    reprocessedAt: new Date().toISOString(),
  });
});

// 5. Entitlements Endpoints
app.get("/api/entitlements", (req, res) => {
  const ws = resolveWorkspace(req);

  // Transform db.entitlements and db.features to output client-friendly models
  // Required Plan mappings can be resolved by searching the entitlements table!
  const clientEntitlements: ClientEntitlement[] = db.features.map((feat) => {
    // Check if there is an active required plan configuration
    // Default level: free maps to starter, growth maps to growth, scale maps to scale
    // Let's search which plan maps this feature as true.
    // If enterprise has it and free doesn't, we look up.
    const mappings = db.entitlements.filter((ent) => ent.featureId === feat.id);
    const growthMapping = mappings.find(
      (m) => m.planId === "growth" && m.value === true,
    );
    const freeMapping = mappings.find(
      (m) => m.planId === "free" && m.value === true,
    );

    let requiredPlanId = "scale";
    if (freeMapping) {
      requiredPlanId = "free";
    } else if (growthMapping) {
      requiredPlanId = "growth";
    }

    // Checking if the global toggle is bypassed or enforces (if all are disabled, isEnabled = false)
    const activeToggle = mappings.some((m) => m.isEnabled);

    return {
      featureId: feat.slug,
      featureName: feat.name,
      description: feat.description,
      requiredPlanId,
      isEnabled: activeToggle,
    };
  });

  res.json(clientEntitlements);
});

app.put("/api/entitlements/:featureId", (req, res) => {
  const ws = resolveWorkspace(req);
  const { featureId } = req.params; // this matches feature Slug e.g. "api_access"
  const { requiredPlanId, isEnabled } = req.body;

  const targetFeature = db.features.find((f) => f.slug === featureId);
  if (!targetFeature) {
    return res
      .status(404)
      .json({ error: `Feature slug '${featureId}' not found.` });
  }

  const beforeState = JSON.stringify(
    db.entitlements.filter((e) => e.featureId === targetFeature.id),
  );

  // Modify entitlements in db
  if (requiredPlanId !== undefined) {
    // If required plan is scale, then scale contains true, growth/free contains false
    // If required plan is growth, then scale/growth contains true, free contains false
    // If required plan is free, then all contain true.
    db.entitlements.forEach((ent) => {
      if (ent.featureId === targetFeature.id) {
        if (requiredPlanId === "free") {
          ent.value = true;
        } else if (requiredPlanId === "growth") {
          ent.value = ent.planId === "growth" || ent.planId === "scale";
        } else {
          ent.value = ent.planId === "scale";
        }
      }
    });
  }

  if (isEnabled !== undefined) {
    db.entitlements.forEach((ent) => {
      if (ent.featureId === targetFeature.id) {
        ent.isEnabled = isEnabled;
      }
    });
  }

  const afterState = JSON.stringify(
    db.entitlements.filter((e) => e.featureId === targetFeature.id),
  );

  writeAuditLog(
    ws.id,
    "Ademola Olushola",
    "UPDATE",
    "ENTITLEMENT",
    targetFeature.id,
    JSON.parse(beforeState),
    JSON.parse(afterState),
  );

  res.json({
    featureId,
    requiredPlanId,
    isEnabled,
  });
});

// 6. Invoices list endpoint (aggregating workspace customer invoices)
app.get("/api/invoices", (req, res) => {
  const ws = resolveWorkspace(req);
  const wsCustomers = db.customers.filter((c) => c.workspaceId === ws.id);
  const wsCustomerIds = new Set(wsCustomers.map((c) => c.id));

  const allInvoices = wsCustomers
    .flatMap((cust) =>
      cust.invoices.map((inv) => ({
        ...inv,
        customerId: cust.id,
        customerName: cust.name,
        customerEmail: cust.email,
      })),
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  res.json(allInvoices);
});

// POST to issue custom manual invoice
app.post("/api/invoices", (req, res) => {
  const ws = resolveWorkspace(req);
  const { customerId, amount, currency, usageUnits, status } = req.body;
  const cust = db.customers.find((c) => c.id === customerId);
  if (!cust) {
    return res.status(404).json({ error: "Customer target not found." });
  }

  const beforeCustomer = JSON.parse(JSON.stringify(cust));

  const newInvoice: Invoice = {
    id: "INV-2026-" + Math.floor(100 + Math.random() * 900),
    amount: Number(amount) || 15000,
    currency: currency || "NGN",
    date: new Date().toISOString().split("T")[0],
    status: status || "draft",
    usageUnits: Number(usageUnits) || 0,
  };

  cust.invoices.unshift(newInvoice);
  saveDatabase();

  writeAuditLog(
    ws.id,
    "Ademola Olushola",
    "CREATE",
    "INVOICE",
    newInvoice.id,
    beforeCustomer.invoices,
    cust.invoices,
  );

  res.status(201).json(newInvoice);
});

// Update invoice status (used by recovery engine)
app.patch("/api/invoices/:invoiceId/status", (req, res) => {
  const { invoiceId } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: "Status field is required." });
  }

  let targetCustomer: Customer | undefined;
  let targetInvoice: Invoice | undefined;

  for (const cust of db.customers) {
    const inv = cust.invoices.find((i) => i.id === invoiceId);
    if (inv) {
      targetCustomer = cust;
      targetInvoice = inv;
      break;
    }
  }

  if (!targetCustomer || !targetInvoice) {
    return res.status(404).json({ error: "Invoice not found." });
  }

  const beforeStatus = targetInvoice.status;
  targetInvoice.status = status;
  saveDatabase();

  writeAuditLog(
    targetCustomer.workspaceId,
    "Ademola Olushola",
    "UPDATE",
    "INVOICE",
    invoiceId,
    { status: beforeStatus },
    { status },
  );

  res.json({ invoiceId, status, updatedAt: new Date().toISOString() });
});

// ==========================================
// PHASE 3: PRICING ENGINE, RATE CARDS, COUPONS & CONTRACTS ENDPOINTS
// ==========================================

// Prices Catalog Routing
app.get("/api/prices", (req, res) => {
  const ws = resolveWorkspace(req);
  let result = [...db.prices];
  if (req.query.planId) {
    result = result.filter((p) => p.planId === req.query.planId);
  }
  if (req.query.active !== undefined) {
    const isActive = req.query.active === "true";
    result = result.filter((p) => p.isActive === isActive);
  }
  res.json(result);
});

app.post("/api/prices", (req, res) => {
  const ws = resolveWorkspace(req);
  const {
    planId,
    name,
    type,
    billingPeriod,
    currency,
    baseFee,
    seatPrice,
    includedSeats,
    meterId,
    includedUsage,
    overageUnitPrice,
    tiers,
    volumePricing,
    packageSize,
    packagePrice,
  } = req.body;

  if (!planId || !name || !type) {
    return res
      .status(400)
      .json({ error: "Required fields: planId, name, type" });
  }

  // Calculate version
  const previousPrices = db.prices.filter((p) => p.planId === planId);
  const latestVersion = previousPrices.reduce(
    (max, p) => Math.max(max, p.version),
    0,
  );
  const nextVersion = latestVersion + 1;

  // Toggle earlier active versions off to ensure old customers remain untouched but new pricing becomes default
  db.prices.forEach((p) => {
    if (p.planId === planId) {
      p.isActive = false;
    }
  });

  const newPrice: Price = {
    id:
      "pr_" +
      planId +
      "_v" +
      nextVersion +
      "_" +
      Date.now().toString().slice(-4),
    planId,
    name,
    type,
    billingPeriod: billingPeriod || "monthly",
    currency: currency || "NGN",
    baseFee: Number(baseFee) || 0,
    seatPrice: seatPrice !== undefined ? Number(seatPrice) : undefined,
    includedSeats:
      includedSeats !== undefined ? Number(includedSeats) : undefined,
    meterId: meterId || "compute_meter",
    includedUsage:
      includedUsage !== undefined ? Number(includedUsage) : undefined,
    overageUnitPrice:
      overageUnitPrice !== undefined ? Number(overageUnitPrice) : undefined,
    tiers: tiers || [],
    volumePricing: !!volumePricing,
    packageSize: packageSize !== undefined ? Number(packageSize) : undefined,
    packagePrice: packagePrice !== undefined ? Number(packagePrice) : undefined,
    version: nextVersion,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  db.prices.unshift(newPrice);
  saveDatabase();

  writeAuditLog(
    ws.id,
    "Ademola Olushola",
    "CREATE",
    "PRICE",
    newPrice.id,
    previousPrices,
    newPrice,
  );

  res.status(201).json(newPrice);
});

// Rate Cards routing
app.get("/api/rate-cards", (req, res) => {
  res.json(db.rateCards);
});

app.post("/api/rate-cards", (req, res) => {
  const ws = resolveWorkspace(req);
  const {
    name,
    description,
    meterId,
    priceType,
    unitPrice,
    tiers,
    includedUnits,
    currency,
  } = req.body;

  if (!name || !meterId || !priceType) {
    return res
      .status(400)
      .json({ error: "Required: name, meterId, priceType" });
  }

  const newRateCard: RateCard = {
    id: "rc_" + Date.now().toString().slice(-6),
    name,
    description: description || "",
    meterId,
    priceType,
    unitPrice: unitPrice !== undefined ? Number(unitPrice) : undefined,
    tiers: tiers || [],
    includedUnits:
      includedUnits !== undefined ? Number(includedUnits) : undefined,
    currency: currency || "NGN",
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  db.rateCards.unshift(newRateCard);
  saveDatabase();

  writeAuditLog(
    ws.id,
    "Ademola Olushola",
    "CREATE",
    "RATE_CARD",
    newRateCard.id,
    null,
    newRateCard,
  );

  res.status(201).json(newRateCard);
});

// Discounts & Coupons routing
app.get("/api/discounts", (req, res) => {
  res.json(db.discounts);
});

app.post("/api/discounts", (req, res) => {
  const ws = resolveWorkspace(req);
  const { name, type, value, appliesTo, duration, durationMonths } = req.body;

  if (!name || !type || value === undefined) {
    return res
      .status(400)
      .json({ error: "Required fields: name, type, value" });
  }

  const newDiscount: Discount = {
    id: "disc_" + Date.now().toString().slice(-6),
    name,
    type,
    value: Number(value),
    appliesTo: appliesTo || "all",
    duration: duration || "once",
    durationMonths:
      durationMonths !== undefined ? Number(durationMonths) : undefined,
    createdAt: new Date().toISOString(),
  };

  db.discounts.push(newDiscount);
  saveDatabase();

  writeAuditLog(
    ws.id,
    "Ademola Olushola",
    "CREATE",
    "DISCOUNT",
    newDiscount.id,
    null,
    newDiscount,
  );
  res.status(201).json(newDiscount);
});

app.get("/api/coupons", (req, res) => {
  res.json(db.coupons);
});

app.post("/api/coupons", (req, res) => {
  const ws = resolveWorkspace(req);
  const { name, discountId, code, expireAt, maxRedemptions } = req.body;

  if (!name || !discountId || !code) {
    return res
      .status(400)
      .json({ error: "Required fields: name, discountId, code" });
  }

  const newCoupon: Coupon = {
    id: "cp_" + Date.now().toString().slice(-6),
    name,
    discountId,
    code: code.trim().toUpperCase(),
    isActive: true,
    expireAt,
    maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
    timesRedeemed: 0,
    createdAt: new Date().toISOString(),
  };

  db.coupons.push(newCoupon);
  saveDatabase();

  writeAuditLog(
    ws.id,
    "Ademola Olushola",
    "CREATE",
    "COUPON",
    newCoupon.id,
    null,
    newCoupon,
  );
  res.status(201).json(newCoupon);
});

// Custom Contracts routing
app.get("/api/contracts", (req, res) => {
  res.json(db.customContracts);
});

app.post("/api/contracts", (req, res) => {
  const ws = resolveWorkspace(req);
  const {
    customerId,
    name,
    customBaseFee,
    customSeatPrice,
    customOverageUnitPrice,
    minimumSpend,
    additionalDiscountPercentage,
    expireAt,
  } = req.body;

  if (!customerId || !name || customBaseFee === undefined) {
    return res
      .status(400)
      .json({ error: "Required fields: customerId, name, customBaseFee" });
  }

  const newContract: CustomContract = {
    id: "cc_" + Date.now().toString().slice(-6),
    customerId,
    name,
    customBaseFee: Number(customBaseFee),
    customSeatPrice:
      customSeatPrice !== undefined ? Number(customSeatPrice) : undefined,
    customOverageUnitPrice:
      customOverageUnitPrice !== undefined
        ? Number(customOverageUnitPrice)
        : undefined,
    minimumSpend: minimumSpend !== undefined ? Number(minimumSpend) : undefined,
    additionalDiscountPercentage:
      additionalDiscountPercentage !== undefined
        ? Number(additionalDiscountPercentage)
        : undefined,
    expireAt:
      expireAt ||
      new Date(Date.now() + 31536000000).toISOString().split("T")[0],
    createdAt: new Date().toISOString(),
  };

  db.customContracts.unshift(newContract);
  saveDatabase();

  writeAuditLog(
    ws.id,
    "Ademola Olushola",
    "CREATE",
    "CONTRACT",
    newContract.id,
    null,
    newContract,
  );
  res.status(201).json(newContract);
});

// Revenue Estimates/Simulations Resolution Engine
app.post("/api/pricing-calculate", (req, res) => {
  const {
    customerId,
    priceId,
    planId,
    seatsCount,
    usageUnits,
    couponCode,
    useCredits,
  } = req.body;

  let activePrice: Price | null = null;

  // Resolve Pricing configuration from catalog
  if (priceId) {
    activePrice = db.prices.find((p) => p.id === priceId) || null;
  } else if (planId) {
    activePrice =
      db.prices.find((p) => p.planId === planId && p.isActive) || null;
  }

  // Fallback defaults mapping inline plans
  if (!activePrice) {
    const matchedPlan = db.plans.find((p) => p.id === planId);
    if (matchedPlan) {
      activePrice = {
        id: "pr_impl_" + matchedPlan.id,
        planId: matchedPlan.id,
        name: matchedPlan.name + " Default Price",
        type:
          (matchedPlan.pricingType === "per_seat"
            ? "seat"
            : matchedPlan.pricingType) || "hybrid",
        billingPeriod: matchedPlan.billingPeriod,
        currency: matchedPlan.currency,
        baseFee: matchedPlan.price,
        includedSeats: matchedPlan.includedSeats,
        includedUsage: matchedPlan.includedUsage,
        overageUnitPrice: matchedPlan.overageUnitPrice,
        version: 1,
        isActive: true,
        createdAt: matchedPlan.createdAt,
      };
    } else {
      return res
        .status(404)
        .json({
          error:
            "Pricing schema parameter structure not defined in this catalog.",
        });
    }
  }

  // Resolve Custom contract overriding limits
  let targetCustomer: Customer | null = null;
  let contractOverride: CustomContract | null = null;

  if (customerId) {
    targetCustomer = db.customers.find((c) => c.id === customerId) || null;
    contractOverride =
      db.customContracts.find((cc) => cc.customerId === customerId) || null;
  }

  const seatsInput =
    seatsCount !== undefined
      ? Number(seatsCount)
      : targetCustomer
        ? targetCustomer.seatsUsed
        : activePrice.includedSeats || 1;
  const usageInput =
    usageUnits !== undefined
      ? Number(usageUnits)
      : targetCustomer
        ? targetCustomer.usageUnits
        : 0;

  let baseFee = activePrice.baseFee;
  let seatPrice = activePrice.seatPrice || 0;
  let overageUnitPrice = activePrice.overageUnitPrice || 0;

  if (contractOverride) {
    baseFee = contractOverride.customBaseFee;
    if (contractOverride.customSeatPrice !== undefined)
      seatPrice = contractOverride.customSeatPrice;
    if (contractOverride.customOverageUnitPrice !== undefined)
      overageUnitPrice = contractOverride.customOverageUnitPrice;
  }

  const modelType = activePrice.type;
  let seatsIncluded = activePrice.includedSeats || 0;
  let usageIncluded = activePrice.includedUsage || 0;

  const seatsOverage = Math.max(0, seatsInput - seatsIncluded);
  const seatCharge = seatsOverage * seatPrice;

  let overageUnits = 0;
  let overageCharge = 0;
  let tierBreakdown: any[] = [];

  if (modelType === "flat") {
    overageCharge = 0;
  } else if (modelType === "usage") {
    overageUnits = usageInput;
    overageCharge = usageInput * overageUnitPrice;
  } else if (modelType === "tiered") {
    const tiers = activePrice.tiers || [];
    let remaining = usageInput;
    let lastBorder = 0;

    for (const tier of tiers) {
      const limit = tier.upTo === "infinity" ? Infinity : Number(tier.upTo);
      const capacity = limit - lastBorder;
      const consumedInTier = Math.min(remaining, capacity);

      if (consumedInTier > 0) {
        const cost = consumedInTier * tier.unitPrice;
        overageCharge += cost;
        remaining -= consumedInTier;

        tierBreakdown.push({
          tierRange: `${lastBorder} - ${tier.upTo === "infinity" ? "∞" : tier.upTo}`,
          units: consumedInTier,
          rate: tier.unitPrice,
          charge: cost,
        });
      }
      lastBorder = limit;
      if (remaining <= 0) break;
    }
    overageUnits = usageInput;
  } else if (modelType === "volume") {
    const tiers = activePrice.tiers || [];
    let rateToUse = overageUnitPrice;

    for (const tier of tiers) {
      const limit = tier.upTo === "infinity" ? Infinity : Number(tier.upTo);
      if (usageInput <= limit) {
        rateToUse = tier.unitPrice;
        break;
      }
    }
    overageUnits = usageInput;
    overageCharge = usageInput * rateToUse;
    tierBreakdown.push({
      tierRange: "Entire Volume Tier",
      units: usageInput,
      rate: rateToUse,
      charge: overageCharge,
    });
  } else if (modelType === "package") {
    const size = activePrice.packageSize || 10000;
    const pricePerSize = activePrice.packagePrice || 5000;
    const packagesNeeded = Math.ceil(usageInput / size);
    overageUnits = usageInput;
    overageCharge = packagesNeeded * pricePerSize;
    tierBreakdown.push({
      tierRange: `Incremental Packages of ${size}`,
      units: packagesNeeded,
      rate: pricePerSize,
      charge: overageCharge,
    });
  } else if (modelType === "hybrid" || modelType === "custom_contract") {
    overageUnits = Math.max(0, usageInput - usageIncluded);
    overageCharge = overageUnits * overageUnitPrice;
  }

  // Discount parsing
  let discountAmount = 0;
  let activeDiscount: Discount | null = null;

  if (couponCode) {
    const coupon = db.coupons.find(
      (c) => c.code === couponCode.trim().toUpperCase() && c.isActive,
    );
    if (coupon) {
      activeDiscount =
        db.discounts.find((d) => d.id === coupon.discountId) || null;
    }
  }

  const grossSum = baseFee + seatCharge + overageCharge;

  if (activeDiscount) {
    if (activeDiscount.type === "percentage") {
      const pct = activeDiscount.value / 100;
      if (activeDiscount.appliesTo === "all") {
        discountAmount = grossSum * pct;
      } else if (activeDiscount.appliesTo === "base_fee") {
        discountAmount = baseFee * pct;
      } else if (activeDiscount.appliesTo === "overage") {
        discountAmount = overageCharge * pct;
      } else if (activeDiscount.appliesTo === "seat_fee") {
        discountAmount = seatCharge * pct;
      }
    } else if (activeDiscount.type === "fixed") {
      const fixedVal = activeDiscount.value;
      if (activeDiscount.appliesTo === "all") {
        discountAmount = Math.min(grossSum, fixedVal);
      } else if (activeDiscount.appliesTo === "base_fee") {
        discountAmount = Math.min(baseFee, fixedVal);
      } else if (activeDiscount.appliesTo === "overage") {
        discountAmount = Math.min(overageCharge, fixedVal);
      } else if (activeDiscount.appliesTo === "seat_fee") {
        discountAmount = Math.min(seatCharge, fixedVal);
      }
    }
  }

  // Minimum commitments
  let subtotal = grossSum - discountAmount;
  let enterpriseMinimumAdjust = 0;
  if (contractOverride && contractOverride.minimumSpend !== undefined) {
    const minSpend = contractOverride.minimumSpend;
    if (subtotal < minSpend) {
      enterpriseMinimumAdjust = minSpend - subtotal;
      subtotal = minSpend;
    }
  }

  // Credit system ledger lookup
  let creditBalance = 0;
  let creditApplied = 0;

  if (customerId) {
    creditBalance = db.creditLedger
      .filter((entry) => entry.customerId === customerId)
      .reduce((sum, entry) => sum + entry.amount, 0);
  }

  if (useCredits && creditBalance > 0 && subtotal > 0) {
    creditApplied = Math.min(subtotal, creditBalance);
    subtotal = subtotal - creditApplied;
  }

  const finalTotal = Math.max(0, subtotal);

  res.json({
    price_id: activePrice.id,
    price_name: activePrice.name,
    pricing_type: modelType,
    currency: activePrice.currency,
    billing_period: activePrice.billingPeriod,
    base_fee: baseFee,
    included_seats: seatsIncluded,
    seats_consumed: seatsInput,
    seat_fee_per_unit: seatPrice,
    seat_charge: seatCharge,
    included_usage: usageIncluded,
    usage_consumed: usageInput,
    overage_units: overageUnits,
    overage_charge: overageCharge,
    tier_breakdown: tierBreakdown,
    discount_applied: discountAmount,
    discount_name: activeDiscount?.name || null,
    minimum_spend_adjustment: enterpriseMinimumAdjust,
    credit_balance: creditBalance,
    credit_applied: creditApplied,
    total: finalTotal,
    has_contract_override: !!contractOverride,
  });
});

// ==========================================
// AUTHORIZATION ENGINE (canAccess Service API)
// ==========================================
app.get("/api/can-access", (req, res) => {
  const { customerId, featureSlug } = req.query;

  if (!customerId || !featureSlug) {
    return res
      .status(400)
      .json({ error: "Params customerId and featureSlug are required" });
  }

  const customer = db.customers.find((c) => c.id === customerId);
  if (!customer) {
    return res
      .status(404)
      .json({ error: `Customer '${customerId}' not found` });
  }

  const feature = db.features.find((f) => f.slug === featureSlug);
  if (!feature) {
    return res
      .status(404)
      .json({
        error: `Feature slug '${featureSlug}' has not been declared inside workspace telemetry.`,
      });
  }

  // Retrieve customer subscription
  const sub = db.subscriptions.find((s) => s.customerId === customerId);
  const plan = db.plans.find((p) => p.id === (sub?.planId || customer.planId));

  // Locate the specific entitlement matching Customer Plan + Feature Gate
  const entitlement = db.entitlements.find(
    (e) => e.planId === plan?.id && e.featureId === feature.id,
  );

  // Resolution rules:
  // 1. If global toggle (isEnabled) is false, the lock is bypassed/disabled so access is true!
  const isEnforced = entitlement ? entitlement.isEnabled : true;

  // 2. If plan is active and evaluation value is true, access is granted
  const stateVal = entitlement ? !!entitlement.value : false;
  const isAllowed = isEnforced
    ? stateVal && customer.status !== "paused" && customer.status !== "canceled"
    : true;

  let reason = "";
  if (!isEnforced) {
    reason = `Global lock feature bypass enabled. Access of feature slug '${featureSlug}' is active.`;
  } else if (isAllowed) {
    reason = `Customer '${customer.name}' has valid subscription to '${plan?.name}' plan which unlocks entitlement gate '${feature.name}'.`;
  } else {
    reason = `Access denied. Feature '${feature.name}' requires plan upgrade (Customer is on starter '${plan?.name}' plan).`;
  }

  const auditContext = resolveWorkspace(req);
  writeAuditLog(
    auditContext.id,
    "Authorization Core Engine",
    "ACCESS_VERIFY",
    "ENTITLEMENT",
    entitlement?.id || "unknown",
    { customerId, featureSlug, status: customer.status, planId: plan?.id },
    { isAllowed, reason, enforcementActive: isEnforced },
  );

  res.json({
    customerId,
    featureSlug,
    isAllowed,
    reason,
    diagnostic: {
      customerName: customer.name,
      planId: plan?.id,
      subscriptionStatus: sub?.status || customer.status,
      enforced: isEnforced,
      value: entitlement?.value,
      timestamp: new Date().toISOString(),
    },
  });
});

// ==========================================
// GEMINI AI BILLING ASSISTANT
// ==========================================
app.get("/api/chat-history", (req, res) => {
  const history = chatMessageLog.filter((m) => m.role !== "system");
  res.json(history);
});

// Process a message with the Gemini AI engine
app.post("/api/chat", async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: "Message text is mandatory." });
  }

  // Add user message
  const userMsgId = "msg_u_" + Date.now();
  chatMessageLog.push({ id: userMsgId, role: "user", text });

  const ai = getAI();

  if (!ai) {
    // Fallback chatbot simulator
    let reply = "";
    let actionBlock: any = null;

    const lowercase = text.toLowerCase();
    if (
      lowercase.includes("create a usage plan") ||
      lowercase.includes("tokens")
    ) {
      reply =
        "I've created a custom, hybrid **Usage-Based Plan** for AI tokens! It is configured with NGN ₦25,000 base fee per month and NGN ₦0.04 per Token after exceeding the 100k free premium tokens. It is now loaded into your Pricing Repository.";
      actionBlock = {
        type: "CREATE_PLAN",
        payload: {
          name: "Deepmind Core Tokenizer",
          price: 25000,
          currency: "NGN",
          billingPeriod: "monthly",
          includedSeats: 5,
          includedUsage: 100000,
          apiAccess: true,
          overageUnitPrice: 0.04,
          description: "Usage billing of state-of-the-art token metrics.",
        },
      };
    } else if (lowercase.includes("churn") || lowercase.includes("why did")) {
      reply =
        "Looking in depth at last month's cohort transitions (May 2026 to June 2026), your net revenue retention rate is **98.2%**, and churn increased slightly by **0.24%** strictly due to 1 card decline on **Notion Enterprise (INV-2026-008)** which is currently marked as **Past Due**. Let's trigger a retry or write a follow-up note to them.";
    } else if (lowercase.includes("add") && lowercase.includes("note")) {
      reply =
        "I've logged a high-priority advisory note in the Linear Technology customer timeline to keep your executive staff aligned.";
      actionBlock = {
        type: "ADD_NOTE",
        payload: {
          customerId: "linear",
          text: "AI Billing agent logged urgent advisory note inside linear stack.",
        },
      };
    } else if (lowercase.includes("audit") || lowercase.includes("logs")) {
      reply = `I have retrieved the active workspace **compliance audit logs** from our multi-tenant ledger database. We currently record **${db.auditLogs.length}** events reflecting operations like Plan updates, Note logs, and Client token generations. The audit files represent comprehensive before-and-after JSON snapshots of raw server changes.`;
    } else {
      reply =
        "Welcome to the SaaS Billing Operating System Assistant. I'm trained on Apple-grade product engineering schemas and Lago-grade hybrid pricing engines.\n\nHere are some operations you can command me to perform:\n- *'Create a usage plan for AI tokens'* (Executes action and builds plan in the catalog)\n- *'Why did churn increase last month?'* (Performs detailed telemetry cohort analysis on current invoices)\n- *'Fetch the compliance audit log trail'*\n- *'Convert my fixed plan into a hybrid plan'*\n- *'Generate a pricing strategy for agencies'*";
    }

    if (actionBlock) {
      executeDatabaseAction(actionBlock);
    }

    const modelMsgId = "msg_m_" + Date.now();
    chatMessageLog.push({ id: modelMsgId, role: "model", text: reply });
    return res.json({
      id: modelMsgId,
      role: "model",
      text: reply,
      actionExecuted: actionBlock ? actionBlock.type : null,
    });
  }

  try {
    const systemPrompt = `You are a world-class Billing & Revenue Architect and AI Assistant inside a premium SaaS billing operational operating system (feeling as polished as Apple, Lago, Stripe, and Linear combined).
Your task is to answer the user's questions about SaaS pricing structures, billing setups, subscription cohorts, failed invoices, and growth strategies in clear, human, elegant markdown without corporate buzzwords.

Crucially, you are connected to the live backend multi-tenant state! You can execute special actions in real-time. If the user asks you to create a plan, add a note to a customer, or generate a price rule, you MUST output a valid JSON block inside the special tag: <billing_action>...</billing_action>.

Here are the exact JSON action schemas you can trigger:
1. Create a Plan:
<billing_action>
{
  "type": "CREATE_PLAN",
  "payload": {
    "name": "AI Tokens Plan",
    "price": 49000,
    "currency": "NGN",
    "billingPeriod": "monthly",
    "includedSeats": 10,
    "includedUsage": 100000,
    "apiAccess": true,
    "overageUnitPrice": 0.5,
    "description": "Created automatically via AI instructions"
  }
}
</billing_action>

2. Add Customer Note:
<billing_action>
{
  "type": "ADD_NOTE",
  "payload": {
    "customerId": "linear",
    "text": "Add text message here"
  }
}
</billing_action>

Current Platform State Context:
- Active Tenant Workspace Customers: ${JSON.stringify(db.customers.map((c) => ({ id: c.id, name: c.name, plan: c.planId, status: c.status, usageUnits: c.usageUnits, invoices: c.invoices })))}
- Existing Pricing Plans: ${JSON.stringify(db.plans)}
- Metric event aggregators inside workspace: ${JSON.stringify(db.meters)}
- Total audit trail records: ${db.auditLogs.length}

Keep your text responses elegant, premium, concise, and helpful. Always confirm if an action has been committed.`;

    const formattedContents = chatMessageLog
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
      }));

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: formattedContents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
      },
    });

    const aiText =
      response.text ||
      "Apologies, I encountered a silent response from the reasoning core.";

    let parsedAction: any = null;
    const actionMatch = aiText.match(
      /<billing_action>([\s\S]*?)<\/billing_action>/,
    );
    if (actionMatch && actionMatch[1]) {
      try {
        parsedAction = JSON.parse(actionMatch[1].trim());
        executeDatabaseAction(parsedAction);
      } catch (err) {
        console.error("Failed to parse AI billing action JSON block:", err);
      }
    }

    const modelMsgId = "msg_m_" + Date.now();
    chatMessageLog.push({ id: modelMsgId, role: "model", text: aiText });
    res.json({
      id: modelMsgId,
      role: "model",
      text: aiText,
      actionExecuted: parsedAction ? parsedAction.type : null,
    });
  } catch (error: any) {
    console.error("Gemini Assistant Core Call Error:", error);
    const fallbackText = `I ran into a server communication error with the Gemini cloud reasoning engine. However, based on our premium billing schemas, here's planning:
- Auto-sync updated database structures.
- Persistence ledger safely backed up on disk file.`;
    const modelMsgId = "msg_m_" + Date.now();
    chatMessageLog.push({ id: modelMsgId, role: "model", text: fallbackText });
    res.json({
      id: modelMsgId,
      role: "model",
      text: fallbackText,
      error: error.message,
    });
  }
});

function executeDatabaseAction(action: { type: string; payload: any }) {
  try {
    switch (action.type) {
      case "CREATE_PLAN":
        const p = action.payload;
        if (p.name) {
          const generatedId = p.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
          const newPlan = {
            id: generatedId,
            productId: "prod_compute",
            name: p.name,
            price: Number(p.price) || 0,
            currency: p.currency || "NGN",
            billingPeriod: p.billingPeriod || "monthly",
            includedSeats: Number(p.includedSeats) || 1,
            includedUsage: Number(p.includedUsage) || 20000,
            apiAccess: p.apiAccess !== undefined ? !!p.apiAccess : true,
            overageUnitPrice: Number(p.overageUnitPrice) || 0.1,
            description: p.description || "Generated via AI Assistant",
            createdAt: new Date().toISOString(),
          };
          db.plans.push(newPlan);

          // Seed default feature assignments
          db.features.forEach((feat) => {
            db.entitlements.push({
              id: `ent_${generatedId}_${feat.slug}`,
              planId: generatedId,
              featureId: feat.id,
              value: feat.slug === "api_access" ? !!newPlan.apiAccess : false,
              isEnabled: true,
              createdAt: new Date().toISOString(),
            });
          });

          writeAuditLog(
            "ws_aora",
            "AI Billing Assistant",
            "CREATE",
            "PLAN",
            newPlan.id,
            null,
            newPlan,
          );
          console.log("Successfully created plan through AI:", p.name);
        }
        break;
      case "ADD_NOTE":
        const { customerId, text } = action.payload;
        const target = db.customers.find((c) => c.id === customerId);
        if (target) {
          const before = JSON.parse(JSON.stringify(target));
          target.notes.unshift({
            id: "note_ai_" + Date.now(),
            timestamp: new Date().toISOString(),
            text: text || "Custom note configured through AI instruction.",
            author: "AI Assistant",
          });
          writeAuditLog(
            target.workspaceId,
            "AI Assistant",
            "UPDATE",
            "CUSTOMER",
            target.id,
            before,
            target,
          );
          console.log(
            "Successfully added customer note through AI on:",
            customerId,
          );
        }
        break;
      default:
        console.warn("Unrecognized AI action triggered:", action.type);
    }
  } catch (err) {
    console.error("Failed to commit database action payload:", err);
  }
}

// ==========================================
// STATIC VITE SERVING & MIDDLEWARE
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Setting up live Vite development preview mode...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Configuring high-fidelity production static assets server...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `Premium Billing Engine Server is actively listening on port ${PORT}`,
    );
  });
}

startServer();
