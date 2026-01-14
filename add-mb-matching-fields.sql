-- Migration: Add matching fields to mb_transactions
-- This enables tracking which Mindbody collections have been matched to bank deposits

ALTER TABLE mb_transactions 
ADD COLUMN IF NOT EXISTS is_matched BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS matched_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_mb_tx_matched ON mb_transactions(is_matched);
CREATE INDEX IF NOT EXISTS idx_mb_tx_matched_txn_id ON mb_transactions(matched_transaction_id);

-- Add comment for documentation
COMMENT ON COLUMN mb_transactions.is_matched IS 'TRUE when this Mindbody collection has been matched to a bank deposit';
COMMENT ON COLUMN mb_transactions.matched_transaction_id IS 'References the bank transaction that represents this Mindbody collection deposit';
