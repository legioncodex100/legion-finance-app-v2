-- Add debt_id column to transactions for linking repayments and loan receipts
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS debt_id UUID REFERENCES debts(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_debt_id ON transactions(debt_id);
