-- ============================================================
-- Migration 002: Gateway Connections, Events & Dunning
-- ============================================================

-- Gateway connections: stores encrypted API keys per workspace per gateway
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

-- Gateway events: append-only log of incoming webhook events from payment gateways
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

-- Add gateway sync fields to subscriptions
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS gateway_subscription_id STRING(255);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS gateway_customer_id STRING(255);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS gateway_status STRING(50);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Add gateway sync fields to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gateway_invoice_id STRING(255);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gateway_payment_intent_id STRING(255);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gateway_hosted_url STRING(2048);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gateway_pdf_url STRING(2048);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Dunning attempts table: tracks payment recovery attempts on failed invoices
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

-- Idempotency keys table: prevents duplicate processing of POST requests
CREATE TABLE IF NOT EXISTS processed_idempotency_keys (
    idempotency_key STRING(255) PRIMARY KEY,
    response_hash   STRING(64) NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
) LOCALITY GLOBAL;
