// ============================================================
// Aora Billing OS — Database State Module
// Manages in-memory state, JSON persistence, audit logging,
// and workspace resolution. All route modules import from here.
// ============================================================

import fs from "fs";
import path from "path";
import type { Request } from "express";
import type {
  DBState, Organization, Workspace, Member, Product, Feature,
  Plan, Entitlement, Customer, Subscription, MeterDefinition,
  UsageEvent, AuditLog, Quota, CreditLedgerEntry, Price,
  RateCard, Discount, Coupon, CustomContract,
} from "./types.ts";

// ── File path ──────────────────────────────────────────────────
export const DB_FILE = path.join(process.cwd(), "billing_db.json");

// ── Live in-memory database ────────────────────────────────────
export let db: DBState = {
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
  webhooks: [],
  webhookDeliveries: [],
};

// ── Global AI chat log ─────────────────────────────────────────
export let chatMessageLog: { role: "user" | "model" | "system"; text: string; id: string }[] = [
  {
    id: "chat_0",
    role: "system",
    text: "You are the Premium Billing Assistant, representing an operating system that operates precisely like Stripe, Paddle and Lago combined.",
  },
];

// ── Persistence ────────────────────────────────────────────────
export function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("Critical: Failed to persist billing ledger to disk:", err);
  }
}

// ── Audit Logging ──────────────────────────────────────────────
export function writeAuditLog(
  workspaceId: string,
  actor: string,
  action: AuditLog["action"],
  entityType: AuditLog["entityType"],
  entityId: string,
  before: any,
  after: any,
) {
  const entry: AuditLog = {
    id: "aud_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    workspaceId,
    actor: actor || "System",
    action,
    entityType,
    entityId,
    beforeState: before ? JSON.parse(JSON.stringify(before)) : null,
    afterState: after ? JSON.parse(JSON.stringify(after)) : null,
    createdAt: new Date().toISOString(),
  };
  db.auditLogs.unshift(entry);
  saveDatabase();
}

// ── Workspace Resolver ─────────────────────────────────────────
export function resolveWorkspace(req: Request): Workspace {
  const wsQuery = (req.query.workspace as string) ||
                  (req.headers["x-workspace-id"] as string);
  if (wsQuery) {
    const matched = db.workspaces.find(
      (w) =>
        w.id === wsQuery ||
        w.name.toLowerCase() === wsQuery.toLowerCase() ||
        wsQuery.toLowerCase().includes(w.name.toLowerCase()),
    );
    if (matched) return matched;
  }
  return db.workspaces[0];
}

// ── ID generators ──────────────────────────────────────────────
export function nanoid(prefix = ""): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Database Initialization & Seed ────────────────────────────
export function initDatabase() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const loaded = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
      db = loaded;

      // Backfill any new collections added after initial file was written
      if (!db.quotas) db.quotas = seedQuotas();
      if (!db.creditLedger) db.creditLedger = seedCreditLedger();
      if (!db.prices || db.prices.length === 0) db.prices = seedPrices();
      if (!db.rateCards || db.rateCards.length === 0) db.rateCards = seedRateCards();
      if (!db.discounts || db.discounts.length === 0) db.discounts = seedDiscounts();
      if (!db.coupons || db.coupons.length === 0) db.coupons = seedCoupons();
      if (!db.customContracts || db.customContracts.length === 0) db.customContracts = seedContracts();
      if (!db.webhooks) db.webhooks = [];
      if (!db.webhookDeliveries) db.webhookDeliveries = [];

      console.log(`Billing ledger loaded. Customers: ${db.customers.length}`);
      return;
    } catch (e) {
      console.error("Error reading DB file; rebuilding from seed…", e);
    }
  }

  // Fresh seed
  db = buildSeedDatabase();
  saveDatabase();
  console.log("Fresh billing ledger seeded and persisted.");
}

// ── Seed helpers (called on first-boot or migration) ───────────

function seedQuotas(): Quota[] {
  return [
    { id: "q_linear_compute", customerId: "linear", meterId: "compute_meter", limitValue: 100000, usedValue: 48200, period: "monthly", createdAt: "2026-06-01T00:00:00Z" },
    { id: "q_vercel_api", customerId: "vercel", meterId: "api_meter", limitValue: 500000, usedValue: 198000, period: "monthly", createdAt: "2026-06-01T00:00:00Z" },
    { id: "q_retool_compute", customerId: "retool", meterId: "compute_meter", limitValue: 1000, usedValue: 420, period: "monthly", createdAt: "2026-06-01T00:00:00Z" },
    { id: "q_notion_compute", customerId: "notion", meterId: "compute_meter", limitValue: 75000, usedValue: 54000, period: "monthly", createdAt: "2026-06-01T00:00:00Z" },
    { id: "q_acme_compute", customerId: "acme", meterId: "compute_meter", limitValue: 300000, usedValue: 265000, period: "monthly", createdAt: "2026-06-01T00:00:00Z" },
  ];
}

function seedCreditLedger(): CreditLedgerEntry[] {
  return [
    { id: "c_linear_grant", customerId: "linear", amount: 10000, type: "credit_issued", description: "Startup Program Welcome Credits", createdAt: "2026-06-01T00:00:00Z", expireAt: "2026-12-01T00:00:00Z" },
    { id: "c_linear_use_1", customerId: "linear", amount: -4500, type: "credit_consumed", description: "Compute Overage Auto Debt", createdAt: "2026-06-05T12:00:00Z" },
    { id: "c_vercel_grant", customerId: "vercel", amount: 25000, type: "credit_issued", description: "Enterprise Tier Partnership Grant", createdAt: "2026-06-01T00:00:00Z", expireAt: "2027-06-01T00:00:00Z" },
    { id: "c_retool_grant", customerId: "retool", amount: 500, type: "credit_issued", description: "Trial Period Promotion Balance", createdAt: "2026-06-01T08:00:00Z", expireAt: "2026-07-01T00:00:00Z" },
  ];
}

function seedPrices(): Price[] {
  return [
    { id: "pr_free_v1", planId: "free", name: "Starter Free v1", type: "flat", billingPeriod: "monthly", currency: "NGN", baseFee: 0, includedSeats: 2, includedUsage: 1000, overageUnitPrice: 0, meterId: "compute_meter", version: 1, isActive: true, createdAt: "2026-01-10T12:00:00Z" },
    { id: "pr_growth_v1", planId: "growth", name: "Growth Plan legacy v1", type: "hybrid", billingPeriod: "monthly", currency: "NGN", baseFee: 10000, seatPrice: 1000, includedSeats: 5, includedUsage: 30000, overageUnitPrice: 2.5, meterId: "compute_meter", version: 1, isActive: false, createdAt: "2026-01-10T12:00:00Z" },
    { id: "pr_growth_v2", planId: "growth", name: "Growth Scale v2", type: "hybrid", billingPeriod: "monthly", currency: "NGN", baseFee: 15000, seatPrice: 2000, includedSeats: 10, includedUsage: 50000, overageUnitPrice: 2.0, meterId: "compute_meter", version: 2, isActive: true, createdAt: "2026-05-01T00:00:00Z" },
    { id: "pr_scale_v1", planId: "scale", name: "Enterprise Pro v1", type: "hybrid", billingPeriod: "monthly", currency: "NGN", baseFee: 45000, seatPrice: 3000, includedSeats: 20, includedUsage: 200000, overageUnitPrice: 1.5, meterId: "compute_meter", version: 1, isActive: true, createdAt: "2026-01-10T12:00:00Z" },
  ];
}

function seedRateCards(): RateCard[] {
  return [
    {
      id: "rc_compute_tiered", name: "Compute Tiered Rate Card",
      description: "Tiered pricing for high density compute", meterId: "compute_meter",
      priceType: "tiered", currency: "NGN",
      tiers: [{ upTo: 1000, unitPrice: 0 }, { upTo: 10000, unitPrice: 2.0 }, { upTo: 50000, unitPrice: 1.5 }, { upTo: "infinity", unitPrice: 1.0 }],
      isActive: true, createdAt: "2026-06-01T00:00:00Z",
    },
    {
      id: "rc_api_volume", name: "Developer API Calls Rate Card",
      description: "Volume-based model for API calls", meterId: "api_meter",
      priceType: "volume", currency: "USD",
      tiers: [{ upTo: 50000, unitPrice: 0.05 }, { upTo: 200000, unitPrice: 0.03 }, { upTo: "infinity", unitPrice: 0.01 }],
      isActive: true, createdAt: "2026-06-01T00:00:00Z",
    },
  ];
}

function seedDiscounts(): Discount[] {
  return [
    { id: "disc_summer20", name: "Summer Launch Special", type: "percentage", value: 20, appliesTo: "all", duration: "forever", createdAt: "2026-06-01T00:00:00Z" },
    { id: "disc_welcome5k", name: "Welcome Onboarding Credit", type: "fixed", value: 5000, appliesTo: "base_fee", duration: "once", createdAt: "2026-06-01T00:00:00Z" },
  ];
}

function seedCoupons(): Coupon[] {
  return [
    { id: "cp_summer20", name: "Summer Promo Code", discountId: "disc_summer20", code: "SUMMER20", isActive: true, timesRedeemed: 3, createdAt: "2026-06-01T00:00:00Z" },
    { id: "cp_welcome5k", name: "Welcome 5K Promo Code", discountId: "disc_welcome5k", code: "WELCOME5K", isActive: true, timesRedeemed: 1, createdAt: "2026-06-01T00:00:00Z" },
  ];
}

function seedContracts(): CustomContract[] {
  return [
    { id: "cc_notion_ent", customerId: "notion", name: "Notion Enterprise Special", customBaseFee: 30000, customSeatPrice: 1200, customOverageUnitPrice: 1.0, minimumSpend: 50000, expireAt: "2027-06-01T00:00:00Z", createdAt: "2026-06-01T00:00:00Z" },
  ];
}

function buildSeedDatabase(): DBState {
  const organizations: Organization[] = [
    { id: "org_aora", name: "Aora Technologies Group", status: "active", createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-01T00:00:00Z" },
    { id: "org_acme", name: "Acme Holdings LLC", status: "active", createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-01T00:00:00Z" },
  ];

  const workspaces: Workspace[] = [
    { id: "ws_aora", organizationId: "org_aora", name: "Aora Technologies Ltd", environment: "production", apiKeys: ["sk_live_aora_5f2d93e810cb9921e42f2bca01"], createdAt: "2025-01-10T12:00:00Z" },
    { id: "ws_sandbox", organizationId: "org_aora", name: "Sandbox Environment", environment: "sandbox", apiKeys: ["sk_test_aora_8812739178239a"], createdAt: "2025-01-12T12:00:00Z" },
    { id: "ws_acme", organizationId: "org_acme", name: "Acme Corporation Workspace", environment: "sandbox", apiKeys: ["sk_test_acme_8a2e1281cb9f0"], createdAt: "2025-01-15T12:00:00Z" },
  ];

  const members: Member[] = [
    { id: "mem_ademola", workspaceId: "ws_aora", email: "ademola@aora.co", role: "owner", permissions: ["*"], createdAt: "2025-01-10T12:00:00Z" },
    { id: "mem_sarah", workspaceId: "ws_aora", email: "sarah.jenkins@aora.co", role: "developer", permissions: ["read", "write_events"], createdAt: "2025-02-14T09:00:00Z" },
    { id: "mem_acme_owner", workspaceId: "ws_acme", email: "finance@acme.sh", role: "owner", permissions: ["*"], createdAt: "2025-01-15T12:00:00Z" },
  ];

  const products: Product[] = [
    { id: "prod_compute", workspaceId: "ws_aora", name: "Compute Processor Engine", description: "High-performance compute instances and event analytics tracking", createdAt: "2025-01-10T12:15:00Z" },
    { id: "prod_compute_sandbox", workspaceId: "ws_sandbox", name: "Compute Processor Engine", description: "Sandbox copy", createdAt: "2025-01-12T12:15:00Z" },
    { id: "prod_acme_metering", workspaceId: "ws_acme", name: "Acme Metering Core", description: "Core metering infrastructure for Acme", createdAt: "2025-01-15T12:15:00Z" },
  ];

  const features: Feature[] = [
    { id: "feature_api_access", workspaceId: "ws_aora", slug: "api_access", name: "API Integrations & SDK Access", description: "Allows developer tools access to query credentials programmatically.", type: "boolean", createdAt: "2024-11-20T00:00:00Z" },
    { id: "feature_custom_branding", workspaceId: "ws_aora", slug: "custom_branding", name: "Custom Branding & Whitelabel Invoice Logos", description: "Removes standard checkout watermarks and embeds custom logos.", type: "boolean", createdAt: "2024-11-20T00:00:00Z" },
    { id: "feature_dedicated_support", workspaceId: "ws_aora", slug: "dedicated_support", name: "Dedicated Enterprise Support Concierge", description: "Provides 15-minute SLA target windows and Slack direct response channels.", type: "boolean", createdAt: "2024-11-20T00:00:00Z" },
    { id: "feature_sso_auth", workspaceId: "ws_aora", slug: "sso_auth", name: "Single Sign-On (SAML Auth)", description: "Allows enterprise users to authenticate via Okta/Ping.", type: "boolean", createdAt: "2024-11-20T00:00:00Z" },
  ];

  const plans: Plan[] = [
    { id: "free", productId: "prod_compute", name: "Starter Free", description: "Ideal for micro projects & hobby experimentation.", code: "free", pricingType: "flat", billingPeriod: "monthly", currency: "NGN", price: 0, includedSeats: 2, includedUsage: 1000, overageUnitPrice: 0, apiAccess: false, createdAt: "2025-01-10T12:30:00Z" },
    { id: "growth", productId: "prod_compute", name: "Growth Scale", description: "The ideal plan for scaling startups requiring professional volume and API integration.", code: "growth", pricingType: "hybrid", billingPeriod: "monthly", currency: "NGN", price: 15000, includedSeats: 10, includedUsage: 50000, overageUnitPrice: 2, apiAccess: true, createdAt: "2025-01-10T12:30:00Z" },
    { id: "scale", productId: "prod_compute", name: "Enterprise Pro", description: "Robust structure for high-growth operations demanding generous allowances.", code: "scale", pricingType: "hybrid", billingPeriod: "monthly", currency: "NGN", price: 49000, includedSeats: 50, includedUsage: 250000, overageUnitPrice: 1.5, apiAccess: true, createdAt: "2025-01-10T12:30:00Z" },
  ];

  const entitlements: Entitlement[] = [
    { id: "ent_free_api", planId: "free", featureId: "feature_api_access", value: false, isEnabled: false, createdAt: "2025-01-10T12:30:00Z" },
    { id: "ent_free_brand", planId: "free", featureId: "feature_custom_branding", value: false, isEnabled: false, createdAt: "2025-01-10T12:30:00Z" },
    { id: "ent_free_support", planId: "free", featureId: "feature_dedicated_support", value: false, isEnabled: false, createdAt: "2025-01-10T12:30:00Z" },
    { id: "ent_free_sso", planId: "free", featureId: "feature_sso_auth", value: false, isEnabled: false, createdAt: "2025-01-10T12:30:00Z" },
    { id: "ent_growth_api", planId: "growth", featureId: "feature_api_access", value: true, isEnabled: true, createdAt: "2025-01-10T12:30:00Z" },
    { id: "ent_growth_brand", planId: "growth", featureId: "feature_custom_branding", value: false, isEnabled: true, createdAt: "2025-01-10T12:30:00Z" },
    { id: "ent_growth_support", planId: "growth", featureId: "feature_dedicated_support", value: false, isEnabled: false, createdAt: "2025-01-10T12:30:00Z" },
    { id: "ent_growth_sso", planId: "growth", featureId: "feature_sso_auth", value: false, isEnabled: false, createdAt: "2025-01-10T12:30:00Z" },
    { id: "ent_scale_api", planId: "scale", featureId: "feature_api_access", value: true, isEnabled: true, createdAt: "2025-01-10T12:30:00Z" },
    { id: "ent_scale_brand", planId: "scale", featureId: "feature_custom_branding", value: true, isEnabled: true, createdAt: "2025-01-10T12:30:00Z" },
    { id: "ent_scale_support", planId: "scale", featureId: "feature_dedicated_support", value: false, isEnabled: false, createdAt: "2025-01-10T12:30:00Z" },
    { id: "ent_scale_sso", planId: "scale", featureId: "feature_sso_auth", value: false, isEnabled: false, createdAt: "2025-01-10T12:30:00Z" },
  ];

  const customers: Customer[] = [
    {
      id: "linear", workspaceId: "ws_aora", name: "Linear Technology", domain: "linear.app", email: "billing@linear.app",
      logoColor: "bg-neutral-900 border-neutral-800 text-white", createdDate: "2025-02-14", planId: "growth", status: "active",
      seatsUsed: 8, usageUnits: 48200, paymentMethod: { brand: "Visa", last4: "4242", expiry: "12/28" },
      notes: [
        { id: "note_1", timestamp: "2026-05-10T14:30:00Z", text: "Customer completed automatic payment setup.", author: "System Server" },
        { id: "note_2", timestamp: "2026-06-01T09:00:00Z", text: "Requested inquiry regarding customized invoice timelines.", author: "Sarah Jenkins" },
      ],
      invoices: [
        { id: "INV-2026-005", amount: 15000, currency: "NGN", date: "2026-05-15", status: "paid", usageUnits: 41200 },
        { id: "INV-2026-004", amount: 15000, currency: "NGN", date: "2026-04-15", status: "paid", usageUnits: 38900 },
      ],
      contracts: [{ title: "Standard Growth Service Agreement", status: "signed", value: "₦15,000 / mo" }],
    },
    {
      id: "vercel", workspaceId: "ws_aora", name: "Vercel Inc", domain: "vercel.com", email: "billing@vercel.com",
      logoColor: "bg-black text-white", createdDate: "2024-11-20", planId: "scale", status: "active",
      seatsUsed: 12, usageUnits: 198000, paymentMethod: { brand: "American Express", last4: "0007", expiry: "11/29" },
      notes: [{ id: "note_4", timestamp: "2026-05-20T11:00:00Z", text: "Enquired about direct ACH payments for high volume discounts.", author: "Alexander Vance" }],
      invoices: [
        { id: "INV-2026-007", amount: 49000, currency: "NGN", date: "2026-05-25", status: "paid", usageUnits: 198000 },
        { id: "INV-2026-002", amount: 49000, currency: "NGN", date: "2026-04-25", status: "paid", usageUnits: 172000 },
      ],
      contracts: [],
    },
    {
      id: "retool", workspaceId: "ws_aora", name: "Retool Co", domain: "retool.com", email: "trial@retool.com",
      logoColor: "bg-rose-500 text-white", createdDate: "2026-06-01", planId: "free", status: "trial",
      seatsUsed: 1, usageUnits: 420, paymentMethod: null,
      notes: [{ id: "note_5", timestamp: "2026-06-01T08:00:00Z", text: "Onboarded automatically onto Starter Free trial pack.", author: "System Autopilot" }],
      invoices: [], contracts: [],
    },
    {
      id: "notion", workspaceId: "ws_sandbox", name: "Notion Enterprise", domain: "notion.so", email: "operations@notion.so",
      logoColor: "bg-amber-100 text-stone-900 border-stone-200", createdDate: "2025-05-01", planId: "growth", status: "active",
      seatsUsed: 14, usageUnits: 54000, paymentMethod: { brand: "Visa", last4: "1111", expiry: "06/30" },
      notes: [],
      invoices: [{ id: "INV-2026-008", amount: 23000, currency: "NGN", date: "2026-05-01", status: "past_due", usageUnits: 54000 }],
      contracts: [],
    },
    {
      id: "acme", workspaceId: "ws_acme", name: "Acme Corporation", domain: "acme.sh", email: "finance@acme.sh",
      logoColor: "bg-blue-600 text-white", createdDate: "2025-01-10", planId: "scale", status: "active",
      seatsUsed: 42, usageUnits: 265000, paymentMethod: { brand: "Mastercard", last4: "8821", expiry: "09/27" },
      notes: [{ id: "note_3", timestamp: "2026-06-02T16:00:00Z", text: "Upgraded automatically to scale plan to handle increased incoming telemetry flows.", author: "Engine Auto" }],
      invoices: [
        { id: "INV-2026-006", amount: 71500, currency: "NGN", date: "2026-05-10", status: "paid", usageUnits: 265000 },
        { id: "INV-2026-003", amount: 49000, currency: "NGN", date: "2026-04-10", status: "paid", usageUnits: 232000 },
      ],
      contracts: [{ title: "Enterprise Service Level SLA", status: "signed", value: "₦49,000 / mo" }],
    },
  ];

  const subscriptions: Subscription[] = [
    { id: "sub_1", customerId: "linear", planId: "growth", status: "active", currentPeriodStart: "2026-06-15T00:00:00Z", currentPeriodEnd: "2026-07-15T00:00:00Z", seatQuantity: 8, createdAt: "2025-02-14T00:00:00Z" },
    { id: "sub_2", customerId: "vercel", planId: "scale", status: "active", currentPeriodStart: "2026-06-25T00:00:00Z", currentPeriodEnd: "2026-07-25T00:00:00Z", seatQuantity: 12, createdAt: "2024-11-20T00:00:00Z" },
    { id: "sub_3", customerId: "retool", planId: "free", status: "trial", currentPeriodStart: "2026-06-01T00:00:00Z", currentPeriodEnd: "2026-07-01T00:00:00Z", trialEnd: "2026-07-01T00:00:00Z", seatQuantity: 1, createdAt: "2026-06-01T08:00:00Z" },
    { id: "sub_4", customerId: "notion", planId: "growth", status: "active", currentPeriodStart: "2026-06-01T00:00:00Z", currentPeriodEnd: "2026-07-01T00:00:00Z", seatQuantity: 14, createdAt: "2025-05-01T00:00:00Z" },
    { id: "sub_5", customerId: "acme", planId: "scale", status: "active", currentPeriodStart: "2026-06-10T00:00:00Z", currentPeriodEnd: "2026-07-10T00:00:00Z", seatQuantity: 42, createdAt: "2025-01-10T00:00:00Z" },
  ];

  const meters: MeterDefinition[] = [
    { id: "compute_meter", name: "Compute Server Usage", description: "Sum of analytical execution metrics measured in compute units.", aggregationType: "sum", targetField: "compute_units", status: "active" },
    { id: "api_meter", name: "API Operations Meter", description: "Aggregates absolute volume of custom REST endpoint triggers.", aggregationType: "count", targetField: "calls", status: "active" },
  ];

  const usageEvents: UsageEvent[] = [
    { id: "evt_1", customerId: "linear", meterId: "compute_meter", timestamp: "2026-06-14T22:30:00Z", value: 450, metadata: { source: "background_worker", task: "analytics_aggregation" } },
    { id: "evt_2", customerId: "acme", meterId: "compute_meter", timestamp: "2026-06-15T02:15:00Z", value: 1200, metadata: { source: "serverless_function" } },
    { id: "evt_3", customerId: "vercel", meterId: "api_meter", timestamp: "2026-06-15T01:00:00Z", value: 1, metadata: { endpoint: "/v2/deploy" } },
    { id: "evt_4", customerId: "notion", meterId: "compute_meter", timestamp: "2026-06-15T03:00:00Z", value: 80, metadata: { source: "data_ingest" } },
  ];

  const auditLogs: AuditLog[] = [
    { id: "aud_init_ws", workspaceId: "ws_aora", actor: "System Bootstrap", action: "CREATE", entityType: "WORKSPACE", entityId: "ws_aora", beforeState: null, afterState: { name: "Aora Technologies Ltd", environment: "production" }, createdAt: "2025-01-10T12:00:00Z" },
    { id: "aud_init_plan", workspaceId: "ws_aora", actor: "System Bootstrap", action: "CREATE", entityType: "PLAN", entityId: "growth", beforeState: null, afterState: { name: "Growth Scale", price: 15000, code: "growth" }, createdAt: "2025-01-10T12:35:00Z" },
  ];

  return {
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
    quotas: seedQuotas(),
    creditLedger: seedCreditLedger(),
    prices: seedPrices(),
    rateCards: seedRateCards(),
    discounts: seedDiscounts(),
    coupons: seedCoupons(),
    customContracts: seedContracts(),
    webhooks: [],
    webhookDeliveries: [],
  };
}

// ── Initialize on module load ──────────────────────────────────
initDatabase();
