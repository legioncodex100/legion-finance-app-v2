-- Add amount_paid column to payables table for partial payment tracking
-- Run this in Supabase SQL Editor

ALTER TABLE payables ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(12,2) DEFAULT 0;

COMMENT ON COLUMN payables.amount_paid IS 'Tracks total amount paid so far for partial payment support';

-- Verify column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'payables' AND column_name = 'amount_paid';
