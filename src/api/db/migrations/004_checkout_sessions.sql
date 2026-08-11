-- ============================================================
-- Migration 004: Checkout Sessions
-- Hosted checkout flow for non-custodial payment processing
-- ============================================================

CREATE TABLE IF NOT EXISTS checkout_sessions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id             UUID REFERENCES customers(id) ON DELETE SET NULL,
    
    -- Plan / pricing info
    plan_id                 UUID REFERENCES plans(id),
    amount                  BIGINT NOT NULL,              -- Lowest denomination (cents/kobo)
    currency                STRING(10) NOT NULL DEFAULT 'USD',
    interval                STRING(20) NOT NULL DEFAULT 'monthly'
                                CHECK (interval IN ('weekly', 'monthly', 'yearly', 'quarterly')),
    interval_count          INT NOT NULL DEFAULT 1,
    
    -- Checkout configuration
    success_url             STRING(2048),                 -- Redirect on success
    cancel_url              STRING(2048),                 -- Redirect on cancel
    metadata                JSONB NOT NULL DEFAULT '{}'::JSONB,
    
    -- Gateway configuration (reference only, resolved at runtime)
    tenant_gateway_id       UUID REFERENCES tenant_gateways(id),
    gateway                 STRING(20),                   -- 'stripe' | 'paystack' | 'flutterwave'
    
    -- Session state
    status                  STRING(20) NOT NULL DEFAULT 'created'
                                CHECK (status IN ('created', 'pending', 'completed', 'expired', 'failed')),
    
    -- Results (populated after payment)
    payment_token           STRING(255),                  -- Gateway payment token (payment_method_id, authorization_code, etc.)
    gateway_customer_token  STRING(255),                  -- Gateway customer ID (stripe customer_id, etc.)
    gateway_payment_token   STRING(255),                  -- Gateway payment method token (pm_xxx, authorization_code, etc.)
    gateway_customer_id     STRING(255),                  -- Gateway customer ID for reference
    gateway_payment_intent_id STRING(255),                -- For Stripe: payment_intent_id
    
    -- Customer info (collected during checkout)
    customer_email          STRING(320) NOT NULL,
    customer_name           STRING(255),
    
    -- Subscription creation (after successful payment)
    subscription_id         UUID REFERENCES subscriptions(id),
    
    -- Timestamps
    expires_at              TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 minutes'),
    completed_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    INDEX idx_checkout_sessions_tenant (tenant_id, status) WHERE status IN ('created', 'pending'),
    INDEX idx_checkout_sessions_customer (customer_id),
    INDEX idx_checkout_sessions_expires (expires_at) WHERE status IN ('created', 'pending')
) LOCALITY REGIONAL BY TABLE IN PRIMARY REGION;

-- Add checkout_session_id to subscriptions for traceability
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS checkout_session_id UUID REFERENCES checkout_sessions(id);

-- Add indexes for webhook processing
CREATE INDEX IF NOT EXISTS idx_invoices_checkout_session ON invoices(id) WHERE subscription_id IS NOT NULL;

-- Schema migrations tracking
INSERT INTO schema_migrations (version, description, checksum)
VALUES (4, 'Checkout Sessions for Hosted Checkout Flow', 'sha256_placeholder')
ON CONFLICT (version) DO NOTHING;