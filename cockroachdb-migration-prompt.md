# Aora Billing OS — CockroachDB Migration Prompt

## Objective

Replace the current JSON-file persistence (`billing_db.json`) with **CockroachDB** as the primary datastore. The migration must preserve zero data loss, maintain multi-tenant isolation across workspaces, support high-volume usage event ingestion, and provide serializable isolation for all billing-critical transactions.

---

## 1. CockroachDB Cluster Architecture

| Concern | Recommendation |
|---|---|
| **Deployment** | CockroachDB Dedicated (CockroachCloud) or Self-Hosted on Kubernetes (3+ nodes, 5+ recommended) |
| **Region** | Multi-region if global (e.g., `aws-eu-west-1`, `aws-us-east-1`, `aws-ap-southeast-1`) with `GLOBAL` tables for low-latency reads |
| **Node count** | Minimum 3, recommended 5 for survivability |
| **Replication factor** | 5 for production |
| **Backup** | Full cluster backup every 6h via `BACKUP INTO`, point-in-time recovery (PITR) with 7-day retention |
| **Connection** | Node.js via `pg` (node-postgres) with CockroachDB connection string (`postgresql://user:password@host:26257/aora?sslmode=verify-full`) |

---

## 2. Database & Schema DDL

All DDL statements below are CockroachDB-compliant. Each model is derived from the canonical `src/api/types.ts` interfaces. CockroachDB-specific features used: `UUID` for PKs, `FAMILY` for hot-column grouping, `GLOBAL`/`REGIONAL BY TABLE` for multi-region, computed columns for search, hash-sharded indexes for write-heavy tables.

```sql
-- ============================================================
-- 2.1  Database creation
-- ============================================================
CREATE DATABASE IF NOT EXISTS aora_billing;
USE aora_billing;

-- For multi-region (if applicable):
-- ALTER DATABASE aora_billing PRIMARY REGION "aws-eu-west-1";
-- ALTER DATABASE aora_billing ADD REGION "aws-us-east-1";
-- ALTER DATABASE aora_billing ADD REGION "aws-ap-southeast-1";

-- ============================================================
-- 2.2  Global reference tables (rarely updated, read-heavy)
-- ============================================================

CREATE TABLE organizations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        STRING(255) NOT NULL,
    status      STRING(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- CockroachDB: GLOBAL table for fast reads from any region
) LOCALITY GLOBAL;

CREATE TABLE workspaces (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            STRING(255) NOT NULL,
    environment     STRING(20) NOT NULL DEFAULT 'production' CHECK (environment IN ('production', 'sandbox', 'development')),
    api_keys        STRING[] NOT NULL DEFAULT ARRAY[]::STRING[],
    -- JSONB blobs for flexible profile/settings (rarely queried individually)
    profile         JSONB NOT NULL DEFAULT '{}'::JSONB,
    settings        JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE INDEX idx_workspaces_name_env (organization_id, name, environment)
) LOCALITY GLOBAL;

CREATE TABLE members (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email        STRING(320) NOT NULL,
    role         STRING(20) NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'billing_manager', 'developer', 'viewer')),
    permissions  STRING[] NOT NULL DEFAULT ARRAY['read']::STRING[],
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE INDEX idx_members_ws_email (workspace_id, email)
) LOCALITY GLOBAL;

-- ============================================================
-- 2.3  Product catalog (read-heavy, moderate write)
-- ============================================================

CREATE TABLE products (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name         STRING(255) NOT NULL,
    description  STRING(1000) NOT NULL DEFAULT '',
    is_archived  BOOL NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    INDEX idx_products_workspace (workspace_id) STORING (name, is_archived)
) LOCALITY GLOBAL;

CREATE TABLE features (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    slug         STRING(255) NOT NULL,
    name         STRING(255) NOT NULL,
    description  STRING(1000) NOT NULL DEFAULT '',
    type         STRING(20) NOT NULL CHECK (type IN ('boolean', 'limit')),
    is_archived  BOOL NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE INDEX idx_features_ws_slug (workspace_id, slug)
) LOCALITY GLOBAL;

CREATE TABLE plans (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id        UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name              STRING(255) NOT NULL,
    description       STRING(1000) NOT NULL DEFAULT '',
    code              STRING(100),
    currency           STRING(10) NOT NULL DEFAULT 'USD',
    price             DECIMAL(18,4) NOT NULL DEFAULT 0,
    billing_period     STRING(20) NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('monthly', 'yearly')),
    included_seats    INT NOT NULL DEFAULT 0,
    included_usage    DECIMAL(18,4) NOT NULL DEFAULT 0,
    overage_unit_price DECIMAL(18,4) NOT NULL DEFAULT 0,
    api_access        BOOL NOT NULL DEFAULT false,
    pricing_type      STRING(20) CHECK (pricing_type IN ('flat', 'per_seat', 'usage', 'hybrid')),
    is_archived       BOOL NOT NULL DEFAULT false,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    INDEX idx_plans_product (product_id) STORING (name, price, billing_period, is_archived)
) LOCALITY GLOBAL;

CREATE TABLE entitlements (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id    UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    feature_id UUID NOT NULL REFERENCES features(id) ON DELETE CASCADE,
    value      JSONB NOT NULL DEFAULT 'true'::JSONB,  -- boolean, number, or string
    is_enabled BOOL NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE INDEX idx_entitlements_plan_feature (plan_id, feature_id)
) LOCALITY GLOBAL;

-- ============================================================
-- 2.4  Pricing model (versioned, write-once mostly)
-- ============================================================

CREATE TABLE prices (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id           UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    name              STRING(255) NOT NULL,
    type              STRING(20) NOT NULL CHECK (type IN ('flat','usage','seat','tiered','volume','package','hybrid','custom_contract')),
    billing_period     STRING(20) NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('monthly','yearly','quarterly','unlimited')),
    currency           STRING(10) NOT NULL DEFAULT 'USD',
    base_fee          DECIMAL(18,4) NOT NULL DEFAULT 0,
    seat_price        DECIMAL(18,4),
    included_seats    INT,
    meter_id          UUID REFERENCES meter_definitions(id),
    included_usage    DECIMAL(18,4),
    overage_unit_price DECIMAL(18,4),
    tiers             JSONB,       -- array of {upTo, unitPrice, flatFee}
    volume_pricing    BOOL NOT NULL DEFAULT false,
    package_size      INT,
    package_price     DECIMAL(18,4),
    version           INT NOT NULL DEFAULT 1,
    is_active         BOOL NOT NULL DEFAULT true,
    is_archived       BOOL NOT NULL DEFAULT false,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    INDEX idx_prices_plan_active (plan_id, is_active) STORING (type, base_fee, version)
) LOCALITY GLOBAL;

CREATE TABLE rate_cards (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           STRING(255) NOT NULL,
    description    STRING(1000) NOT NULL DEFAULT '',
    meter_id       UUID NOT NULL REFERENCES meter_definitions(id),
    price_type     STRING(20) NOT NULL CHECK (price_type IN ('flat','tiered','volume','package')),
    unit_price     DECIMAL(18,4),
    tiers          JSONB,
    included_units DECIMAL(18,4),
    currency       STRING(10) NOT NULL DEFAULT 'USD',
    is_active      BOOL NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
) LOCALITY GLOBAL;

CREATE TABLE discounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            STRING(255) NOT NULL,
    type            STRING(20) NOT NULL CHECK (type IN ('percentage', 'fixed')),
    value           DECIMAL(18,4) NOT NULL,
    applies_to      STRING(20) NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all', 'base_fee', 'overage', 'seat_fee')),
    duration        STRING(20) NOT NULL DEFAULT 'once' CHECK (duration IN ('once', 'forever', 'repeating')),
    duration_months INT,
    is_deleted      BOOL NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
) LOCALITY GLOBAL;

CREATE TABLE coupons (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            STRING(255) NOT NULL,
    discount_id     UUID NOT NULL REFERENCES discounts(id) ON DELETE CASCADE,
    code            STRING(100) NOT NULL,
    is_active       BOOL NOT NULL DEFAULT true,
    expire_at       TIMESTAMPTZ,
    max_redemptions INT,
    times_redeemed  INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE INDEX idx_coupons_code (code)
) LOCALITY GLOBAL;

-- ============================================================
-- 2.5  Customers & Subscriptions (heavy read/write)
-- ============================================================

CREATE TABLE customers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name            STRING(255) NOT NULL,
    domain          STRING(320) NOT NULL DEFAULT '',
    email           STRING(320) NOT NULL,
    logo_color      STRING(100) NOT NULL DEFAULT '',
    created_date    DATE NOT NULL DEFAULT current_date,
    plan_id         UUID REFERENCES plans(id),
    status          STRING(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'trial', 'paused')),
    payment_method  JSONB,
    seats_used      INT NOT NULL DEFAULT 0,
    usage_units     DECIMAL(18,4) NOT NULL DEFAULT 0,
    notes           JSONB NOT NULL DEFAULT '[]'::JSONB,   -- array of CustomerNote
    invoices        JSONB NOT NULL DEFAULT '[]'::JSONB,   -- array of embedded Invoice (stored for fast list views)
    contracts       JSONB NOT NULL DEFAULT '[]'::JSONB,   -- array of embedded contract info
    is_deleted      BOOL NOT NULL DEFAULT false,
    deleted_at      TIMESTAMPTZ,

    INDEX idx_customers_workspace (workspace_id) STORING (name, email, status, plan_id),
    INDEX idx_customers_status (status) WHERE NOT is_deleted,
    UNIQUE INDEX idx_customers_ws_email (workspace_id, email) WHERE NOT is_deleted
) LOCALITY REGIONAL BY TABLE IN PRIMARY REGION;  -- regional: customers are local to their region

CREATE TABLE subscriptions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id         UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    plan_id             UUID NOT NULL REFERENCES plans(id),
    status              STRING(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trial', 'canceled', 'paused')),
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end   TIMESTAMPTZ NOT NULL,
    trial_end           TIMESTAMPTZ,
    canceled_at         TIMESTAMPTZ,
    paused_at           TIMESTAMPTZ,
    resume_at           TIMESTAMPTZ,
    cancel_at_period_end BOOL NOT NULL DEFAULT false,
    seat_quantity       INT NOT NULL DEFAULT 1,
    metadata            JSONB DEFAULT '{}'::JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    INDEX idx_subscriptions_customer (customer_id),
    INDEX idx_subscriptions_status (status),
    INDEX idx_subscriptions_period_end (current_period_end) WHERE status IN ('active', 'trial')
) LOCALITY REGIONAL BY TABLE IN PRIMARY REGION;

-- ============================================================
-- 2.6  Invoices (append-heavy, immutable after finalization)
-- ============================================================

CREATE TABLE invoices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id),
    customer_id     UUID NOT NULL REFERENCES customers(id),
    subscription_id UUID REFERENCES subscriptions(id),
    amount          DECIMAL(18,4) NOT NULL,
    currency        STRING(10) NOT NULL DEFAULT 'USD',
    status          STRING(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('paid','open','past_due','draft','void')),
    usage_units     DECIMAL(18,4) NOT NULL DEFAULT 0,
    period_start    TIMESTAMPTZ,
    period_end      TIMESTAMPTZ,
    issued_at       TIMESTAMPTZ,
    finalized_at    TIMESTAMPTZ,
    paid_at         TIMESTAMPTZ,
    voided_at       TIMESTAMPTZ,
    line_items      JSONB NOT NULL DEFAULT '[]'::JSONB,  -- InvoiceLineItem[]
    metadata        JSONB DEFAULT '{}'::JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    INDEX idx_invoices_customer (customer_id, status) STORING (amount, currency),
    INDEX idx_invoices_workspace (workspace_id, created_at DESC),
    INDEX idx_invoices_due (status, created_at) WHERE status = 'open' OR status = 'past_due'
) LOCALITY REGIONAL BY TABLE IN PRIMARY REGION;

-- ============================================================
-- 2.7  Usage Metering (EXTREMELY write-heavy, append-only)
-- ============================================================

-- Hash-sharded indexes prevent hotspotting on sequential UUIDs
CREATE TABLE meter_definitions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name             STRING(255) NOT NULL,
    description      STRING(1000) NOT NULL DEFAULT '',
    aggregation_type  STRING(20) NOT NULL CHECK (aggregation_type IN ('sum','count','max','latest','min','average')),
    target_field     STRING(255) NOT NULL DEFAULT '',
    slug             STRING(255),
    event_source     STRING(255),
    unit             STRING(100),
    status           STRING(20) NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','archived'))
) LOCALITY GLOBAL;

-- Usage events: append-only, never updated. Immutable audit trail.
CREATE TABLE usage_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    meter_id    UUID NOT NULL REFERENCES meter_definitions(id),
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT now(),
    value       DECIMAL(18,4) NOT NULL,
    metadata    JSONB DEFAULT '{}'::JSONB,

    -- Hash-sharded index on (customer_id, meter_id) for fast ingestion with no hot-spots
    INDEX idx_usage_lookup (customer_id, meter_id) USING HASH WITH BUCKET_COUNT = 16
        STORING (value, timestamp),
    INDEX idx_usage_time (meter_id, timestamp DESC)
) LOCALITY REGIONAL BY TABLE IN PRIMARY REGION;

-- Materialized aggregation: pre-computed usage per (customer, meter, period)
-- Updated via application logic or CDC-based materialization
CREATE TABLE usage_aggregates (
    customer_id UUID NOT NULL,
    meter_id    UUID NOT NULL,
    period      STRING(10) NOT NULL,            -- '2026-06' for monthly, '2026-06-15' for daily
    period_type STRING(10) NOT NULL CHECK (period_type IN ('hourly','daily','weekly','monthly','yearly')),
    total_value DECIMAL(18,4) NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (customer_id, meter_id, period_type, period),
    FAMILY f_main (total_value, updated_at)  -- hot path: only update value
);

CREATE TABLE quotas (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    meter_id    UUID NOT NULL REFERENCES meter_definitions(id),
    limit_value DECIMAL(18,4) NOT NULL,
    used_value  DECIMAL(18,4) NOT NULL DEFAULT 0,
    period      STRING(20) NOT NULL CHECK (period IN ('hourly','daily','weekly','monthly','yearly','unlimited')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE INDEX idx_quotas_customer_meter (customer_id, meter_id, period)
);

CREATE TABLE credit_ledger (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    amount      DECIMAL(18,4) NOT NULL,          -- positive = issued, negative = consumed
    type        STRING(20) NOT NULL CHECK (type IN ('credit_issued','credit_consumed','credit_expired','credit_reversed')),
    description STRING(500) NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expire_at   TIMESTAMPTZ,

    INDEX idx_credit_customer (customer_id, created_at DESC)
);

-- Running credit balance (materialized from credit_ledger)
-- Refreshed on INSERT to credit_ledger via application
CREATE TABLE credit_balances (
    customer_id UUID PRIMARY KEY REFERENCES customers(id),
    balance     DECIMAL(18,4) NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2.8  Custom Contracts
-- ============================================================

CREATE TABLE custom_contracts (
    id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id                  UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name                         STRING(255) NOT NULL,
    custom_base_fee              DECIMAL(18,4) NOT NULL DEFAULT 0,
    custom_seat_price            DECIMAL(18,4),
    custom_overage_unit_price    DECIMAL(18,4),
    minimum_spend                DECIMAL(18,4),
    additional_discount_percentage DECIMAL(5,2),
    expire_at                    TIMESTAMPTZ NOT NULL,
    is_deleted                   BOOL NOT NULL DEFAULT false,
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),

    INDEX idx_contracts_customer (customer_id) WHERE NOT is_deleted
) LOCALITY GLOBAL;

-- ============================================================
-- 2.9  Audit Logs (append-only, immutable)
-- ============================================================

CREATE TABLE audit_logs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    actor        STRING(255) NOT NULL DEFAULT 'System',
    action       STRING(20) NOT NULL CHECK (action IN ('CREATE','UPDATE','DELETE','ACCESS_VERIFY','ADJUST')),
    entity_type  STRING(30) NOT NULL,
    entity_id    UUID NOT NULL,
    before_state JSONB,
    after_state  JSONB,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    INDEX idx_audit_workspace (workspace_id, created_at DESC),
    INDEX idx_audit_entity (entity_type, entity_id, created_at DESC)
) LOCALITY REGIONAL BY TABLE IN PRIMARY REGION;

-- ============================================================
-- 2.10  Webhooks
-- ============================================================

CREATE TABLE webhook_endpoints (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    url          STRING(2048) NOT NULL,
    description  STRING(500),
    events       STRING[] NOT NULL DEFAULT ARRAY[]::STRING[],  -- empty = listen to all
    secret       STRING(64) NOT NULL,
    is_active    BOOL NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    INDEX idx_webhook_ws (workspace_id)
) LOCALITY GLOBAL;

CREATE TABLE webhook_deliveries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id      UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
    event           STRING(50) NOT NULL,
    payload         JSONB NOT NULL,
    status          STRING(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('delivered','failed','pending')),
    http_status     INT,
    attempts        INT NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    INDEX idx_delivery_webhook (webhook_id, created_at DESC),
    INDEX idx_delivery_pending (status, created_at) WHERE status = 'pending'
) LOCALITY REGIONAL BY TABLE IN PRIMARY REGION;

-- ============================================================
-- 2.11  Schema Migrations Tracking
-- ============================================================

CREATE TABLE schema_migrations (
    version     INT PRIMARY KEY,
    description STRING(500) NOT NULL,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    checksum    STRING(64)    -- SHA-256 of migration content
);
```

---

## 3. CockroachDB-Specific Design Decisions

### 3.1 Locality Patterns

| Table | Locality | Rationale |
|---|---|---|
| `organizations`, `workspaces`, `members`, `products`, `features`, `plans`, `entitlements`, `prices`, `rate_cards`, `discounts`, `coupons`, `custom_contracts`, `webhook_endpoints`, `meter_definitions` | `GLOBAL` | Rarely updated, read from any region with low latency. Follow-the-workload is unnecessary. |
| `customers`, `subscriptions`, `invoices`, `usage_events`, `usage_aggregates`, `quotas`, `credit_ledger`, `credit_balances`, `audit_logs`, `webhook_deliveries` | `REGIONAL BY TABLE` | Pin to the primary region. These are write-heavy and benefit from region pinning to avoid cross-region latency. If true multi-region is required, use `REGIONAL BY ROW` with a `region` column on `customers`. |

### 3.2 Index Strategy

- **Hash-sharded indexes** on `usage_events(customer_id, meter_id)` — eliminates range-hotspot issues for sequential UUID ingestion at high throughput.
- **Partial indexes** (e.g., `invoices WHERE status = 'open'`) — reduce index size for status-specific queries.
- **Covering indexes** with `STORING` — avoid round-trips to primary key for common access patterns.
- **Descending indexes** on time columns (`created_at DESC`) — optimize "most recent first" queries.

### 3.3 JSONB vs Normalized Columns

- **Profile/settings** on workspaces → `JSONB` (schema-flexible, rarely queried individually).
- **Tiers** on prices/rate_cards → `JSONB` (array of structured objects, always read/written together).
- **Line items** on invoices → `JSONB` (immutable after finalization, no benefit to normalization).
- **Customer notes/invoices/contracts** → `JSONB` on customers table (denormalized for fast list views; canonical invoices live in `invoices` table).
- **Payment method** → `JSONB` (PCI-relevant fields should never be stored; only token/brand/last4/expiry).

### 3.4 Immutable Tables (Append-Only)

These tables should **never** receive `UPDATE` or `DELETE` in application code:

| Table | Constraint |
|---|---|
| `usage_events` | Audit trail. Use `INSERT` only. |
| `audit_logs` | Immutable ledger. Use `INSERT` only. |
| `invoices` (once `finalized_at` is set) | Set `finalized_at` and disallow further changes. |
| `credit_ledger` | Append-only journal. Balance is materialized in `credit_balances`. |

---

## 4. Connection Pool Configuration

```typescript
// src/api/db/pool.ts
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 50,                          // max concurrent clients
  idleTimeoutMillis: 30_000,        // close idle clients after 30s
  connectionTimeoutMillis: 5_000,   // fail fast if DB unreachable
  statement_timeout: 10_000,        // cancel slow queries
  application_name: 'aora_billing',
  // CockroachDB-specific:
  // ssl: { rejectUnauthorized: true, ca: fs.readFileSync('/path/to/ca.crt') },
});

pool.on('error', (err) => {
  console.error('Unexpected pool error:', err);
});

export default pool;

// For CockroachDB SERIALIZABLE isolation (required for billing transactions):
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    // CRDB retry code 40001 — automatic retry
    if (err.code === '40001') {
      return withTransaction(fn);
    }
    throw err;
  } finally {
    client.release();
  }
}
```

### Retry Logic for Serializable Isolation

CockroachDB uses SERIALIZABLE isolation, which may return retry errors (`40001`). Use this client-side retry loop:

```typescript
async function retryable<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  let attempts = 0;
  const maxAttempts = 15;
  while (true) {
    try {
      return await withTransaction(fn);
    } catch (err: any) {
      if (err.code === '40001' && attempts < maxAttempts) {
        const backoff = Math.min(2 ** attempts * 0.1, 2); // 100ms, 200ms, 400ms, ... 2s
        await new Promise(r => setTimeout(r, backoff * 1000));
        attempts++;
        continue;
      }
      throw err;
    }
  }
}
```

---

## 5. Repository Layer (DAO Pattern)

All database access goes through repository modules. Each file exports stateless functions that take a `client` parameter (for transactional composition) or use the pool directly.

### Directory Structure

```
src/api/db/
├── pool.ts                  # Connection pool + withTransaction
├── migrations/              # SQL migration files (versioned)
│   ├── 001_initial_schema.sql
│   └── 002_add_indexes.sql
├── repositories/
│   ├── organization.repo.ts
│   ├── workspace.repo.ts
│   ├── product.repo.ts
│   ├── plan.repo.ts
│   ├── customer.repo.ts
│   ├── subscription.repo.ts
│   ├── invoice.repo.ts
│   ├── meter.repo.ts
│   ├── usage.repo.ts
│   ├── quota.repo.ts
│   ├── credit.repo.ts
│   ├── entitlement.repo.ts
│   ├── audit.repo.ts
│   └── webhook.repo.ts
└── index.ts                 # Re-export all repos
```

### Example Repository

```typescript
// src/api/db/repositories/customer.repo.ts
import type pg from 'pg';
import pool from '../pool';

export interface CustomerRow {
  id: string;
  workspace_id: string;
  name: string;
  domain: string;
  email: string;
  status: string;
  seats_used: number;
  // ...
}

export async function findByWorkspace(
  workspaceId: string,
  page: number,
  limit: number
): Promise<{ rows: CustomerRow[]; total: number }> {
  const offset = (page - 1) * limit;
  const { rows } = await pool.query(
    `SELECT id, name, email, domain, status, seats_used, usage_units, created_date
     FROM customers
     WHERE workspace_id = $1 AND NOT is_deleted
     ORDER BY created_date DESC
     LIMIT $2 OFFSET $3`,
    [workspaceId, limit, offset]
  );
  const { rows: [{ count }] } = await pool.query(
    `SELECT count(*)::int AS count FROM customers
     WHERE workspace_id = $1 AND NOT is_deleted`,
    [workspaceId]
  );
  return { rows, total: count };
}

export async function findById(client: pg.PoolClient, id: string): Promise<CustomerRow | null> {
  const { rows } = await client.query(
    `SELECT * FROM customers WHERE id = $1 AND NOT is_deleted`,
    [id]
  );
  return rows[0] ?? null;
}
```

---

## 6. Billing Transaction Patterns

### 6.1 Create Invoice (multi-step, single transaction)

```typescript
async function createInvoice(
  customerId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<InvoiceRow> {
  return retryable(async (client) => {
    // 1. Lock customer row (prevents race conditions)
    const { rows: [customer] } = await client.query(
      `SELECT id, plan_id, seats_used, workspace_id FROM customers
       WHERE id = $1 FOR UPDATE`,
      [customerId]
    );

    // 2. Get subscription and plan
    const { rows: [sub] } = await client.query(
      `SELECT plan_id, seat_quantity FROM subscriptions
       WHERE customer_id = $1 AND status IN ('active', 'trial')
       FOR UPDATE`,
      [customerId]
    );
    const { rows: [plan] } = await client.query(
      `SELECT * FROM plans WHERE id = $1`,
      [sub.plan_id]
    );

    // 3. Get usage for period
    const { rows: [agg] } = await client.query(
      `SELECT COALESCE(SUM(value), 0) AS total_usage
       FROM usage_events
       WHERE customer_id = $1 AND meter_id = $2
         AND timestamp >= $3 AND timestamp < $4`,
      [customerId, plan.meter_id, periodStart, periodEnd]
    );

    // 4. Calculate line items
    const lineItems = calculateLineItems(plan, customer, agg.total_usage);

    // 5. Insert invoice
    const { rows: [invoice] } = await client.query(
      `INSERT INTO invoices
         (workspace_id, customer_id, subscription_id, amount, currency,
          status, usage_units, period_start, period_end, line_items)
       VALUES ($1, $2, $3, $4, $5, 'open', $6, $7, $8, $9)
       RETURNING *`,
      [customer.workspace_id, customerId, sub.id, lineItems.total, plan.currency,
       agg.total_usage, periodStart, periodEnd, JSON.stringify(lineItems.items)]
    );

    // 6. Audit log
    await client.query(
      `INSERT INTO audit_logs
         (workspace_id, actor, action, entity_type, entity_id, after_state)
       VALUES ($1, $2, 'CREATE', 'INVOICE', $3, $4)`,
      [customer.workspace_id, 'System', invoice.id, JSON.stringify(invoice)]
    );

    return invoice;
  });
}
```

### 6.2 Record Usage Event

```typescript
async function recordUsage(
  customerId: string,
  meterId: string,
  value: number,
  metadata: Record<string, any> = {},
  timestamp: Date = new Date()
): Promise<void> {
  // No transaction needed — single atomic INSERT
  await pool.query(
    `INSERT INTO usage_events (customer_id, meter_id, timestamp, value, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [customerId, meterId, timestamp.toISOString(), value, JSON.stringify(metadata)]
  );

  // Fire-and-forget aggregate update
  const period = formatPeriod(timestamp, 'monthly');
  pool.query(
    `UPSERT INTO usage_aggregates (customer_id, meter_id, period_type, period, total_value, updated_at)
     VALUES ($1, $2, 'monthly', $3, COALESCE(
       (SELECT total_value FROM usage_aggregates
        WHERE customer_id = $1 AND meter_id = $2 AND period_type = 'monthly' AND period = $3), 0
     ) + $4, now())`,
    [customerId, meterId, period, value]
  ).catch(err => console.error('Aggregate update failed:', err));
}
```

---

## 7. Migration Strategy

### Phase 1: Dual-Write (Zero Downtime)

1. Deploy the new CockroachDB cluster and run the DDL from Section 2.
2. Generate a snapshot of existing data from `billing_db.json` into a migration script.
3. Run a one-time backfill (`INSERT ... SELECT` or JSON import) into CockroachDB.
4. Modify the application to write to **both** JSON file and CockroachDB simultaneously. Compare and alert on divergence.
5. Run in dual-write mode for 1–2 billing cycles to validate correctness.

### Phase 2: Cutover

1. Run a reconciliation query: compare row counts and checksums between JSON and CockroachDB.
2. Flip a feature flag: new reads come from CockroachDB, writes still go to both.
3. After 24h of clean reads, stop writing to JSON file entirely.
4. Archive the JSON file for historical reference.

### Phase 3: Optimize

1. Enable hash-sharded indexes on `usage_events` if write throughput exceeds 1K events/sec.
2. Set up `CHANGEFEED` for real-time data streaming to analytics/audit sinks.
3. Configure automatic `BACKUP INTO` with PITR.
4. Add `REGIONAL BY ROW` for customer data if multi-region becomes necessary.

---

## 8. Configuration

```env
# .env
DATABASE_URL=postgresql://aora:password@localhost:26257/aora_billing?sslmode=verify-full&application_name=aora_billing
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=50
DATABASE_IDLE_TIMEOUT=30000
DATABASE_STATEMENT_TIMEOUT=10000
```

---

## 9. CockroachDB Tuning

| Parameter | Setting | Rationale |
|---|---|---|
| `kv.range_split.load_qps` | `500` | Split ranges earlier under write-heavy usage-event load |
| `sql.defaults.experimental_distsql_planning` | `on` | Always use distributed query planning |
| `sql.stats.automatic_collections.enabled` | `true` | Keep auto-stats on (default) for cost-based optimizer |
| `jobs.registry.interval.gc` | `30s` | Faster cleanup of completed jobs |
| `changefeed.default.range_throttle` | `100ms` | Throttle changefeeds to avoid impacting foreground traffic |

---

## 10. Verification & Rollback Plan

### Verification Checklist

- [ ] All 20+ entity types from `DBState` are represented in SQL tables.
- [ ] Workspace-scoped queries return correct tenants (no cross-workspace leakage).
- [ ] Invoices created inside `SERIALIZABLE` transactions show correct amounts.
- [ ] Usage events can be ingested at ≥1000 events/sec without contention.
- [ ] Retry logic handles `40001` errors transparently (verified via load test).
- [ ] Audit logs record every entity mutation.
- [ ] Webhook deliveries retry failed endpoints up to 3 times.
- [ ] Credit ledger balance remains consistent (sum of `credit_ledger` = `credit_balances.balance`).
- [ ] `BACKUP` and restore completes within RPO/RTO windows.

### Rollback

If critical issues are found post-cutover:

1. Stop all CockroachDB writes (feature flag off).
2. Re-enable JSON file writes (already writing during dual-write phase).
3. Restore JSON file from last known-good backup if needed.
4. Investigate and fix; repeat migration.

---

## 11. Package Dependencies to Add

```bash
npm install pg @types/pg
# Optional: for query building without full ORM
npm install zapatos    # Type-safe SQL (optional)
```

No ORM is recommended. CockroachDB's distributed nature benefits from explicit SQL control. If an ORM is desired, use **Kysely** (type-safe query builder, no hidden migrations).

---

## 12. Summary of Changes Required

| File | Change |
|---|---|
| `src/api/db.ts` | Replace JSON in-memory state with pool queries. Remove `saveDatabase()`. Replace `initDatabase()` with migration runner. |
| `src/api/types.ts` | No change (types remain TypeScript interfaces, now map to DB rows). |
| `src/api/middleware.ts` | Replace `resolveWorkspace()` with SQL query. |
| All route files under `src/api/routes/` | Replace array `.find()/.filter()/.push()` with repository calls. |
| `server.ts` | Same as above for inline endpoints (or delete once refactored route modules are wired). |
| `billing_db.json` | Archive; no longer needed. |
| `.env.example` | Add `DATABASE_URL`. |
| `.gitignore` | Add `billing_db.json` (or confirm archived). |
| `package.json` | Add `pg` and `@types/pg`. |

---

## ⚠️ Critical Rules for Implementation

1. **NEVER use `SELECT *` in production code** — always enumerate columns.
2. **ALWAYS use parameterized queries** (`$1`, `$2`) — never string interpolation.
3. **EVERY multi-table mutation MUST be in a `SERIALIZABLE` transaction** with retry logic.
4. **Usage events are append-only** — never update or delete.
5. **Audit logs are append-only** — never update or delete.
6. **Invoices become immutable once `finalized_at` is set** — enforce in application code.
7. **Always bind workspace_id** in queries to enforce tenant isolation — never trust client-side filtering.
8. **Use `FOR UPDATE` row locking** when reading data that will be updated in the same transaction.
9. **Handle CockroachDB retry code `40001`** at the transaction boundary, not within individual statements.
10. **Monitor `pg` pool queue length** — if it exceeds `max * 2`, scale out or increase `max`.
