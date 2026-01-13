-- Add external_id and source columns to transactions for bank sync deduplication
-- Run this in Supabase SQL Editor

-- external_id stores Starling's feedItemUid (or other external IDs)
-- source tracks where the transaction came from

ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS external_id TEXT,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- Create unique index on external_id for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_external_id 
ON transactions(external_id) 
WHERE external_id IS NOT NULL;

-- Add comments
COMMENT ON COLUMN transactions.external_id IS 'External ID from bank sync (e.g., Starling feedItemUid)';
COMMENT ON COLUMN transactions.source IS 'Source of transaction: manual, starling, mindbody';

-- Verify
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'transactions' AND column_name IN ('external_id', 'source');
