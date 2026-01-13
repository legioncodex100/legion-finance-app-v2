-- Payables Table Schema for Accounts Payable Module
-- Run this in Supabase SQL Editor

-- 1. Create payables table
CREATE TABLE IF NOT EXISTS payables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Payee Information
    name TEXT NOT NULL,
    payee_type TEXT CHECK (payee_type IN ('vendor', 'staff', 'system')) DEFAULT 'vendor',
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    
    -- Amount Details
    amount DECIMAL(12,2) NOT NULL,
    amount_tax DECIMAL(12,2) DEFAULT 0,
    
    -- Scheduling
    frequency TEXT CHECK (frequency IN ('one-time', 'weekly', 'monthly', 'quarterly', 'yearly')) DEFAULT 'one-time',
    next_due DATE NOT NULL,
    is_recurring BOOLEAN DEFAULT FALSE,
    
    -- Status
    bill_status TEXT CHECK (bill_status IN ('draft', 'approved', 'scheduled', 'paid', 'voided', 'overdue')) DEFAULT 'approved',
    is_paid BOOLEAN DEFAULT FALSE,
    last_paid_date DATE,
    
    -- System Generated (Mindbody fees, salary auto-bills)
    is_system_generated BOOLEAN DEFAULT FALSE,
    
    -- Reconciliation
    linked_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    reconciled_at TIMESTAMPTZ,
    
    -- Documents & Notes
    document_url TEXT,
    invoice_number TEXT,
    notes TEXT,
    description TEXT,
    
    -- Category
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    
    -- Auto-pay settings
    auto_pay BOOLEAN DEFAULT FALSE,
    reminder_days INTEGER DEFAULT 3,
    payment_method TEXT CHECK (payment_method IN ('bacs', 'direct_debit', 'card', 'cash', 'auto')) DEFAULT 'bacs',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE payables ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policy
CREATE POLICY "Payables Access" ON payables 
    FOR ALL 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payables_user_due ON payables(user_id, next_due);
CREATE INDEX IF NOT EXISTS idx_payables_user_status ON payables(user_id, bill_status);
CREATE INDEX IF NOT EXISTS idx_payables_user_payee ON payables(user_id, payee_type);
CREATE INDEX IF NOT EXISTS idx_payables_vendor ON payables(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payables_staff ON payables(staff_id);
CREATE INDEX IF NOT EXISTS idx_payables_transaction ON payables(linked_transaction_id);

-- 5. Add linked_payable_id to transactions for reverse lookup
ALTER TABLE transactions 
    ADD COLUMN IF NOT EXISTS linked_payable_id UUID REFERENCES payables(id) ON DELETE SET NULL;
