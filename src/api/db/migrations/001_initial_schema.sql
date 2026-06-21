-- ============================================================
-- Aora Billing OS — Initial Schema for CockroachDB
-- Version: 001
-- ============================================================

CREATE DATABASE IF NOT EXISTS aora_billing;
USE aora_billing;

-- ── 2.2 Global reference tables ────────────────────────────

CREATE TABLE organizations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        STRING(255) NOT NULL,
    status      STRING(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
) LOCALITY GLOBAL;

CREATE TABLE workspaces (
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

CREATE TABLE members (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email        STRING(320) NOT NULL,
    role         STRING(20) NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'billing_manager', 'developer', 'viewer')),
    permissions  STRING[] NOT NULL DEFAULT ARRAY['read']::STRING[],
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE INDEX idx_members_ws_email (workspace_id, email)
) LOCALITY GLOBAL;

-- ── 2.3 Product catalog ────────────────────────────────────

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

CREATE TABLE entitlements (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id    UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    feature_id UUID NOT NULL REFERENCES features(id) ON DELETE CASCADE,
    value      JSONB NOT NULL DEFAULT 'true'::JSONB,
    is_enabled BOOL NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE INDEX idx_entitlements_plan_feature (plan_id, feature_id)
) LOCALITY GLOBAL;

-- ── 2.4 Usage Metering Definitions ──────────────────────────

CREATE TABLE meter_definitions (
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

-- ── 2.5 Pricing model ──────────────────────────────────────

CREATE TABLE prices (
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

-- ── 2.6 Customers & Subscriptions ──────────────────────────

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
    notes           JSONB NOT NULL DEFAULT '[]'::JSONB,
    invoices        JSONB NOT NULL DEFAULT '[]'::JSONB,
    contracts       JSONB NOT NULL DEFAULT '[]'::JSONB,
    is_deleted      BOOL NOT NULL DEFAULT false,
    deleted_at      TIMESTAMPTZ,
    INDEX idx_customers_workspace (workspace_id) STORING (name, email, status, plan_id),
    INDEX idx_customers_status (status) WHERE NOT is_deleted,
    UNIQUE INDEX idx_customers_ws_email (workspace_id, email) WHERE NOT is_deleted
) LOCALITY REGIONAL BY TABLE IN PRIMARY REGION;

CREATE TABLE subscriptions (
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

-- ── 2.7 Invoices ───────────────────────────────────────────

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
    line_items      JSONB NOT NULL DEFAULT '[]'::JSONB,
    metadata        JSONB DEFAULT '{}'::JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    INDEX idx_invoices_customer (customer_id, status) STORING (amount, currency),
    INDEX idx_invoices_workspace (workspace_id, created_at DESC),
    INDEX idx_invoices_due (status, created_at) WHERE status = 'open' OR status = 'past_due'
) LOCALITY REGIONAL BY TABLE IN PRIMARY REGION;

-- ── 2.8 Usage Metering ─────────────────────────────────────

CREATE TABLE usage_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    meter_id    UUID NOT NULL REFERENCES meter_definitions(id),
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT now(),
    value       DECIMAL(18,4) NOT NULL,
    metadata    JSONB DEFAULT '{}'::JSONB,
    INDEX idx_usage_lookup (customer_id, meter_id) USING HASH WITH BUCKET_COUNT = 16 STORING (value, timestamp),
    INDEX idx_usage_time (meter_id, timestamp DESC)
) LOCALITY REGIONAL BY TABLE IN PRIMARY REGION;

CREATE TABLE usage_aggregates (
    customer_id UUID NOT NULL,
    meter_id    UUID NOT NULL,
    period      STRING(10) NOT NULL,
    period_type STRING(10) NOT NULL CHECK (period_type IN ('hourly','daily','weekly','monthly','yearly')),
    total_value DECIMAL(18,4) NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (customer_id, meter_id, period_type, period),
    FAMILY f_main (total_value, updated_at)
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
    amount      DECIMAL(18,4) NOT NULL,
    type        STRING(20) NOT NULL CHECK (type IN ('credit_issued','credit_consumed','credit_expired','credit_reversed')),
    description STRING(500) NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expire_at   TIMESTAMPTZ,
    INDEX idx_credit_customer (customer_id, created_at DESC)
);

CREATE TABLE credit_balances (
    customer_id UUID PRIMARY KEY REFERENCES customers(id),
    balance     DECIMAL(18,4) NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2.9 Custom Contracts ──────────────────────────────────

CREATE TABLE custom_contracts (
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

-- ── 2.10 Audit Logs ────────────────────────────────────────

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

-- ── 2.11 Webhooks ─────────────────────────────────────────

CREATE TABLE webhook_endpoints (
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

-- ── 2.12 Schema Migrations Tracking ──────────────────────

CREATE TABLE schema_migrations (
    version     INT PRIMARY KEY,
    description STRING(500) NOT NULL,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    checksum    STRING(64)
);
