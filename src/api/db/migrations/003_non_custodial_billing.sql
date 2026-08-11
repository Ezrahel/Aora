-- ============================================================
-- Migration 003: Non-Custodial Billing Engine Core Tables
-- Tenants, Tenant Gateways, Customers, Plans, Subscriptions
-- with gateway tokens for non-custodial billing
-- ============================================================

-- ── Tenants (The SaaS businesses using AoraHQ) ───────────────
CREATE TABLE IF NOT EXISTS tenants (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                STRING(255) NOT NULL,
    slug                STRING(100) NOT NULL UNIQUE,
    email               STRING(320) NOT NULL,
    status              STRING(20) NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'suspended', 'deleted')),
    settings            JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    INDEX idx_tenants_status (status) WHERE status = 'active',
    UNIQUE INDEX idx_tenants_slug (slug)
) LOCALITY GLOBAL;

-- ── Tenant Gateways (Encrypted gateway configs per tenant) ────
CREATE TABLE IF NOT EXISTS tenant_gateways (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    gateway                 STRING(20) NOT NULL
                                CHECK (gateway IN ('stripe', 'paystack', 'flutterwave')),
    mode                    STRING(10) NOT NULL DEFAULT 'test'
                                CHECK (mode IN ('live', 'test')),
    encrypted_api_key       BYTES NOT NULL,
    encrypted_webhook_secret BYTES,
    gateway_account_id      STRING(255),
    gateway_account_name    STRING(255),
    gateway_account_email   STRING(320),
    is_verified             BOOL NOT NULL DEFAULT false,
    is_active               BOOL NOT NULL DEFAULT true,
    last_verified_at        TIMESTAMPTZ,
    key_preview             STRING(10) NOT NULL,
    metadata                JSONB DEFAULT '{}'::JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE INDEX idx_tenant_gateway_unique (tenant_id, gateway, mode),
    INDEX idx_tenant_gateway_tenant (tenant_id, is_active) WHERE is_active = true
) LOCALITY GLOBAL;

-- ── Customers (End-users of the merchants/tenants) ────────────
CREATE TABLE IF NOT EXISTS customers (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email                   STRING(320) NOT NULL,
    name                    STRING(255) NOT NULL,
    gateway_customer_tokens JSONB NOT NULL DEFAULT '{}'::JSONB,
    -- Example: {"stripe": "cus_xxx", "paystack": "CUST_xxx"}
    metadata                JSONB NOT NULL DEFAULT '{}'::JSONB,
    status                  STRING(20) NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'canceled', 'paused', 'deleted')),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE INDEX idx_customers_tenant_email (tenant_id, email) WHERE status != 'deleted',
    INDEX idx_customers_tenant_status (tenant_id, status) WHERE status = 'active',
    INDEX idx_customers_gateway_tokens (tenant_id, gateway_customer_tokens) USING GIN
) LOCALITY REGIONAL BY TABLE IN PRIMARY REGION;

-- ── Plans (Pricing plans with base price, interval, currency) ──
CREATE TABLE IF NOT EXISTS plans (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name                    STRING(255) NOT NULL,
    description             STRING(1000) NOT NULL DEFAULT '',
    amount                  BIGINT NOT NULL DEFAULT 0,      -- Lowest denomination (cents/kobo)
    currency                STRING(10) NOT NULL DEFAULT 'USD',
    interval                STRING(20) NOT NULL DEFAULT 'monthly'
                                CHECK (interval IN ('weekly', 'monthly', 'yearly', 'quarterly')),
    interval_count          INT NOT NULL DEFAULT 1,         -- e.g., 1 month, 3 months
    trial_days              INT NOT NULL DEFAULT 0,
    is_archived             BOOL NOT NULL DEFAULT false,
    metadata                JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    INDEX idx_plans_tenant_active (tenant_id, is_archived) WHERE is_archived = false
) LOCALITY GLOBAL;

-- ── Subscriptions (Core non-custodial subscription model) ─────
CREATE TABLE IF NOT EXISTS subscriptions (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id                     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    plan_id                         UUID NOT NULL REFERENCES plans(id),
    tenant_gateway_id               UUID NOT NULL REFERENCES tenant_gateways(id),

    -- Non-custodial tokens (stored per gateway)
    gateway_customer_token          STRING(255) NOT NULL,   -- e.g., Stripe customer ID
    gateway_payment_token           STRING(255) NOT NULL,   -- e.g., Stripe payment method ID or card token

    status                          STRING(20) NOT NULL DEFAULT 'active'
                                        CHECK (status IN ('active', 'trial', 'past_due', 'canceled', 'paused')),
    current_period_start            TIMESTAMPTZ NOT NULL,
    current_period_end              TIMESTAMPTZ NOT NULL,
    trial_end                       TIMESTAMPTZ,
    canceled_at                     TIMESTAMPTZ,
    paused_at                       TIMESTAMPTZ,
    pause_resumes_at                TIMESTAMPTZ,
    cancel_at_period_end            BOOL NOT NULL DEFAULT false,

    -- Billing metadata
    seat_quantity                   INT NOT NULL DEFAULT 1,
    quantity                        INT NOT NULL DEFAULT 1,          -- For usage-based plans
    metadata                        JSONB NOT NULL DEFAULT '{}'::JSONB,

    -- Gateway sync fields
    gateway_subscription_id         STRING(255),
    gateway_customer_id             STRING(255),
    gateway_status                  STRING(50),
    last_synced_at                  TIMESTAMPTZ,

    created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),

    INDEX idx_subscriptions_customer (customer_id, status) WHERE status IN ('active', 'trial'),
    INDEX idx_subscriptions_tenant_status (tenant_id, status) WHERE status IN ('active', 'trial', 'past_due'),
    INDEX idx_subscriptions_period_end (current_period_end) WHERE status IN ('active', 'trial'),
    INDEX idx_subscriptions_gateway (tenant_gateway_id, gateway_subscription_id),
    INDEX idx_subscriptions_due (current_period_end) WHERE status IN ('active', 'trial', 'past_due')
) LOCALITY REGIONAL BY TABLE IN PRIMARY REGION;

-- ── Invoices (Generated from subscriptions) ─────────────────
CREATE TABLE IF NOT EXISTS invoices (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id             UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    subscription_id         UUID REFERENCES subscriptions(id),
    plan_id                 UUID REFERENCES plans(id),

    amount                  BIGINT NOT NULL,              -- Lowest denomination (cents/kobo)
    currency                STRING(10) NOT NULL DEFAULT 'USD',
    status                  STRING(20) NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft', 'open', 'paid', 'past_due', 'voided', 'uncollectible')),
    description             STRING(500),

    period_start            TIMESTAMPTZ,
    period_end              TIMESTAMPTZ,
    issued_at               TIMESTAMPTZ,
    due_at                  TIMESTAMPTZ,
    paid_at                 TIMESTAMPTZ,
    voided_at               TIMESTAMPTZ,

    -- Gateway reference
    gateway_invoice_id      STRING(255),
    gateway_payment_intent_id STRING(255),
    gateway_hosted_url      STRING(2048),
    gateway_pdf_url         STRING(2048),

    line_items              JSONB NOT NULL DEFAULT '[]'::JSONB,
    metadata                JSONB DEFAULT '{}'::JSONB,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    INDEX idx_invoices_customer (customer_id, status) WHERE status IN ('open', 'past_due'),
    INDEX idx_invoices_subscription (subscription_id, status),
    INDEX idx_invoices_due (due_at, status) WHERE status IN ('open', 'past_due'),
    INDEX idx_invoices_tenant (tenant_id, created_at DESC)
) LOCALITY REGIONAL BY TABLE IN PRIMARY REGION;

-- ── Schema Migrations Tracking ───────────────────────────────
INSERT INTO schema_migrations (version, description, checksum)
VALUES (3, 'Non-Custodial Billing Engine Core Tables', 'sha256_placeholder')
ON CONFLICT (version) DO NOTHING;