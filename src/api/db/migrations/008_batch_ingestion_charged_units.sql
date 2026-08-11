-- ============================================================
-- Aora Billing OS — Batch Ingestion Charged Units
-- Version: 008
-- ============================================================
-- Adds charged_units DECIMAL column to ingress_ledger for
-- storing fractional batch-discounted billing units with
-- full precision (4 decimal places).
-- ============================================================

ALTER TABLE ingress_ledger ADD COLUMN IF NOT EXISTS charged_units DECIMAL(18,4) NOT NULL DEFAULT 0;
