import { createHash } from "crypto";
import pool, { withTransaction } from "./pool.ts";

// ── Inline Migrations ──────────────────────────────────────
// SQL is inlined here so Vercel's esbuild includes it in the
// serverless bundle. Filesystem reads (fs.readFileSync) would
// fail at runtime because Vercel doesn't deploy non-imported
// files.

interface Migration {
  version: number;
  description: string;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: "initial_schema",
    sql: `-- ============================================================
-- Aora Billing OS — Initial Schema for CockroachDB
-- Version: 001
-- ============================================================

CREATE TABLE IF NOT EXISTS organizations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        STRING(255) NOT NULL,
    status      STRING(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
) LOCALITY GLOBAL;

CREATE TABLE IF NOT EXISTS workspaces (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            STRING(255) NOT NULL,
    environment     STRING(20) NOT NULL DEFAULT 'production' CHECK (environment IN ('production', 'sandbox', 'development')),
    api_keys        STRING[] NOT NULL DEFAULT ARRAY[]::STRING[],
    profile         JSONB NOT NULL DEFAULT '{}'::JSONB,
    settings        JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE INDEX idx_workspaces_name_env (organization_id, name, environment)
) LOCALITY GLOBAL;

CREATE TABLE IF NOT EXISTS members (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email        STRING(320) NOT NULL,
    role         STRING(20) NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'billing_manager', 'developer', 'viewer')),
    permissions  STRING[] NOT NULL DEFAULT ARRAY['read']::STRING[],
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE INDEX idx_members_ws_email (workspace_id, email)
) LOCALITY GLOBAL;

CREATE TABLE IF NOT EXISTS products (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name         STRING(255) NOT NULL,
    description  STRING(1000) NOT NULL DEFAULT '',
    is_archived  BOOL NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    INDEX idx_products_workspace (workspace_id) STORING (name, is_archived)
) LOCALITY GLOBAL;

CREATE TABLE IF NOT EXISTS features (
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

CREATE TABLE IF NOT EXISTS plans (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id        UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name              STRING(255) NOT NULL,
    description       STRING(1000) NOT NULL DEFAULT '',
    code              STRING(100),
    currency          STRING(10) NOT NULL DEFAULT 'USD',
    price             DECIMAL(18,4) NOT NULL DEFAULT 0,
    billing_period    STRING(20) NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('monthly', 'yearly')),
    included_seats    INT NOT NULL DEFAULT 0,
    included_usage    DECIMAL(18,4) NOT NULL DEFAULT 0,
    overage_unit_price DECIMAL(18,4) NOT NULL DEFAULT 0,
    api_access        BOOL NOT NULL DEFAULT false,
    pricing_type      STRING(20) CHECK (pricing_type IN ('flat', 'per_seat', 'usage', 'hybrid')),
    is_archived       BOOL NOT NULL DEFAULT false,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    INDEX idx_plans_product (product_id) STORING (name, price, billing_period, is_archived)
) LOCALITY GLOBAL;

CREATE TABLE IF NOT EXISTS entitlements (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id    UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    feature_id UUID NOT NULL REFERENCES features(id) ON DELETE CASCADE,
    value      JSONB NOT NULL DEFAULT 'true'::JSONB,
    is_enabled BOOL NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE INDEX idx_entitlements_plan_feature (plan_id, feature_id)
) LOCALITY GLOBAL;

CREATE TABLE IF NOT EXISTS meter_definitions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name             STRING(255) NOT NULL,
    description      STRING(1000) NOT NULL DEFAULT '',
    aggregation_type STRING(20) NOT NULL CHECK (aggregation_type IN ('sum','count','max','latest','min','average')),
    target_field     STRING(255) NOT NULL DEFAULT '',
    slug             STRING(255),
    event_source     STRING(255),
    unit             STRING(100),
    status           STRING(20) NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','archived'))
) LOCALITY GLOBAL;

CREATE TABLE IF NOT EXISTS prices (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id            UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    name               STRING(255) NOT NULL,
    type               STRING(20) NOT NULL CHECK (type IN ('flat','usage','seat','tiered','volume','package','hybrid','custom_contract')),
    billing_period     STRING(20) NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('monthly','yearly','quarterly','unlimited')),
    currency           STRING(10) NOT NULL DEFAULT 'USD',
    base_fee           DECIMAL(18,4) NOT NULL DEFAULT 0,
    seat_price         DECIMAL(18,4),
    included_seats     INT,
    meter_id           UUID REFERENCES meter_definitions(id),
    included_usage     DECIMAL(18,4),
    overage_unit_price DECIMAL(18,4),
    tiers              JSONB,
    volume_pricing     BOOL NOT NULL DEFAULT false,
    package_size       INT,
    package_price      DECIMAL(18,4),
    version            INT NOT NULL DEFAULT 1,
    is_active          BOOL NOT NULL DEFAULT true,
    is_archived        BOOL NOT NULL DEFAULT false,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    INDEX idx_prices_plan_active (plan_id, is_active) STORING (type, base_fee, version)
) LOCALITY GLOBAL;

CREATE TABLE IF NOT EXISTS rate_cards (
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

CREATE TABLE IF NOT EXISTS discounts (
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

CREATE TABLE IF NOT EXISTS coupons (
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

CREATE TABLE IF NOT EXISTS customers (
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
    notes           JSONB NOT NULL DEFAULT '[]'::JSONB,
    invoices        JSONB NOT NULL DEFAULT '[]'::JSONB,
    contracts       JSONB NOT NULL DEFAULT '[]'::JSONB,
    is_deleted      BOOL NOT NULL DEFAULT false,
    deleted_at      TIMESTAMPTZ,
    INDEX idx_customers_workspace (workspace_id) STORING (name, email, status, plan_id),
    INDEX idx_customers_status (status) WHERE NOT is_deleted,
    UNIQUE INDEX idx_customers_ws_email (workspace_id, email) WHERE NOT is_deleted
) LOCALITY REGIONAL BY TABLE IN PRIMARY REGION;

CREATE TABLE IF NOT EXISTS subscriptions (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id          UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    plan_id              UUID NOT NULL REFERENCES plans(id),
    status               STRING(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trial', 'canceled', 'paused')),
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end   TIMESTAMPTZ NOT NULL,
    trial_end            TIMESTAMPTZ,
    canceled_at          TIMESTAMPTZ,
    paused_at            TIMESTAMPTZ,
    resume_at            TIMESTAMPTZ,
    cancel_at_period_end BOOL NOT NULL DEFAULT false,
    seat_quantity        INT NOT NULL DEFAULT 1,
    metadata             JSONB DEFAULT '{}'::JSONB,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    INDEX idx_subscriptions_customer (customer_id),
    INDEX idx_subscriptions_status (status),
    INDEX idx_subscriptions_period_end (current_period_end) WHERE status IN ('active', 'trial')
) LOCALITY REGIONAL BY TABLE IN PRIMARY REGION;

CREATE TABLE IF NOT EXISTS invoices (
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
    line_items      JSONB NOT NULL DEFAULT '[]'::JSONB,
    metadata        JSONB DEFAULT '{}'::JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    INDEX idx_invoices_customer (customer_id, status) STORING (amount, currency),
    INDEX idx_invoices_workspace (workspace_id, created_at DESC),
    INDEX idx_invoices_due (status, created_at) WHERE status = 'open' OR status = 'past_due'
) LOCALITY REGIONAL BY TABLE IN PRIMARY REGION;

CREATE TABLE IF NOT EXISTS usage_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    meter_id    UUID NOT NULL REFERENCES meter_definitions(id),
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT now(),
    value       DECIMAL(18,4) NOT NULL,
    metadata    JSONB DEFAULT '{}'::JSONB,
    INDEX idx_usage_lookup (customer_id, meter_id) USING HASH WITH BUCKET_COUNT = 16 STORING (value, timestamp),
    INDEX idx_usage_time (meter_id, timestamp DESC)
) LOCALITY REGIONAL BY TABLE IN PRIMARY REGION;

CREATE TABLE IF NOT EXISTS usage_aggregates (
    customer_id UUID NOT NULL,
    meter_id    UUID NOT NULL,
    period      STRING(10) NOT NULL,
    period_type STRING(10) NOT NULL CHECK (period_type IN ('hourly','daily','weekly','monthly','yearly')),
    total_value DECIMAL(18,4) NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (customer_id, meter_id, period_type, period),
    FAMILY f_main (total_value, updated_at)
);

CREATE TABLE IF NOT EXISTS quotas (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    meter_id    UUID NOT NULL REFERENCES meter_definitions(id),
    limit_value DECIMAL(18,4) NOT NULL,
    used_value  DECIMAL(18,4) NOT NULL DEFAULT 0,
    period      STRING(20) NOT NULL CHECK (period IN ('hourly','daily','weekly','monthly','yearly','unlimited')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE INDEX idx_quotas_customer_meter (customer_id, meter_id, period)
);

CREATE TABLE IF NOT EXISTS credit_ledger (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    amount      DECIMAL(18,4) NOT NULL,
    type        STRING(20) NOT NULL CHECK (type IN ('credit_issued','credit_consumed','credit_expired','credit_reversed')),
    description STRING(500) NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expire_at   TIMESTAMPTZ,
    INDEX idx_credit_customer (customer_id, created_at DESC)
);

CREATE TABLE IF NOT EXISTS credit_balances (
    customer_id UUID PRIMARY KEY REFERENCES customers(id),
    balance     DECIMAL(18,4) NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS custom_contracts (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id                    UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name                           STRING(255) NOT NULL,
    custom_base_fee                DECIMAL(18,4) NOT NULL DEFAULT 0,
    custom_seat_price              DECIMAL(18,4),
    custom_overage_unit_price      DECIMAL(18,4),
    minimum_spend                  DECIMAL(18,4),
    additional_discount_percentage DECIMAL(5,2),
    expire_at                      TIMESTAMPTZ NOT NULL,
    is_deleted                     BOOL NOT NULL DEFAULT false,
    created_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
    INDEX idx_contracts_customer (customer_id) WHERE NOT is_deleted
) LOCALITY GLOBAL;

CREATE TABLE IF NOT EXISTS audit_logs (
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

CREATE TABLE IF NOT EXISTS webhook_endpoints (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    url          STRING(2048) NOT NULL,
    description  STRING(500),
    events       STRING[] NOT NULL DEFAULT ARRAY[]::STRING[],
    secret       STRING(64) NOT NULL,
    is_active    BOOL NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    INDEX idx_webhook_ws (workspace_id)
) LOCALITY GLOBAL;

CREATE TABLE IF NOT EXISTS webhook_deliveries (
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

CREATE TABLE IF NOT EXISTS schema_migrations (
    version     INT PRIMARY KEY,
    description STRING(500) NOT NULL,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    checksum    STRING(64)
);`,
  },
  {
    version: 2,
    description: "gateway_connections",
    sql: `-- Gateway connections
CREATE TABLE IF NOT EXISTS gateway_connections (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id         UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    gateway              STRING(20) NOT NULL CHECK (gateway IN ('stripe', 'paystack', 'flutterwave')),
    mode                 STRING(10) NOT NULL DEFAULT 'test' CHECK (mode IN ('live', 'test')),
    encrypted_api_key    BYTES NOT NULL,
    encrypted_webhook_secret BYTES,
    gateway_account_id   STRING(255),
    gateway_account_name STRING(255),
    gateway_account_email STRING(320),
    is_verified          BOOL NOT NULL DEFAULT false,
    last_verified_at     TIMESTAMPTZ,
    key_preview          STRING(10) NOT NULL,
    metadata             JSONB DEFAULT '{}'::JSONB,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE INDEX idx_gw_conn_ws_gateway (workspace_id, gateway, mode),
    INDEX idx_gw_conn_ws (workspace_id, created_at DESC)
) LOCALITY GLOBAL;

CREATE TABLE IF NOT EXISTS gateway_events (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id      UUID NOT NULL REFERENCES workspaces(id),
    gateway           STRING(20) NOT NULL,
    event_type        STRING(100) NOT NULL,
    gateway_event_id  STRING(255) NOT NULL,
    customer_id       UUID REFERENCES customers(id),
    raw_payload       JSONB NOT NULL,
    mapped_data       JSONB,
    status            STRING(20) NOT NULL DEFAULT 'received'
                      CHECK (status IN ('received','processed','skipped','failed')),
    error_message     STRING(1000),
    attempt_count     INT NOT NULL DEFAULT 0,
    processed_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE INDEX idx_gw_events_dedup (gateway, gateway_event_id),
    INDEX idx_gw_events_ws (workspace_id, created_at DESC),
    INDEX idx_gw_events_unprocessed (status, created_at) WHERE status = 'received'
) LOCALITY REGIONAL BY TABLE IN PRIMARY REGION;

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS gateway_subscription_id STRING(255);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS gateway_customer_id STRING(255);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS gateway_status STRING(50);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gateway_invoice_id STRING(255);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gateway_payment_intent_id STRING(255);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gateway_hosted_url STRING(2048);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gateway_pdf_url STRING(2048);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS dunning_attempts (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id       UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    attempt_number   INT NOT NULL DEFAULT 1,
    action           STRING(20) NOT NULL CHECK (action IN ('email_reminder','retry_payment','manual_review')),
    status           STRING(20) NOT NULL CHECK (status IN ('pending','success','failed','skipped')),
    gateway_response JSONB,
    scheduled_at     TIMESTAMPTZ,
    executed_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    INDEX idx_dunning_invoice (invoice_id, attempt_number),
    INDEX idx_dunning_scheduled (scheduled_at, status) WHERE status = 'pending'
) LOCALITY REGIONAL BY TABLE IN PRIMARY REGION;

CREATE TABLE IF NOT EXISTS processed_idempotency_keys (
    idempotency_key STRING(255) PRIMARY KEY,
    response_hash   STRING(64) NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
) LOCALITY GLOBAL;`,
  },
  {
    version: 5,
    description: "proration_support",
    sql: `CREATE TABLE IF NOT EXISTS seat_adjustments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id   UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    previous_seat_count INT NOT NULL,
    new_seat_count    INT NOT NULL,
    adjustment_cents  DECIMAL(18,4) NOT NULL,
    is_charge         BOOL NOT NULL,
    transaction_ref   STRING(255),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    INDEX idx_seat_adj_sub (subscription_id, created_at DESC),
    INDEX idx_seat_adj_charge (is_charge, created_at DESC)
) LOCALITY REGIONAL BY TABLE IN PRIMARY REGION;

ALTER TABLE credit_ledger DROP CONSTRAINT IF EXISTS credit_ledger_type_check;
ALTER TABLE credit_ledger ADD CONSTRAINT credit_ledger_type_check
    CHECK (type IN (
        'credit_issued',
        'credit_consumed',
        'credit_expired',
        'credit_reversed',
        'proration_credit',
        'proration_charge'
    ));`,
  },
  {
    version: 6,
    description: "ingress_ledger",
    sql: `CREATE TABLE IF NOT EXISTS ingress_ledger (
    tenant_id      UUID NOT NULL,
    hour_bucket    TIMESTAMPTZ NOT NULL,
    event_count    BIGINT NOT NULL DEFAULT 0,
    billable_units BIGINT NOT NULL DEFAULT 0,
    batch_count    BIGINT NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, hour_bucket)
) LOCALITY REGIONAL BY TABLE IN PRIMARY REGION;

CREATE INDEX IF NOT EXISTS idx_ingress_ledger_time
    ON ingress_ledger (tenant_id, hour_bucket DESC);`,
  },
  {
    version: 7,
    description: "event_dedup",
    sql: `CREATE TABLE IF NOT EXISTS processed_events (
    dedup_key    STRING(512) PRIMARY KEY,
    tenant_id    UUID NOT NULL,
    event_id     STRING(255) NOT NULL,
    expires_at   TIMESTAMPTZ NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
) LOCALITY GLOBAL;

CREATE INDEX IF NOT EXISTS idx_processed_events_expires
    ON processed_events (expires_at);`,
  },
  {
    version: 8,
    description: "batch_ingestion_charged_units",
    sql: `ALTER TABLE ingress_ledger ADD COLUMN IF NOT EXISTS charged_units DECIMAL(18,4) NOT NULL DEFAULT 0;`,
  },
  {
    version: 9,
    description: "sandbox_isolation",
    sql: `-- ============================================================
-- Aora Billing OS — Sandbox Isolation
-- Version: 009
-- ============================================================
-- Adds is_test columns to core tables so sandbox (sk_test_*) and
-- live (sk_live_*) data can coexist in the same database schema
-- without mixing billing/invoicing logic.
--
-- Partial indexes: most production queries can filter WHERE is_test = false
-- for optimal performance when scanning live-only data.
-- ============================================================

ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_test BOOL NOT NULL DEFAULT false;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS is_test BOOL NOT NULL DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_test BOOL NOT NULL DEFAULT false;
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS is_test BOOL NOT NULL DEFAULT false;
ALTER TABLE ingress_ledger ADD COLUMN IF NOT EXISTS is_test BOOL NOT NULL DEFAULT false;
ALTER TABLE processed_events ADD COLUMN IF NOT EXISTS is_test BOOL NOT NULL DEFAULT false;

-- Partial indexes: live-only queries skip sandbox rows
CREATE INDEX IF NOT EXISTS idx_customers_live
    ON customers (workspace_id, email, status)
    WHERE NOT is_deleted AND NOT is_test;
CREATE INDEX IF NOT EXISTS idx_subscriptions_live
    ON subscriptions (customer_id, status)
    WHERE NOT is_test;
CREATE INDEX IF NOT EXISTS idx_invoices_live
    ON invoices (customer_id, status, created_at DESC)
    WHERE NOT is_test;
CREATE INDEX IF NOT EXISTS idx_ingress_ledger_live
    ON ingress_ledger (tenant_id, hour_bucket DESC)
    WHERE NOT is_test;`,
  },
  {
    version: 10,
    description: "zero_trust_credential_encryption",
    sql: `-- ============================================================
-- Aora Billing OS — Zero-Trust Credential Encryption
-- Version: 010
--
-- Instead of storing gateway keys in a single BYTES blob, this
-- table stores the three AES-256-GCM primitives in separate
-- columns so each can be validated and audited independently.
--
--   encrypted_secret_key  — the ciphertext (base64)
--   encryption_iv         — the 12-byte random IV (base64)
--   encryption_tag        — the 16-byte GCM auth tag (base64)
--
-- The master key lives in AORAHQ_MASTER_ENCRYPTION_KEY (env).
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_gateways (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id              UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    gateway                   STRING(20) NOT NULL CHECK (gateway IN ('stripe', 'paystack', 'flutterwave', 'sandbox')),
    mode                      STRING(10) NOT NULL DEFAULT 'test' CHECK (mode IN ('live', 'test')),

    -- AES-256-GCM cryptographic primitives (base64-encoded)
    encrypted_secret_key      STRING(512) NOT NULL,
    encryption_iv             STRING(32) NOT NULL,
    encryption_tag            STRING(32) NOT NULL,

    -- Optional webhook secret (same encryption scheme)
    encrypted_webhook_secret  STRING(512),
    webhook_iv                STRING(32),
    webhook_tag               STRING(32),

    -- Gateway account metadata
    gateway_account_id        STRING(255),
    gateway_account_name      STRING(255),
    gateway_account_email     STRING(320),

    -- Connection status
    is_verified               BOOL NOT NULL DEFAULT false,
    last_verified_at          TIMESTAMPTZ,

    -- Safe display preview (last 4 chars only)
    key_preview               STRING(20) NOT NULL,

    metadata                  JSONB DEFAULT '{}'::JSONB,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE INDEX idx_tgw_ws_gateway_mode (workspace_id, gateway, mode),
    INDEX idx_tgw_ws (workspace_id, created_at DESC)
) LOCALITY GLOBAL;`,
  },
  {
    version: 11,
    description: "webhook_transactional_outbox",
    sql: `-- ============================================================
-- Aora Billing OS — Transactional Webhook Outbox
-- Version: 011
--
-- Implements the Transactional Outbox Pattern: webhook events
-- are written to the outbox table *within the same database
-- transaction* as the state change that triggered them.
-- A background worker polls the outbox, signs the payload
-- with HMAC-SHA256, and dispatches to the merchant's endpoint.
-- ============================================================

CREATE TABLE IF NOT EXISTS webhook_outbox (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL,
    workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    webhook_id       UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
    event_type       STRING(100) NOT NULL,
    payload          JSONB NOT NULL,
    status           STRING(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','processing','delivered','failed','cancelled')),
    retry_count      INT NOT NULL DEFAULT 0,
    max_retries      INT NOT NULL DEFAULT 48,
    next_attempt_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_error       STRING(2000),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    INDEX idx_outbox_pending (status, next_attempt_at) WHERE status = 'pending',
    INDEX idx_outbox_tenant (tenant_id, created_at DESC),
    INDEX idx_outbox_webhook (webhook_id, created_at DESC)
) LOCALITY REGIONAL BY TABLE IN PRIMARY REGION;

CREATE TABLE IF NOT EXISTS webhook_delivery_logs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outbox_id        UUID NOT NULL REFERENCES webhook_outbox(id) ON DELETE CASCADE,
    webhook_id       UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
    attempt_number   INT NOT NULL DEFAULT 1,
    status           STRING(20) NOT NULL CHECK (status IN ('success','failed')),
    http_status      INT,
    response_body    STRING(5000),
    response_headers JSONB,
    duration_ms      INT NOT NULL DEFAULT 0,
    error_message    STRING(1000),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    INDEX idx_dlv_outbox (outbox_id, attempt_number),
    INDEX idx_dlv_webhook (webhook_id, created_at DESC)
) LOCALITY REGIONAL BY TABLE IN PRIMARY REGION;`,
  },
  {
    version: 12,
    description: "dunning_state_machine",
    sql: `-- ============================================================
-- Aora Billing OS — Dunning & Automated Retry State Machine
-- Version: 012
--
-- Extends subscriptions with dunning fields and creates a
-- retry log table so we can track every automated payment
-- attempt during the dunning lifecycle.
--
-- Dunning Lifecycle:
--   Step 0: No failure (active billing)
--   Step 1: First failure → schedule retry in 3 days
--   Step 2: Second failure → schedule final retry in 4 days
--   Step 3+: Max retries reached → cancel
-- ============================================================

-- Extend subscription status to include dunning states
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
    CHECK (status IN ('active', 'trial', 'past_due', 'canceled', 'unpaid', 'paused'));

-- Add dunning columns
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS dunning_step INT NOT NULL DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_payment_attempt_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_subscriptions_dunning
    ON subscriptions (next_retry_at)
    WHERE next_retry_at IS NOT NULL AND status IN ('active', 'past_due');

-- Retry log: one row per automated payment attempt during dunning
CREATE TABLE IF NOT EXISTS dunning_retry_log (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id   UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    attempt_number    INT NOT NULL,
    dunning_step      INT NOT NULL,
    amount_cents      DECIMAL(18,4) NOT NULL,
    status            STRING(20) NOT NULL CHECK (status IN ('success', 'failed')),
    error_message     STRING(1000),
    gateway_response  JSONB,
    attempted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    INDEX idx_drl_subscription (subscription_id, attempt_number DESC),
    INDEX idx_drl_pending (subscription_id, status) WHERE status = 'failed'
) LOCALITY REGIONAL BY TABLE IN PRIMARY REGION;`,
  },
  {
    version: 13,
    description: "better_auth_and_api_keys",
    sql: `-- ============================================================
-- AoraHQ — Better Auth Core Tables + Custom API Key Store
-- Version: 013
--
-- Tables:
--   user, session, account, verification  (Better Auth core)
--   organization, member, invitation       (Better Auth org plugin)
--   api_key                                (custom, server-to-server auth)
-- ============================================================

-- ── Better Auth Core ────────────────────────────────────

CREATE TABLE IF NOT EXISTS "user" (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    image         TEXT,
    role          TEXT DEFAULT 'member',
    banned        BOOLEAN DEFAULT false,
    ban_reason    TEXT,
    ban_expires   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "session" (
    id                    TEXT PRIMARY KEY,
    expires_at            TIMESTAMPTZ NOT NULL,
    ip_address            TEXT,
    user_agent            TEXT,
    user_id               TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    impersonated_by       TEXT,
    active_organization_id TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_user ON "session"(user_id);

CREATE TABLE IF NOT EXISTS "account" (
    id                      TEXT PRIMARY KEY,
    account_id              TEXT NOT NULL,
    provider_id             TEXT NOT NULL,
    user_id                 TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    access_token            TEXT,
    refresh_token           TEXT,
    id_token                TEXT,
    access_token_expires_at TIMESTAMPTZ,
    refresh_token_expires_at TIMESTAMPTZ,
    scope                   TEXT,
    password                TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_user ON "account"(user_id);
CREATE INDEX IF NOT EXISTS idx_account_provider ON "account"(provider_id, account_id);

CREATE TABLE IF NOT EXISTS "verification" (
    id         TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value      TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_identifier ON "verification"(identifier);

-- ── Organization Plugin ─────────────────────────────────

CREATE TABLE IF NOT EXISTS "organization" (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    slug       TEXT UNIQUE,
    logo       TEXT,
    metadata   JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "member" (
    id              TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    role            TEXT NOT NULL DEFAULT 'member',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_org ON "member"(organization_id);
CREATE INDEX IF NOT EXISTS idx_member_user ON "member"(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_org_user ON "member"(organization_id, user_id);

CREATE TABLE IF NOT EXISTS "invitation" (
    id              TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    role            TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    expires_at      TIMESTAMPTZ NOT NULL,
    inviter_id      TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitation_org ON "invitation"(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitation_email ON "invitation"(email);

-- ── Custom: API Keys for Server-to-Server Auth ──────────

CREATE TABLE IF NOT EXISTS "api_key" (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prefix          TEXT NOT NULL,
    key_hash        TEXT NOT NULL UNIQUE,
    label           TEXT NOT NULL DEFAULT '',
    organization_id TEXT NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
    created_by      TEXT NOT NULL REFERENCES "user"(id),
    expires_at      TIMESTAMPTZ,
    last_used_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_key_hash ON "api_key"(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_key_org ON "api_key"(organization_id);`,
  },
];

// ── Migration Runner ───────────────────────────────────────

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     INT PRIMARY KEY,
      description STRING(500) NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      checksum    STRING(64)
    )
  `);
}

function computeChecksum(sql: string): string {
  return createHash("sha256").update(sql).digest("hex");
}

interface AppliedMigration {
  version: number;
  description: string;
  checksum: string | null;
}

async function getAppliedMigrations(): Promise<Map<number, AppliedMigration>> {
  const { rows } = await pool.query<AppliedMigration>(
    "SELECT version, description, checksum FROM schema_migrations ORDER BY version",
  );
  // pg decodes CockroachDB INT columns as strings; normalize to numbers.
  return new Map(rows.map((row) => [Number(row.version), { ...row, version: Number(row.version) }]));
}

/** Validate the immutable migration catalogue before touching the database. */
export function validateMigrationDefinitions(): void {
  const versions = new Set<number>();
  for (const migration of MIGRATIONS) {
    if (!Number.isInteger(migration.version) || migration.version <= 0) {
      throw new Error(`Invalid migration version: ${migration.version}`);
    }
    if (versions.has(migration.version)) {
      throw new Error(`Duplicate migration version: ${migration.version}`);
    }
    if (!migration.description.trim() || !migration.sql.trim()) {
      throw new Error(`Migration ${migration.version} requires a description and SQL.`);
    }
    versions.add(migration.version);
  }
}

/** Split SQL without corrupting semicolons inside quotes or dollar blocks. */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let start = 0;
  let quote: "'" | '"' | null = null;
  let dollarTag: string | null = null;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) {
        i += dollarTag.length - 1;
        dollarTag = null;
      }
      continue;
    }
    if (quote) {
      if (char === quote) {
        if (quote === "'" && sql[i + 1] === "'") i += 1;
        else quote = null;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "$") {
      const match = sql.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (match) {
        dollarTag = match[0];
        i += dollarTag.length - 1;
        continue;
      }
    }
    if (char === ";") {
      const statement = sql.slice(start, i).trim();
      if (statement) statements.push(statement);
      start = i + 1;
    }
  }
  const finalStatement = sql.slice(start).trim();
  if (finalStatement) statements.push(finalStatement);
  return statements;
}

export async function runMigrations(): Promise<void> {
  validateMigrationDefinitions();
  await ensureMigrationsTable();

  const applied = await getAppliedMigrations();

  for (const migration of MIGRATIONS) {
    const checksum = computeChecksum(migration.sql);
    const existing = applied.get(migration.version);
    if (existing) {
      if (existing.checksum && existing.checksum !== checksum) {
        throw new Error(
          `Migration checksum mismatch for v${migration.version} (${migration.description}). ` +
          "Applied migrations are immutable; create a new migration instead.",
        );
      }
      continue;
    }

    await withTransaction(async (client) => {
      const statements = splitSqlStatements(migration.sql);

      for (const stmt of statements) {
        await client.query(stmt);
      }

      await client.query(
        `INSERT INTO schema_migrations (version, description, checksum)
         VALUES ($1, $2, $3)`,
        [migration.version, migration.description, checksum],
      );
    });

    console.log(`Migration ${migration.version} applied: ${migration.description}`);
  }

  console.log("All migrations up to date.");
}

export async function migrateDown(version: number): Promise<void> {
  throw new Error("Down migrations not implemented. Use BACKUP restore for rollbacks.");
}
