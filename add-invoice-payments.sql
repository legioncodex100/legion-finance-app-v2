-- Create invoice_payments table to track transaction-to-invoice links
-- Supports partial payments (multiple transactions per invoice)
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS invoice_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id),
    
    -- Prevent duplicate links
    UNIQUE(invoice_id, transaction_id)
);

-- Add RLS policies
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invoice payments"
    ON invoice_payments FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own invoice payments"
    ON invoice_payments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own invoice payments"
    ON invoice_payments FOR DELETE
    USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_transaction ON invoice_payments(transaction_id);
