# AoraHQ — The Billing Orchestration Engine

## Core Narrative

Billing is the last great piece of infrastructure that forces every SaaS to reinvent the wheel. Stripe gave you payment processing. Chargebee gave you subscription management. But neither solved the real problem: **billing is not just collecting money. Billing is your product's circulatory system.**

AoraHQ is the orchestration layer between how you charge and what you build.

---

## Positioning

**One-liner:**
> Bring your gateway. Keep your data. Own your billing logic.

**Elevator pitch:**
Stop copy-pasting billing code between Stripe, Paystack, and Flutterwave. AoraHQ is a developer-first billing engine where you bring your own payment keys, and we handle everything between the API call and the invoice — pricing logic, usage metering, entitlements, dunning, revenue analytics, and reconciliation. Your secrets stay encrypted. Your money never touches us. Your billing is finally as sophisticated as your product.

**Target audience:**
- SaaS startups scaling past $10k MRR who feel the friction of hardcoded billing
- Developer tools and platforms whose customers need flexible pricing models
- Multi-region teams using Paystack for Africa, Stripe globally, Flutterwave for Francophone Africa — one dashboard to rule them all
- Technical founders who want to ship pricing experiments, not maintain billing code

---

## Brand Voice

**Tone: authoritative, warm, precise.**

This is a technical product for technical people. Speak to their intelligence. No marketing fluff. No "revolutionize your billing." Instead:

- "You built a great product. Let's make sure you get paid for every bit of value it creates."
- "Your API keys stay encrypted at rest. We decrypt them in memory, use them once, and forget them. Zero persistence of sensitive material beyond the request lifecycle."
- "Flat, hybrid, tiered, volume, package, per-seat — if you can dream the pricing model, our engine can compute it."

---

## Visual Identity Direction

| Element | Direction |
|---|---|
| Palette | Deep navy (#0F172A), electric cyan (#06B6D4), warm amber (#F59E0B) for financial accents |
| Typography | Inter (UI), JetBrains Mono (code/dashboard) — technical but polished |
| Iconography | System-style line icons — think Stripe's clarity meets Linear's precision |
| Data viz | Clean, minimal charts on dark glass surfaces. Recharts with custom dark theme. |
| Vibe | A banking dashboard designed by developers, for developers |

---

## Page Structure

### Above the Fold

**Headline:**
> Billing infrastructure that bends to your business model.

**Subhead:**
> A developer-first billing orchestration engine. Bring your Stripe, Paystack, or Flutterwave keys. We handle pricing, metering, entitlements, and revenue analytics in one unified platform. Zero asset custody. Full encryption. Infinite flexibility.

**Primary CTA:**
> "Connect Your Gateway" — opens a modal with gateway selection and key input.

**Secondary CTA:**
> "See How It Works" — scrolls to an animated walkthrough.

**Visual:**
A split-screen dashboard mockup showing:
- Left: Gateway connection screen with Stripe/Paystack/Flutterwave cards
- Right: Live revenue metrics (MRR, active subscriptions, usage events ingested)

---

### The Problem (Sticky Section)

Rendered as three panes that stay visible while scrolling through details:

| Pain Point | The Old Way | AoraHQ |
|---|---|---|
| **Multi-gateway** | Couple your codebase to Stripe's SDK. Switching to Paystack means rewiring your entire billing pipeline. | Abstracted adapter layer — swap gateways with a config change. Same billing logic, different payment rail. |
| **Pricing flexibility** | Hardcode `if (plan === 'pro')` everywhere. Each pricing experiment is a deployment. | Declarative pricing engine — flat, hybrid, tiered, volume, package, per-seat. Change pricing in the UI, not in the code. |
| **Key security** | Store API keys in `.env` or worse, in the database in plaintext. Rotating keys means downtime. | AES-256-GCM encryption at rest. Decrypted in-memory per request. Never logged. Never exposed. |
| **Revenue visibility** | Piece together Stripe data, usage metrics from your DB, and manual spreadsheet reconciliation. | Real-time dual-data sync — usage events from your product + payment events from your gateway, reconciled automatically. |

---

### The Product (Visual Feature Blocks)

#### 1. BYOK — Bring Your Own Keys

> Pick your payment gateway, paste your keys, and go. We never store them in plaintext — AES-256-GCM encrypts them before they touch disk. Decrypted in-memory per request, then forgotten.

Visual: Key input with show/hide toggle, gateway logo, "Verified" green checkmark animation.

#### 2. Pricing Engine

> Flat, per-seat, usage-based, hybrid, tiered, volume, package — our engine handles them all. Change pricing in the dashboard without a deployment. Add overage calculations. Set minimum spends. Run experiments.

Visual: Interactive widget — toggle between pricing models and see live invoice preview change.

#### 3. Usage Metering

> Ingestion endpoint for usage events. Bulk import via CSV. Quota tracking. Credit ledger with grant/deduct. Aggregate usage per customer per billing period.

Visual: Stream graph showing event ingestion in real-time, with quota bars per customer.

#### 4. Entitlements

> Map features to plans. Check access in real-time. Gate features behind plan tiers. Change entitlement rules without redeploying.

Visual: Feature matrix — toggle features on/off per plan, see the UI preview update.

#### 5. Invoicing & Revenue Analytics

> Full lifecycle — draft → open → paid/past_due. Line items per subscription. MRR, ARR, churn, trial conversion, plan performance — computed from your actual payment data.

Visual: Dashboard with revenue charts, invoice list, and dunning status indicators.

#### 6. AI Billing Assistant

> Powered by Gemini. Ask "Show me customers with past due invoices" or "Create a new usage-based plan for my enterprise tier." Natural language. Real results.

Visual: Chat bubble with billing-focused prompts.

---

### Competitive Positioning

| What they say | What they actually mean | Our answer |
|---|---|---|
| "Stripe Billing" | Locked into Stripe. No Paystack. No Flutterwave. | **Gateway-agnostic.** Your gateway, your choice. |
| "Chargebee" | Rigid pricing models. Migration headache. Expensive at scale. | **Developer-first.** Declarative pricing engine. No vendor lock-in. |
| "Metronome / Lago" | Strong metering but weak invoicing. Young infrastructure. | **Full orchestration.** Pricing + metering + invoicing + revenue analytics in one stack. |

---

### Social Proof (Placeholder sections)

> "We switched from hardcoded Stripe billing to AoraHQ in two days. The pricing engine alone saved us weeks of development."
> — CTO, B2B SaaS Company

> "AoraHQ let us offer Paystack for our Nigerian customers and Stripe for our US customers from one dashboard. Our billing team stopped maintaining two codebases."
> — Head of Engineering, Pan-African SaaS

> "The AI assistant is dangerously useful. I built a new enterprise tier in under a minute without touching code."
> — Founder, Developer Tools Startup

---

### Bottom of Page

**Headline:**
> Your billing infrastructure should be an asset, not a tax.

**Subhead:**
> Stop maintaining billing code. Start shipping your product.

**CTA:**
> "Connect Your Gateway" (repeated)

**Footer:**
- Product: Gateway abstraction, pricing engine, usage metering, entitlements, invoicing, revenue analytics, AI assistant
- Developers: API reference (OpenAPI), BYOK setup guides, webhook docs, pricing model handbook
- Company: About, Blog, Changelog, Status
- Legal: Privacy, Terms, SOC 2 (coming soon)
- "Built with TypeScript, CockroachDB, and stubbornness."

---

## Design System Notes

**Motion:**
- Page load: staggered fade-in with upward drift (100ms interval between sections)
- Scroll-triggered reveal: sections slide in from opposite sides (L/R alternating)
- CTA: subtle pulse glow on hover — transforms from solid to gradient
- Gateway verification: micro-animation showing key → lock → checkmark cycle (~800ms)
- Revenue charts: draw-on-scroll using Motion's `useInView` + SVG path length

**Micro-interactions:**
- Key input: character-by-character reveal animation when show/hide toggled
- Navigation: active state underline slides between links
- Feature cards: tilt on hover (3D transform, subtle), expand on click with smooth height transition
- Dashboard mockups: slow auto-scroll (marquee behavior) showing real data

**Surface & Depth:**
- Base: `#0F172A` (slate-900)
- Surface: `#1E293B` (slate-800) with `rgba(255,255,255,0.03)` inner border
- Elevated: `#334155` (slate-700) with 2px `rgba(6,182,212,0.1)` border accent
- Glass panels: `rgba(15,23,42,0.8)` backdrop with `backdrop-filter: blur(24px)`
- Shadows: large ambient + small directional, both using `rgba(0,0,0,0.4)`

---

## Build Recommendations

| Component | Approach | Peak file count |
|---|---|---|
| Structure | `components/landing/` — one file per section (Hero, Problem, Features, Pricing, CTA, Footer) | 8-10 |
| Animations | `motion` library (already in deps) — `useInView`, `AnimatePresence`, staggered containers | Shared utilities |
| Mockups | Inline SVG with CSS animation — no heavy screenshot assets | 3-4 SVGs |
| Code samples | `shiki` for syntax highlighting if needed, or simple `<pre>` with Tailwind typography | Utility component |
| Responsive | Mobile-first via Tailwind breakpoints — the nav collapses to hamburger, features stack vertically | Handled by CSS |
| Framework check | Vite + React 19 + Tailwind v4 + Motion (framer-motion successor) — all already in `package.json` | N/A |

No new dependencies. Everything needed (React 19, Motion, Tailwind v4, Recharts) is already installed.
