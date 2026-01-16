-- Create payable_transactions junction table
-- Allows multiple transactions to be linked to a single payable (bill)
-- Run this in Supabase SQL Editor

-- Create the junction table
CREATE TABLE IF NOT EXISTS payable_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payable_id UUID NOT NULL REFERENCES payables(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,  -- Amount from this transaction applied to the bill
    notes TEXT,
    linked_at TIMESTAMPTZ DEFAULT NOW(),
    linked_by UUID REFERENCES auth.users(id),
    
    -- Prevent duplicate links
    UNIQUE(payable_id, transaction_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_payable_transactions_payable ON payable_transactions(payable_id);
CREATE INDEX IF NOT EXISTS idx_payable_transactions_transaction ON payable_transactions(transaction_id);

-- RLS policies
ALTER TABLE payable_transactions ENABLE ROW LEVEL SECURITY;

-- Users can see their own links (through payables they own)
CREATE POLICY "Users can view their own payable links"
ON payable_transactions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM payables 
        WHERE payables.id = payable_transactions.payable_id 
        AND payables.user_id = auth.uid()
    )
);

-- Users can insert links for their own payables
CREATE POLICY "Users can create payable links"
ON payable_transactions FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM payables 
        WHERE payables.id = payable_transactions.payable_id 
        AND payables.user_id = auth.uid()
    )
);

-- Users can delete their own links
CREATE POLICY "Users can delete their own payable links"
ON payable_transactions FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM payables 
        WHERE payables.id = payable_transactions.payable_id 
        AND payables.user_id = auth.uid()
    )
);

-- Migrate existing linked_transaction_id data to the new table
INSERT INTO payable_transactions (payable_id, transaction_id, amount, linked_at, linked_by)
SELECT 
    p.id as payable_id,
    p.linked_transaction_id as transaction_id,
    COALESCE(ABS(t.amount), p.amount_paid, 0) as amount,
    p.reconciled_at as linked_at,
    p.user_id as linked_by
FROM payables p
LEFT JOIN transactions t ON t.id = p.linked_transaction_id
WHERE p.linked_transaction_id IS NOT NULL
ON CONFLICT (payable_id, transaction_id) DO NOTHING;

-- Verify migration
SELECT 'Migrated ' || COUNT(*) || ' existing links' as result FROM payable_transactions;

-- Show table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'payable_transactions';
