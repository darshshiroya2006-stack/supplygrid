-- ============================================================
-- Migration: Multi-Tenant Isolation & Per-Vendor Order Sequencing
-- ============================================================
-- Run with:  psql $DATABASE_URL -f migration_multi_tenant.sql
-- Safe to re-run: all DDL statements use IF NOT EXISTS guards.
-- ============================================================

-- 1. ORDERS TABLE: ensure vendor_id and sequence_number columns exist
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS vendor_id INTEGER REFERENCES admins(id),
  ADD COLUMN IF NOT EXISTS sequence_number INTEGER,
  ADD COLUMN IF NOT EXISTS vendor_order_index INTEGER;

-- 2. STOCK_ENTRIES TABLE: ensure vendor_id column exists
ALTER TABLE stock_entries
  ADD COLUMN IF NOT EXISTS vendor_id INTEGER REFERENCES admins(id);

-- 3. SUPPLIERS TABLE: ensure vendor_id column exists
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS vendor_id INTEGER REFERENCES admins(id);

-- 4. Indexes for fast per-vendor scoped queries
CREATE INDEX IF NOT EXISTS idx_orders_vendor_id
  ON orders(vendor_id);

CREATE INDEX IF NOT EXISTS idx_orders_vendor_billing
  ON orders(vendor_id, billing_type);

CREATE INDEX IF NOT EXISTS idx_stock_entries_vendor_id
  ON stock_entries(vendor_id);

CREATE INDEX IF NOT EXISTS idx_suppliers_vendor_id
  ON suppliers(vendor_id);

-- 5. Backfill sequence_number for existing orders
--    Partition by (vendor_id, billing_type) ordered by created_at ASC, id ASC
--    Orders with NULL vendor_id are treated as global/legacy and numbered independently.
UPDATE orders
SET sequence_number = row_number
FROM (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(vendor_id::text, 'global'), billing_type
      ORDER BY created_at ASC, id ASC
    ) AS row_number
  FROM orders
  WHERE sequence_number IS NULL
) ranked
WHERE orders.id = ranked.id;

-- 6. Backfill vendor_id on stock_entries for entries linked to orders
UPDATE stock_entries se
SET vendor_id = o.vendor_id
FROM orders o
WHERE se.order_id = o.id
  AND se.vendor_id IS NULL
  AND o.vendor_id IS NOT NULL;

-- 7. Backfill vendor_id on stock_entries for purchase entries (no order) by product vendor
UPDATE stock_entries se
SET vendor_id = p.vendor_id
FROM products p
WHERE se.product_id = p.id
  AND se.order_id IS NULL
  AND se.vendor_id IS NULL
  AND p.vendor_id IS NOT NULL;

-- Verification queries (run separately to confirm correctness):
-- SELECT vendor_id, billing_type, COUNT(*), MIN(sequence_number), MAX(sequence_number)
--   FROM orders GROUP BY 1, 2 ORDER BY 1, 2;
-- SELECT COUNT(*) FROM orders WHERE sequence_number IS NULL;
-- SELECT COUNT(*) FROM stock_entries WHERE vendor_id IS NULL AND order_id IS NOT NULL;
