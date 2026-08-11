import type { ReactNode } from "react";

export interface SEOProps {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article" | "product";
  image?: string;
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
  section?: string;
  tags?: string[];
  price?: number;
  currency?: string;
  availability?: string;
  brand?: string;
  sku?: string;
  ratingValue?: number;
  reviewCount?: number;
  faqs?: Array<{ question: string; answer: string }>;
  breadcrumbs?: Array<{ name: string; url: string }>;
  scripts?: Array<{ type: "application/ld+json"; innerHTML: string }>;
}

const SITE_URL = "https://aorahq.com";
const SITE_NAME = "AoraHQ";
const DEFAULT_IMAGE = `${SITE_URL}/og-default.png`;
const TWITTER_HANDLE = "@AoraHQ";

function escapeHtml(text) {
  return text
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, "\"")
    .replace(/'/g, "&#039;");
}

function buildJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data, null, 2);
}

function buildWebsiteSchema(seo: SEOProps): string {
  return buildJsonLd({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.png`,
      },
    },
  });
}

function buildWebPageSchema(seo: SEOProps): string {
  const base = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: seo.title,
    description: seo.description,
    url: `${SITE_URL}${seo.path}`,
    isPartOf: {
      "@id": `${SITE_URL}#website`,
    },
    about: {
      "@type": "Thing",
      name: "Billing Infrastructure",
    },
    mainEntity: {
      "@type": "Thing",
      name: seo.title,
      description: seo.description,
    },
  };

  if (seo.breadcrumbs?.length) {
    (base as Record<string, unknown>).breadcrumb = {
      "@type": "BreadcrumbList",
      itemListElement: seo.breadcrumbs.map((crumb, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: crumb.name,
        item: `${SITE_URL}${crumb.url}`,
      })),
    };
  }

  if (seo.faqs?.length) {
    (base as Record<string, unknown>).mainEntity = {
      "@type": "FAQPage",
      mainEntity: seo.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    };
  }

  return buildJsonLd(base);
}

function buildProductSchema(seo: SEOProps): string {
  if (!seo.price) return "";

  return buildJsonLd({
    "@context": "https://schema.org",
    "@type": "Product",
    name: seo.title,
    description: seo.description,
    image: seo.image || DEFAULT_IMAGE,
    sku: seo.sku,
    brand: {
      "@type": "Brand",
      name: seo.brand || SITE_NAME,
    },
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}${seo.path}`,
      price: seo.price,
      priceCurrency: seo.currency || "NGN",
      availability: seo.availability || "https://schema.org/InStock",
      priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    },
    aggregateRating: seo.ratingValue
      ? {
          "@type": "AggregateRating",
          ratingValue: seo.ratingValue,
          reviewCount: seo.reviewCount || 0,
          bestRating: 5,
          worstRating: 1,
        }
      : undefined,
  });
}

function buildArticleSchema(seo: SEOProps): string {
  if (seo.type !== "article") return "";

  return buildJsonLd({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: seo.title,
    description: seo.description,
    image: seo.image || DEFAULT_IMAGE,
    author: seo.authors?.map((name) => ({
      "@type": "Person",
      name,
    })) || [{ "@type": "Person", name: "AoraHQ Team" }],
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.png`,
      },
    },
    datePublished: seo.publishedTime,
    dateModified: seo.modifiedTime,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}${seo.path}`,
    },
    articleSection: seo.section,
    keywords: seo.tags?.join(", "),
  });
}

function buildSoftwareApplicationSchema(seo: SEOProps): string {
  return buildJsonLd({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Cloud",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "NGN",
      availability: "https://schema.org/InStock",
    },
    description: "Billing infrastructure for modern SaaS. Multi-gateway, usage-based pricing, entitlements, invoicing, and AI-powered revenue analytics.",
    featureList: [
      "Multi-gateway orchestration (Stripe, Paystack, Flutterwave)",
      "Usage metering and quota management",
      "Entitlements and feature gating",
      "Automated invoicing and revenue recognition",
      "Real-time analytics and MRR/ARR tracking",
      "AI-powered billing assistant",
    ],
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: 4.9,
      reviewCount: 127,
      bestRating: 5,
      worstRating: 1,
    },
    author: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
  });
}

function buildOrganizationSchema(): string {
  return buildJsonLd({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    alternateName: "Aora Billing OS",
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    sameAs: [
      "https://twitter.com/AoraHQ",
      "https://github.com/AoraHQ",
      "https://linkedin.com/company/aorahq",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+234-1-000-0000",
      contactType: "customer service",
      availableLanguage: ["English"],
    },
    address: {
      "@type": "PostalAddress",
      addressCountry: "NG",
      addressLocality: "Lagos",
    },
  });
}

export function generateMetaTags(seo: SEOProps): string {
  const url = `${SITE_URL}${seo.path}`;
  const image = seo.image || DEFAULT_IMAGE;
  const tags: string[] = [];

  tags.push(`<title>${escapeHtml(seo.title)}</title>`);
  tags.push(`<meta name="description" content="${escapeHtml(seo.description)}" />`);
  tags.push(`<link rel="canonical" href="${escapeHtml(url)}" />`);

  tags.push(`<meta property="og:type" content="${seo.type || "website"}" />`);
  tags.push(`<meta property="og:url" content="${escapeHtml(url)}" />`);
  tags.push(`<meta property="og:title" content="${escapeHtml(seo.title)}" />`);
  tags.push(`<meta property="og:description" content="${escapeHtml(seo.description)}" />`);
  tags.push(`<meta property="og:image" content="${escapeHtml(image)}" />`);
  tags.push(`<meta property="og:image:width" content="1200" />`);
  tags.push(`<meta property="og:image:height" content="630" />`);
  tags.push(`<meta property="og:site_name" content="${SITE_NAME}" />`);

  tags.push(`<meta name="twitter:card" content="summary_large_image" />`);
  tags.push(`<meta name="twitter:site" content="${TWITTER_HANDLE}" />`);
  tags.push(`<meta name="twitter:creator" content="${TWITTER_HANDLE}" />`);
  tags.push(`<meta name="twitter:url" content="${escapeHtml(url)}" />`);
  tags.push(`<meta name="twitter:title" content="${escapeHtml(seo.title)}" />`);
  tags.push(`<meta name="twitter:description" content="${escapeHtml(seo.description)}" />`);
  tags.push(`<meta name="twitter:image" content="${escapeHtml(image)}" />`);

  tags.push(`<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />`);

  if (seo.publishedTime) {
    tags.push(`<meta property="article:published_time" content="${seo.publishedTime}" />`);
  }
  if (seo.modifiedTime) {
    tags.push(`<meta property="article:modified_time" content="${seo.modifiedTime}" />`);
  }
  if (seo.authors?.length) {
    seo.authors.forEach((author) => {
      tags.push(`<meta property="article:author" content="${escapeHtml(author)}" />`);
    });
  }
  if (seo.section) {
    tags.push(`<meta property="article:section" content="${escapeHtml(seo.section)}" />`);
  }
  if (seo.tags?.length) {
    seo.tags.forEach((tag) => {
      tags.push(`<meta property="article:tag" content="${escapeHtml(tag)}" />`);
    });
  }

  return tags.join("\n");
}

export function generateJsonLd(seo: SEOProps): string {
  const schemas: string[] = [];

  schemas.push(buildOrganizationSchema());
  schemas.push(buildWebsiteSchema(seo));

  const pageSchema = seo.type === "article"
    ? buildArticleSchema(seo)
    : buildWebPageSchema(seo);
  if (pageSchema) schemas.push(pageSchema);

  const productSchema = buildProductSchema(seo);
  if (productSchema) schemas.push(productSchema);

  const softwareSchema = buildSoftwareApplicationSchema(seo);
  if (softwareSchema) schemas.push(softwareSchema);

  if (seo.scripts?.length) {
    schemas.push(...seo.scripts.map((s) => s.innerHTML));
  }

  return schemas.filter(Boolean).join("\n");
}


export function updateMetaTags(seo: SEOProps | undefined) {
  if (typeof document === "undefined" || !seo) return;

  const updateMeta = (name: string, content: string, property = false) => {
    const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
    let meta = document.querySelector(selector) as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      if (property) meta.setAttribute("property", name);
      else meta.setAttribute("name", name);
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", content);
  };

  const url = `${SITE_URL}${seo.path}`;
  const image = seo.image || DEFAULT_IMAGE;

  document.title = seo.title;
  updateMeta("description", seo.description);
  updateMeta("og:type", seo.type || "website", true);
  updateMeta("og:url", url, true);
  updateMeta("og:title", seo.title, true);
  updateMeta("og:description", seo.description, true);
  updateMeta("og:image", image, true);
  updateMeta("og:site_name", SITE_NAME, true);
  updateMeta("twitter:card", "summary_large_image");
  updateMeta("twitter:site", TWITTER_HANDLE);
  updateMeta("twitter:url", url);
  updateMeta("twitter:title", seo.title);
  updateMeta("twitter:description", seo.description);
  updateMeta("twitter:image", image);

  let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }
  canonical.setAttribute("href", url);
}

export const pageSEO = {
  landing: {
    title: "AoraHQ — Billing Infrastructure for Modern SaaS",
    description: "Multi-gateway billing orchestration, usage metering, entitlements, invoicing, and AI-powered revenue analytics. Connect Stripe, Paystack, Flutterwave in minutes.",
    path: "/",
    type: "website" as const,
    image: `${SITE_URL}/og-home.png`,
    faqs: [
      { question: "What gateways does AoraHQ support?", answer: "Stripe, Paystack, and Flutterwave are live. Monnify and SeerBit are in development." },
      { question: "Do I need to migrate existing subscriptions?", answer: "No. Keep current billing running while you configure AoraHQ. Flip the switch when ready." },
      { question: "What does it cost after the founder's plan?", answer: "Pricing starts at ₦0 for the first ₦1M in MRR processed. Transparent, usage-based pricing after that." },
      { question: "Is my data safe?", answer: "AES-256-GCM encryption at rest. Your API keys never touch disk in plaintext. SOC 2 audit in progress." },
    ],
    breadcrumbs: [{ name: "Home", url: "/" }],
  },
  waitlist: {
    title: "Join the AoraHQ Waitlist — Early Access & 3 Months Free",
    description: "Join 340+ founders building on AoraHQ. Get early access, dedicated onboarding call, and 3 months free on any tier — locked in for life.",
    path: "/waitlist",
    type: "website" as const,
    image: `${SITE_URL}/og-waitlist.png`,
    breadcrumbs: [{ name: "Home", url: "/" }, { name: "Waitlist", url: "/waitlist" }],
  },
  docs: {
    title: "AoraHQ Documentation — Implementation Guides & API Reference",
    description: "Complete documentation for AoraHQ billing infrastructure. Quickstart guides, API reference, webhook documentation, gateway setup, entitlements, usage metering, and invoicing.",
    path: "/docs",
    type: "website" as const,
    image: `${SITE_URL}/og-docs.png`,
    breadcrumbs: [{ name: "Home", url: "/" }, { name: "Documentation", url: "/docs" }],
  },
  pricing: {
    title: "AoraHQ Pricing — Transparent Usage-Based Billing",
    description: "Simple, predictable pricing. ₦0 for the first ₦1M MRR processed. No hidden fees. Scale with confidence using our hybrid pricing engine.",
    path: "/pricing",
    type: "website" as const,
    image: `${SITE_URL}/og-pricing.png`,
    breadcrumbs: [{ name: "Home", url: "/" }, { name: "Pricing", url: "/pricing" }],
  },
  dashboard: {
    title: "AoraHQ Dashboard — Revenue Operations Center",
    description: "Real-time MRR, ARR, churn, trial conversion, and revenue analytics. Manage customers, plans, subscriptions, and usage from one place.",
    path: "/dashboard",
    type: "website" as const,
    image: `${SITE_URL}/og-dashboard.png`,
    breadcrumbs: [{ name: "Home", url: "/" }, { name: "Dashboard", url: "/dashboard" }],
  },
  catalog: {
    title: "Product Catalog — Manage Plans & Features",
    description: "Create and manage products, plans, features, and pricing. Visual pricing builder with flat, usage-based, hybrid, tiered, and volume models.",
    path: "/catalog",
    type: "website" as const,
    image: `${SITE_URL}/og-catalog.png`,
    breadcrumbs: [{ name: "Home", url: "/" }, { name: "Catalog", url: "/catalog" }],
  },
  customers: {
    title: "Customer Management — Subscriptions & Usage",
    description: "View and manage all customers. Track subscription status, usage metrics, payment history, and entitlements in real time.",
    path: "/customers",
    type: "website" as const,
    image: `${SITE_URL}/og-customers.png`,
    breadcrumbs: [{ name: "Home", url: "/" }, { name: "Customers", url: "/customers" }],
  },
  subscriptions: {
    title: "Subscription Management — Lifecycle & Billing",
    description: "Full subscription lifecycle: trials, upgrades, downgrades, pauses, cancellations, and proration. Automated invoice generation and payment collection.",
    path: "/subscriptions",
    type: "website" as const,
    image: `${SITE_URL}/og-subscriptions.png`,
    breadcrumbs: [{ name: "Home", url: "/" }, { name: "Subscriptions", url: "/subscriptions" }],
  },
  usage: {
    title: "Usage Metering — Events, Quotas & Credits",
    description: "Ingest usage events at scale. Define meters, set quotas, grant credits, and track consumption in real time with our high-throughput ingestion API.",
    path: "/usage",
    type: "website" as const,
    image: `${SITE_URL}/og-usage.png`,
    breadcrumbs: [{ name: "Home", url: "/" }, { name: "Usage Metering", url: "/usage" }],
  },
  entitlements: {
    title: "Entitlements Engine — Feature Access Control",
    description: "Map features to plans. Real-time access checks with can-access API. Gate features behind plan tiers without redeploying code.",
    path: "/entitlements",
    type: "website" as const,
    image: `${SITE_URL}/og-entitlements.png`,
    breadcrumbs: [{ name: "Home", url: "/" }, { name: "Entitlements", url: "/entitlements" }],
  },
  invoices: {
    title: "Invoicing — Automated Billing & Revenue Recognition",
    description: "Generate, send, and track invoices automatically. Support for usage-based line items, proration, credits, and dunning workflows.",
    path: "/invoices",
    type: "website" as const,
    image: `${SITE_URL}/og-invoices.png`,
    breadcrumbs: [{ name: "Home", url: "/" }, { name: "Invoices", url: "/invoices" }],
  },
  analytics: {
    title: "Revenue Analytics — MRR, ARR, Churn & Cohorts",
    description: "Real-time financial intelligence. Track MRR/ARR, net revenue retention, churn by cohort, trial conversion, and plan performance.",
    path: "/analytics",
    type: "website" as const,
    image: `${SITE_URL}/og-analytics.png`,
    breadcrumbs: [{ name: "Home", url: "/" }, { name: "Analytics", url: "/analytics" }],
  },
  integrations: {
    title: "Integrations — Gateways, Webhooks & APIs",
    description: "Connect Stripe, Paystack, Flutterwave. Configure webhooks, manage gateway credentials, and monitor gateway events in real time.",
    path: "/integrations",
    type: "website" as const,
    image: `${SITE_URL}/og-integrations.png`,
    breadcrumbs: [{ name: "Home", url: "/" }, { name: "Integrations", url: "/integrations" }],
  },
  developers: {
    title: "Developer Docs — API Reference & SDKs",
    description: "Complete API reference for ingestion, subscriptions, customers, entitlements, and webhooks. TypeScript SDK, REST API, and code examples.",
    path: "/developers",
    type: "website" as const,
    image: `${SITE_URL}/og-developers.png`,
    breadcrumbs: [{ name: "Home", url: "/" }, { name: "Developers", url: "/developers" }],
  },
  gateways: {
    title: "Gateway Management — Connect & Monitor",
    description: "Securely connect payment gateways (Stripe, Paystack, Flutterwave). Encrypted credential storage, webhook verification, and live account health monitoring.",
    path: "/gateways",
    type: "website" as const,
    image: `${SITE_URL}/og-gateways.png`,
    breadcrumbs: [{ name: "Home", url: "/" }, { name: "Gateways", url: "/gateways" }],
  },
  reconciliation: {
    title: "Revenue Reconciliation — Gateway vs Internal",
    description: "Automated revenue reconciliation. Compare internal usage, invoices, and gateway payouts. Detect variances and audit discrepancies.",
    path: "/reconciliation",
    type: "website" as const,
    image: `${SITE_URL}/og-reconciliation.png`,
    breadcrumbs: [{ name: "Home", url: "/" }, { name: "Reconciliation", url: "/reconciliation" }],
  },
  portal: {
    title: "Customer Portal — Self-Service Billing",
    description: "White-labeled customer portal. Customers manage subscriptions, update payment methods, view invoices, and track usage.",
    path: "/portal",
    type: "website" as const,
    image: `${SITE_URL}/og-portal.png`,
    breadcrumbs: [{ name: "Home", url: "/" }, { name: "Customer Portal", url: "/portal" }],
  },
  settings: {
    title: "Settings — Workspace & Team",
    description: "Manage workspace settings, team members, audit logs, API keys, and billing preferences.",
    path: "/settings",
    type: "website" as const,
    image: `${SITE_URL}/og-settings.png`,
    breadcrumbs: [{ name: "Home", url: "/" }, { name: "Settings", url: "/settings" }],
  },
};

export function getDocPageSEO(docId: string, title: string, description: string): SEOProps {
  return {
    title: `${title} | AoraHQ Documentation`,
    description,
    path: `/docs/${docId}`,
    type: "article",
    section: "Documentation",
    publishedTime: new Date().toISOString(),
    modifiedTime: new Date().toISOString(),
    authors: ["AoraHQ Team"],
    tags: ["billing", "api", "documentation", "implementation"],
    breadcrumbs: [
      { name: "Home", url: "/" },
      { name: "Documentation", url: "/docs" },
      { name: title, url: `/docs/${docId}` },
    ],
  };
}