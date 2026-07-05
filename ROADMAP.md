# AoraHQ — Product Roadmap

## The Vision

A developer-first, cloud-based billing orchestration and usage-based metering engine. Customers bring their own Stripe/Paystack/Flutterwave keys (BYOK), AoraHQ handles the billing logic. Zero asset custody — we never touch the money.

## What's Already Built

- **Full billing dashboard** — 21 React components covering plans, pricing, entitlements, usage metering, customer portal, invoices, revenue ops, analytics, webhooks, settings
- **Express REST API** — 14 route modules with full CRUD for all billing entities
- **CockroachDB persistence** — 22 repository modules, serializable transactions, migration system, connection pooling with retry logic
- **Pricing engine** — flat, per-seat, usage, hybrid, tiered, volume, and package pricing with overage calculation
- **Usage metering** — event ingestion, bulk import, aggregates, quotas, credit ledger with grant/deduct
- **Entitlement engine** — plan-to-feature mapping with real-time access checks
- **Invoice system** — draft → open → paid/past_due lifecycle, line items
- **Webhook system** — endpoint management, HMAC signing, delivery logs, test endpoint
- **Discounts & coupons** — percentage/fixed, validation, redemption tracking
- **Custom contracts** — per-customer overrides for base fee, seat price, overage, minimum spend
- **AI billing assistant** — Gemini-powered chat that can create plans, add notes, answer revenue questions
- **Audit logging** — append-only ledger for all entity mutations
- **Revenue analytics** — MRR, ARR, churn, trial conversion, plan performance

---

## Phase 1: Gateway Abstraction Layer

**Goal**: Define clean interfaces so the billing engine never depends on a specific payment gateway.

### 1.1 Gateway Interface

Define a TypeScript interface (`PaymentGatewayAdapter`) that every adapter must implement:

```typescript
interface PaymentGatewayAdapter {
  // Identity
  name: string;
  capabilities: GatewayCapabilities;

  // Customers
  createCustomer(data: CreateCustomerParams): Promise<GatewayCustomer>;
  updateCustomer(id: string, data: UpdateCustomerParams): Promise<GatewayCustomer>;
  findCustomer(email: string): Promise<GatewayCustomer | null>;

  // Payment methods
  attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<GatewayPaymentMethod>;
  listPaymentMethods(customerId: string): Promise<GatewayPaymentMethod[]>;

  // Subscriptions
  createSubscription(data: CreateSubscriptionParams): Promise<GatewaySubscription>;
  updateSubscription(id: string, data: UpdateSubscriptionParams): Promise<GatewaySubscription>;
  cancelSubscription(id: string): Promise<GatewaySubscription>;
  listSubscriptions(customerId: string): Promise<GatewaySubscription[]>;

  // Invoices & payments
  createInvoice(data: CreateInvoiceParams): Promise<GatewayInvoice>;
  finalizeInvoice(id: string): Promise<GatewayInvoice>;
  payInvoice(id: string): Promise<GatewayInvoice>;
  voidInvoice(id: string): Promise<GatewayInvoice>;

  // Usage records (for gateways that support it, like Stripe)
  recordUsage(subscriptionItemId: string, quantity: number): Promise<void>;

  // Webhook verification
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean;

  // Event mapping — translate gateway event → AoraHQ internal event
  mapWebhookEvent(event: any): GatewayWebhookEvent | null;
}
```

### 1.2 Gateway Connection Model

New table/entity to store customer gateway connections:

```typescript
interface GatewayConnection {
  id: string;
  workspaceId: string;
  gateway: "stripe" | "paystack" | "flutterwave";
  mode: "live" | "test";
  // Encrypted at rest. Never logged or returned in API responses.
  encryptedApiKey: string;
  encryptedWebhookSecret: string | null;
  // Read-only metadata from the gateway (e.g., Stripe account name, payout schedule)
  gatewayAccountId: string | null;
  gatewayAccountName: string | null;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
  // Last 4 chars of the key (for UI display only)
  keyPreview: string;
}
```

### 1.3 Gateway Adapters Package

New directory: `src/gateways/`

```
src/gateways/
├── adapter.ts            # Base interface + types
├── registry.ts           # Adapter registry (getAdapter("stripe"))
├── stripe/
│   ├── index.ts          # StripeAdapter implementation
│   └── webhooks.ts       # Stripe webhook event mapper
├── paystack/
│   ├── index.ts          # PaystackAdapter implementation
│   └── webhooks.ts       # Paystack webhook event mapper
├── flutterwave/
│   ├── index.ts          # FlutterwaveAdapter implementation
│   └── webhooks.ts       # Flutterwave webhook event mapper
├── encryption.ts         # AES-256-GCM key encryption/decryption
├── key-validator.ts      # Validate API keys via gateway API
└── index.ts              # Re-exports
```

### 1.4 API Routes

```
POST   /api/gateways/connect        # Store encrypted API key + validate
GET    /api/gateways                # List connected gateways per workspace
DELETE /api/gateways/:id            # Disconnect (remove encrypted key)
POST   /api/gateways/:id/verify     # Re-verify gateway connectivity
GET    /api/gateways/:id/account    # Get gateway account info
```

**Files to create**: 10-12 new source files

---

## Phase 2: BYOK Onboarding & Key Management

**Goal**: Let developers paste their gateway keys from the UI and validate connectivity in real-time.

### 2.1 UI — Gateway Connect Screen

New view in the dashboard:

- Gateway selection cards (Stripe, Paystack, Flutterwave)
- Key input field with show/hide toggle
- Mode toggle (Live / Test)
- "Verify Connection" button that calls the gateway API to validate the key
- Success state showing gateway account name, email, and payout schedule
- Error state with actionable messages (wrong permissions, invalid key format, network error)

### 2.2 UI — Gateway Management

- List of connected gateways with status indicators (connected, expired, error)
- Per-gateway detail: mode, account name, last verified, webhook setup status
- Disconnect confirmation flow
- Webhook URL display + "Copy" button (the URL AoraHQ provides for the gateway)

### 2.3 Key Encryption Service

- AES-256-GCM encrypt API keys before storing in CockroachDB
- Keys are decrypted only in the adapter layer at request time
- Never logged, never returned in API responses, never sent to the frontend
- Encryption key sourced from `GATEWAY_ENCRYPTION_KEY` env var (must be 32 bytes, hex-encoded)

### 2.4 Restricted Key Scoping

Document recommended restricted key permissions per gateway:

| Gateway | Required Permissions |
|---|---|
| Stripe | `charges:write`, `customers:read`, `subscriptions:write`, `products:read`, `invoice:write`, `webhook:write` |
| Paystack | `charge`, `customer`, `subscription`, `invoice`, `webhook` |
| Flutterwave | `charge`, `customer`, `subscription`, `invoice`, `webhook` |

**Files to create**: 3-4 new UI components, encryption module, 4-5 backend files

---

## Phase 3: Dual-Data Sync Engine

**Goal**: Combine internal usage metrics with payment events from gateways for real-time revenue analytics.

### 3.1 Gateway Webhook Ingestion

A dedicated webhook endpoint per gateway that receives payment events:

```
POST /api/gateways/webhooks/stripe
POST /api/gateways/webhooks/paystack
POST /api/gateways/webhooks/flutterwave
```

Each endpoint:
1. Verifies the webhook signature using the stored secret
2. Maps the gateway event to an internal `GatewayEvent` type
3. Stores the raw event in a `gateway_events` table (append-only)
4. Dispatches to the relevant handler

### 3.2 Gateway Events Table

```sql
CREATE TABLE gateway_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id),
    gateway         STRING(20) NOT NULL,
    event_type      STRING(100) NOT NULL,     -- e.g. "charge.success", "invoice.payment_succeeded"
    gateway_event_id STRING(255) NOT NULL,    -- idempotency key from gateway
    customer_id     UUID REFERENCES customers(id),
    raw_payload      JSONB NOT NULL,           -- original gateway payload
    mapped_data      JSONB,                    -- normalized AoraHQ event data
    status          STRING(20) NOT NULL DEFAULT 'received' CHECK (status IN ('received','processed','skipped','failed')),
    processed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE INDEX idx_gateway_event_id (gateway, gateway_event_id),
    INDEX idx_gateway_events_ws (workspace_id, created_at DESC),
    INDEX idx_gateway_events_unprocessed (status, created_at) WHERE status = 'received'
) LOCALITY REGIONAL BY TABLE IN PRIMARY REGION;
```

### 3.3 Event Handlers

Each gateway event type maps to a handler:

| Gateway Event | Handler | Effect |
|---|---|---|
| `charge.success` | `handlePaymentSuccess` | Mark invoice as paid, update revenue metrics |
| `charge.failed` | `handlePaymentFailed` | Mark invoice as past_due, trigger dunning |
| `invoice.payment_succeeded` | `handleInvoicePaid` | Update invoice status, log payment |
| `invoice.payment_failed` | `handleInvoiceFailed` | Update invoice status, increment dunning attempt |
| `customer.subscription.created` | `handleSubscriptionCreated` | Sync subscription status |
| `customer.subscription.updated` | `handleSubscriptionUpdated` | Sync plan/status changes |
| `customer.subscription.deleted` | `handleSubscriptionDeleted` | Mark subscription as canceled |

### 3.4 Revenue Reconciliation

New API endpoint that cross-references internal usage metrics with gateway payment data:

```
GET /api/analytics/reconciliation?from=&to=&customerId=
```

Returns:
- Internal usage totals per customer per period
- Gateway invoice amounts per customer per period
- Variance (if any) between internal calculation and gateway charges
- Unbilled usage events (tracked internally but not yet invoiced on the gateway)

### 3.5 Dashboard — Revenue Sync View

New tab showing:
- Last sync timestamp per gateway
- Event processing status (received → processed count)
- Failed webhook deliveries with retry button
- Reconciliation summary with variance alerts

**Files to create**: 1 migration, gateway events repo, event handler module, reconciliation service, 2-3 UI views, 2 route files

---

## Phase 4: Gateway-Agnostic Billing Operations

**Goal**: All billing CRUD operations work through the gateway abstraction, not directly on local data.

### 4.1 Sync Architecture

When a billing operation happens on AoraHQ, the flow becomes:

```
User action → AoraHQ validates → Gateway adapter executes → Gateway confirms → AoraHQ records
```

Example — create subscription:
```
1. User creates customer + plan in AoraHQ dashboard
2. AoraHQ calls stripeAdapter.createCustomer() + stripeAdapter.createSubscription()
3. Stripe returns subscription ID and status
4. AoraHQ stores the gateway subscription ID + maps gateway's period dates
5. Stripe sends invoice.paid webhook → AoraHQ records the payment
6. Dashboard shows "active" with real payment data from Stripe
```

### 4.2 Subscription Sync

New fields on subscriptions table:
```sql
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS gateway_subscription_id STRING(255);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS gateway_customer_id STRING(255);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS gateway_status STRING(50);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
```

### 4.3 Invoice Sync

New fields on invoices table:
```sql
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gateway_invoice_id STRING(255);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gateway_payment_intent_id STRING(255);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gateway_hosted_url STRING(2048);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gateway_pdf_url STRING(2048);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
```

### 4.4 Dunning Management

When a payment fails on the gateway:
1. Gateway sends `invoice.payment_failed` webhook
2. AoraHQ marks invoice as past_due
3. Dunning service sends sequential reminder emails (day 1, 3, 7, 14)
4. Optionally re-attempt payment via the gateway (configurable per workspace)
5. If unresolved after max attempts, mark subscription as canceled

### 4.5 Usage-Based Billing on Gateways

For gateways that support usage records (Stripe):
- After ingesting usage events, periodically push aggregated usage to the gateway
- Gateway includes usage charges in the next invoice
- AoraHQ tracks last-pushed usage to avoid double-billing

### 4.6 UI — Gateway Status Indicators

Throughout the dashboard:
- Subscription card shows gateway sync status (synced, pending, error)
- Invoice list shows gateway invoice ID + hosted URL
- Customer detail shows gateway customer ID
- Manual "Sync Now" button on any record

**Files to create**: Migration, syncing service, dunning module, 3-4 backend files, UI updates to existing views

---

## Phase 5: Go Runtime (Long-Term — Evaluate at Scale)

**Goal**: Migrate the billing engine core to Go for higher throughput, lower latency, and better concurrency for usage event processing.

### 5.1 When to Consider

- Usage event ingestion exceeds 5,000 events/second
- API response latency under load degrades past acceptable thresholds
- Node.js event loop becomes a bottleneck for concurrent billing operations
- Team has Go expertise to maintain dual runtimes

### 5.2 Migration Strategy

**Step 1 — Extract the billing engine**:
Pull pricing calculation, usage aggregation, and invoice computation into a standalone Go module that communicates with the Node.js API via gRPC or HTTP.

```
Current: Node.js API → CockroachDB
Target:  Node.js API → Go Billing Engine → CockroachDB
```

**Step 2 — Gateway adapters in Go**:
Port the gateway adapter interfaces to Go. The Go engine handles all gateway communication, webhook verification, and event processing.

**Step 3 — Event ingestion in Go**:
The highest-throughput path (usage event ingestion) runs in Go with native goroutine concurrency. Events are buffered, batched, and written to CockroachDB in bulk.

**Step 4 — Full migration**:
Once the Go engine handles all billing operations, the Node.js layer becomes a thin API gateway + frontend server. New Go services are added incrementally.

### 5.3 What Stays in TypeScript

- Dashboard UI (React stays indefinitely)
- API routing (Express stays as the HTTP layer)
- AI billing assistant (Gemini SDK integration)
- Admin and configuration interfaces

**Files to create**: Entirely new Go module — estimate 15-20+ Go source files for the engine core

---

## Phase 6: Production Hardening

**Goal**: Make AoraHQ production-ready for multi-tenant SaaS deployment.

### 6.1 Multi-Tenant Enforcement Audit

- Every repository method must bind `workspace_id` — no tenant-leakage paths
- Rate limiter per-workspace (not just per-IP)
- API key authentication for programmatic access
- Row-Level Security policies in CockroachDB

### 6.2 Observability

- Structured JSON logging with request IDs
- OpenTelemetry instrumentation for traces across the gateway → engine → DB path
- Prometheus metrics: event ingestion rate, invoice generation latency, gateway error rate
- Health check endpoint with deep DB connectivity check + gateway connectivity check

### 6.3 Error Recovery

- Dead letter queue for failed webhook deliveries (retry with exponential backoff, max 5 attempts)
- Invoice generation idempotency keys
- Usage event idempotency via `dedupeId` / `idempotencyKey`
- Automated reconciliation alerting when internal vs. gateway data diverges

### 6.4 Documentation

- API reference with OpenAPI 3.1 spec
- BYOK setup guide per gateway (Stripe, Paystack, Flutterwave)
- Webhook event reference with example payloads
- Pricing model handbook (flat, hybrid, tiered, volume explained)
- Migration guide for teams coming from Chargebee, Recharge, Lago, or Stripe Billing

---

## Effort Summary

| Phase | Source Files | Dependencies | Risk | Can Ship Independently |
|---|---|---|---|---|
| **1. Gateway Abstraction** | 12-15 | `stripe`, paystack SDK, flutterwave SDK | Low-Medium | Yes |
| **2. BYOK Onboarding** | 8-10 | Encryption lib | Low | Yes (needs Phase 1) |
| **3. Dual-Data Sync** | 12-15 | None beyond Phase 1 | Medium | Yes (needs Phases 1-2) |
| **4. Billing Operations** | 8-12 | None beyond Phase 1 | Medium | Yes |
| **5. Go Runtime** | 15-20+ | Go toolchain, gRPC | High | No (depends on scale need) |
| **6. Production Hardening** | 10-15 | OpenTelemetry, Prometheus | Low | Yes (parallel to any phase) |

**Total estimate**: 65-85+ new source files across all phases

---

## Go-to-Market Recommendation

Ship in this order:

1. **Phases 1 + 2** together — "Connect Your Gateway" is the headline feature. Without both, BYOK doesn't work. This is the MVP that validates the core value prop.

2. **Phase 6 in parallel** — Observability and multi-tenancy hardening are prerequisites for any customer beyond the first beta.

3. **Phase 3** — Dual-data sync unlocks the revenue analytics differentiator. Without it, you're just a billing UI. With it, you show real MRR, churn, and LTV computed from the customer's actual payment data.

4. **Phase 4** — Full gateway-agnostic operations turn AoraHQ from a "dashboard" into the actual billing orchestration engine. This is the moat.

5. **Phase 5** — Only when the Node.js bottleneck becomes measurable. The current stack handles thousands of events/sec with proper CockroachDB indexing and connection pooling. Premature optimization here would stall feature velocity.
