-- ============================================================
-- Aora Billing OS — Proration Support
-- Version: 005
-- ============================================================
-- Adds seat_adjustments audit table and extends credit_ledger
-- type constraint to support proration-based entries.
-- Note: seat_quantity already exists on subscriptions (added in v001).
-- ============================================================

-- Track every mid-cycle seat change for audit and reconciliation
CREATE TABLE IF NOT EXISTS seat_adjustments (
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

-- Add proration-specific credit types
-- CockroachDB doesn't support ALTER TABLE ... ADD CHECK with new values
-- for an existing CHECK constraint. We use a migration-friendly approach:
-- drop and recreate the constraint with the expanded type set.
ALTER TABLE credit_ledger DROP CONSTRAINT IF EXISTS credit_ledger_type_check;
ALTER TABLE credit_ledger ADD CONSTRAINT credit_ledger_type_check
    CHECK (type IN (
        'credit_issued',
        'credit_consumed',
        'credit_expired',
        'credit_reversed',
        'proration_credit',
        'proration_charge'
    ));
