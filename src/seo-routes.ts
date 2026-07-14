import { useEffect } from "react";
import { updateMetaTags } from "./seo";

export function useSEO(seo: import("./seo").SEOProps) {
  useEffect(() => {
    updateMetaTags(seo);
  }, [seo.title, seo.description, seo.path, seo.image]);
}

export const routeSEO = {
  "/": {
    title: "AoraHQ — Billing Infrastructure for Modern SaaS",
    description: "Multi-gateway billing orchestration, usage metering, entitlements, invoicing, and AI-powered revenue analytics. Connect Stripe, Paystack, Flutterwave in minutes.",
    path: "/",
    type: "website" as const,
    image: "https://aorahq.com/og-home.png",
  },
  "/waitlist": {
    title: "Join the AoraHQ Waitlist — Early Access & 3 Months Free",
    description: "Join 340+ founders building on AoraHQ. Get early access, dedicated onboarding call, and 3 months free on any tier — locked in for life.",
    path: "/waitlist",
    type: "website" as const,
    image: "https://aorahq.com/og-waitlist.png",
  },
  "/docs": {
    title: "AoraHQ Documentation — Implementation Guides & API Reference",
    description: "Complete documentation for AoraHQ billing infrastructure. Quickstart guides, API reference, webhook documentation, gateway setup, entitlements, usage metering, and invoicing.",
    path: "/docs",
    type: "website" as const,
    image: "https://aorahq.com/og-docs.png",
  },
  "/dashboard": {
    title: "AoraHQ Dashboard — Revenue Operations Center",
    description: "Real-time MRR, ARR, churn, trial conversion, and revenue analytics. Manage customers, plans, subscriptions, and usage from one place.",
    path: "/dashboard",
    type: "website" as const,
    image: "https://aorahq.com/og-dashboard.png",
  },
  "/catalog": {
    title: "Product Catalog — AoraHQ Dashboard",
    description: "Manage your product catalog, plans, features, and pricing configurations. Create hybrid, usage-based, per-seat, and tiered pricing models.",
    path: "/catalog",
    type: "website" as const,
  },
  "/customers": {
    title: "Customers — AoraHQ Dashboard",
    description: "Manage your customer base. View subscriptions, usage, invoices, and entitlements per customer.",
    path: "/customers",
    type: "website" as const,
  },
  "/subscriptions": {
    title: "Subscriptions — AoraHQ Dashboard",
    description: "View and manage all subscriptions. Track status, billing cycles, trials, pauses, and cancellations.",
    path: "/subscriptions",
    type: "website" as const,
  },
  "/usage": {
    title: "Usage Metering — AoraHQ Dashboard",
    description: "Ingest usage events, track quotas, manage credits, and monitor consumption in real-time.",
    path: "/usage",
    type: "website" as const,
  },
  "/entitlements": {
    title: "Entitlements — AoraHQ Dashboard",
    description: "Configure feature access, map features to plans, and gate functionality in real-time.",
    path: "/entitlements",
    type: "website" as const,
  },
  "/invoices": {
    title: "Invoices — AoraHQ Dashboard",
    description: "Generate, view, and manage invoices. Track payment status, overdue amounts, and revenue recognition.",
    path: "/invoices",
    type: "website" as const,
  },
  "/analytics": {
    title: "Revenue Analytics — AoraHQ Dashboard",
    description: "Real-time MRR, ARR, churn rate, trial conversion, cohort analysis, and plan performance metrics.",
    path: "/analytics",
    type: "website" as const,
  },
  "/integrations": {
    title: "Integrations — AoraHQ Dashboard",
    description: "Connect your payment gateways, webhooks, and third-party services. Manage Stripe, Paystack, Flutterwave connections.",
    path: "/integrations",
    type: "website" as const,
  },
  "/developers": {
    title: "Developer Console — AoraHQ Dashboard",
    description: "API keys, webhook endpoints, API playground, and integration testing tools.",
    path: "/developers",
    type: "website" as const,
  },
  "/gateways": {
    title: "Gateway Management — AoraHQ Dashboard",
    description: "Connect and manage payment gateways. Configure Stripe, Paystack, Flutterwave with encrypted API keys.",
    path: "/gateways",
    type: "website" as const,
  },
  "/reconciliation": {
    title: "Revenue Reconciliation — AoraHQ Dashboard",
    description: "Compare internal revenue with gateway data. Identify discrepancies and ensure accurate financial reporting.",
    path: "/reconciliation",
    type: "website" as const,
  },
  "/portal": {
    title: "Customer Portal — AoraHQ Dashboard",
    description: "Self-service portal for your customers. Manage subscriptions, view invoices, update payment methods.",
    path: "/portal",
    type: "website" as const,
  },
  "/settings": {
    title: "Settings — AoraHQ Dashboard",
    description: "Configure workspace, team members, billing preferences, and security settings.",
    path: "/settings",
    type: "website" as const,
  },
  "/pricing": {
    title: "AoraHQ Pricing — Transparent Usage-Based Billing",
    description: "Simple, predictable pricing. ₦0 for the first ₦1M MRR processed. No hidden fees. Scale with confidence.",
    path: "/pricing",
    type: "website" as const,
    image: "https://aorahq.com/og-pricing.png",
  },
};

export function getRouteSEO(path: string) {
  return routeSEO[path as keyof typeof routeSEO] || routeSEO["/"];
}