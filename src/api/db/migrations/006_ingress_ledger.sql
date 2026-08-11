-- ============================================================
-- Aora Billing OS — Fair Ingress Ingestion Metering
-- Version: 006
-- ============================================================
-- Tracks hourly aggregated billable ingress volumes per tenant.
-- Data is buffered in Redis and flushed asynchronously to this
-- table, avoiding per-request write amplification.
-- ============================================================

CREATE TABLE IF NOT EXISTS ingress_ledger (
    tenant_id      UUID NOT NULL,
    hour_bucket    TIMESTAMPTZ NOT NULL,
    event_count    BIGINT NOT NULL DEFAULT 0,
    billable_units BIGINT NOT NULL DEFAULT 0,
    batch_count    BIGINT NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, hour_bucket)
) LOCALITY REGIONAL BY TABLE IN PRIMARY REGION;

-- Index for time-range queries (ingress billing reports)
CREATE INDEX IF NOT EXISTS idx_ingress_ledger_time
    ON ingress_ledger (tenant_id, hour_bucket DESC);
