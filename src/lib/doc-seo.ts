import { useEffect } from "react";
import { updateMetaTags, getDocPageSEO } from "./seo";

export function useDocSEO(docId: string, title: string, description: string) {
  useEffect(() => {
    const seo = getDocPageSEO(docId, title, description);
    updateMetaTags(seo);
  }, [docId, title, description]);
}

export const docPages: Record<string, { title: string; description: string; faqs?: Array<{ question: string; answer: string }> }> = {
  intro: {
    title: "Overview & Introduction",
    description: "Understand Aora Billing Operating System — a multi-gateway, developer-first billing platform. Learn core concepts, architecture, and why teams choose AoraHQ over Stripe Billing, Chargebee, and Lago.",
  },
  quickstart: {
    title: "Quick Start Guide",
    description: "Integrate billing in 5 minutes. Create your first product, connect a gateway, ingest usage events, and generate your first invoice. Complete with code examples.",
    faqs: [
      { question: "What do I need to start?", answer: "A Stripe, Paystack, or Flutterwave account. An AoraHQ workspace. Node.js 18+ or Python 3.10+." },
      { question: "How long does integration take?", answer: "Most teams go live in under 30 minutes for basic usage-based billing." },
    ],
  },
  architecture: {
    title: "System Architecture",
    description: "Deep dive into AoraHQ's high-throughput telemetry ingestion, rating loops, billing schedulers, and dual-data sync for revenue reconciliation.",
  },
  conceptsProducts: {
    title: "Products & Plans Catalog",
    description: "Structured pricing models: flat, per-seat, usage-based, hybrid, tiered, volume, and package pricing. Change pricing without redeploying.",
  },
  conceptsUsage: {
    title: "Usage Metering Ingestion",
    description: "Tracking usage units at scale. Deduplicating high-speed payload feeds. Idempotency keys, bulk import, and real-time aggregation.",
  },
  conceptsEntitlements: {
    title: "Entitlement Gate Engine",
    description: "Enforcing API locks, feature limits, and subscription guards. Real-time can-access checks with <10ms latency.",
  },
  devKeys: {
    title: "Authentication & API Keys",
    description: "Generate sk_live secret headers, authenticate SDK calls safely, rotate keys without downtime, and scope permissions per environment.",
  },
  playground: {
    title: "Interactive API Terminal",
    description: "Try posting events or querying entitlement can-access metrics live in the browser. Test your integration before writing code.",
  },
  apiReference: {
    title: "API Reference",
    description: "Complete REST API reference for customers, subscriptions, usage events, entitlements, invoices, webhooks, and gateway management.",
  },
  webhooks: {
    title: "Webhook Documentation",
    description: "Configure webhook endpoints, verify signatures, handle retries, and debug gateway events. Supported events for Stripe, Paystack, Flutterwave.",
  },
  gatewaysStripe: {
    title: "Stripe Gateway Setup",
    description: "Connect your Stripe account, configure webhook endpoints, verify signatures, and manage multiple Stripe accounts per workspace.",
  },
  gatewaysPaystack: {
    title: "Paystack Gateway Setup",
    description: "Connect Paystack, configure webhooks, handle Nigerian compliance requirements, and manage NGN/USD currencies.",
  },
  gatewaysFlutterwave: {
    title: "Flutterwave Gateway Setup",
    description: "Connect Flutterwave, configure webhook verification, handle multi-currency payouts across Africa, and manage transaction fees.",
  },
  sdksTypescript: {
    title: "TypeScript SDK",
    description: "Install @aorahq/sdk. Type-safe ingestion, subscription management, entitlement checks, and real-time webhook handlers.",
  },
  sdksPython: {
    title: "Python SDK",
    description: "Install aorahq-python. Django/Flask/FastAPI integration, async ingestion, webhook verification, and Celery task support.",
  },
  migration: {
    title: "Migration Guide",
    description: "Migrate from Stripe Billing, Chargebee, Lago, or Metronome. Data import tools, parallel run strategy, and cutover checklist.",
  },
  bestPractices: {
    title: "Best Practices",
    description: "Idempotency keys, quota design, webhook reliability, testing strategies, and cost optimization for high-volume billing.",
  },
  troubleshooting: {
    title: "Troubleshooting",
    description: "Common issues: webhook failures, ingestion latency, quota exceeded errors, gateway connectivity, and reconciliation mismatches.",
  },
  backendProration: {
    title: "Proration Service",
    description: "Seat-based pricing mid-cycle adjustments with high-precision financial mathematics and non-custodial gateway charging.",
  },
  backendIngress: {
    title: "Fair Ingress Metering",
    description: "Byte-size billing for usage event ingestion with Redis counter buffering and PostgreSQL flush.",
  },
  backendDedup: {
    title: "24-Hour Deduplication Engine",
    description: "Two-layer Redis/Postgres dedup preventing duplicate billing within a 24-hour sliding window.",
  },
  backendBatch: {
    title: "Batch Ingestion",
    description: "Bulk event ingestion with pipelined dedup, batch discount pricing, and aggregated ledger writes.",
  },
  backendSandbox: {
    title: "Sandbox Playground",
    description: "Test billing flows with sk_test_ API keys, simulated payments, and time-travel without touching real gateways.",
  },
  backendEncryption: {
    title: "Zero-Trust Credential Encryption",
    description: "AES-256-GCM encryption for merchant gateway API keys. Keys never exist in plaintext in the database.",
  },
  backendWebhooks: {
    title: "Secure Webhook Dispatcher",
    description: "Transactional outbox pattern, HMAC-SHA256 signing, and BullMQ-backed exponential backoff retries for bulletproof webhook delivery.",
  },
  backendDunning: {
    title: "Dunning & Retry State Machine",
    description: "3-step automated dunning retry lifecycle with SERIALIZABLE transactions, FOR UPDATE SKIP LOCKED safety, and transactional outbox integration.",
  },
} as const;

export type DocPageId = keyof typeof docPages;

export function getDocSEO(pageId: DocPageId) {
  const page = docPages[pageId as DocPageId];
  if (!page) return null;
  return {
    title: `${page.title} | AoraHQ Documentation`,
    description: page.description,
    path: `/docs/${pageId}`,
    type: "article" as const,
    section: "Documentation",
    publishedTime: new Date("2024-01-01").toISOString(),
    modifiedTime: new Date().toISOString(),
    authors: ["AoraHQ Team"],
    tags: ["billing", "api", "documentation", "implementation", pageId],
    faqs: page.faqs,
    breadcrumbs: [
      { name: "Home", url: "/" },
      { name: "Documentation", url: "/docs" },
      { name: page.title, url: `/docs/${pageId}` },
    ],
  };
}