-- Asset Installment Payment Tracking
-- Adds ability to link multiple payment transactions to a single asset

-- Add amount_paid column to assets table (tracks total paid so far)
ALTER TABLE assets ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(12,2) DEFAULT 0;

-- Add asset_id column to transactions table (allows linking payments to assets)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES assets(id);

-- Index for faster asset payment lookups
CREATE INDEX IF NOT EXISTS idx_transactions_asset_id ON transactions(asset_id);
