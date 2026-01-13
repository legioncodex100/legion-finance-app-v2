-- Mindbody Enrichment Layer Schema
-- Run this in Supabase SQL Editor after the main mb schema

-- 1. Transactions - Store every transaction with fee calculation
CREATE TABLE IF NOT EXISTS mb_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    mb_client_id TEXT,
    mb_sale_id TEXT NOT NULL,
    mb_transaction_id TEXT NOT NULL,
    
    -- Revenue Breakdown
    gross_amount DECIMAL(10,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    tip_amount DECIMAL(10,2) DEFAULT 0,
    net_amount DECIMAL(10,2) DEFAULT 0,
    
    -- Payment Details (for fee calculation)
    payment_type TEXT,                    -- 'CreditCard', 'DirectDebit', 'Account', 'Cash'
    entry_method TEXT,                    -- 'CardPresent', 'CardNotPresent', 'Bacs', 'Manual'
    settlement_id TEXT,                   -- Links to bank batch
    
    -- UK Merchant Fee Calculation
    calculated_fee DECIMAL(10,2) DEFAULT 0,
    fee_rate DECIMAL(5,4) DEFAULT 0,
    fixed_fee DECIMAL(10,2) DEFAULT 0,
    
    -- Status
    status TEXT DEFAULT 'Completed',      -- 'Completed', 'Declined', 'Refunded', 'Voided'
    decline_reason TEXT,
    
    -- Item details
    description TEXT,
    item_type TEXT,                       -- 'Membership', 'Pack', 'DropIn', 'Product'
    
    transaction_date TIMESTAMPTZ,
    settlement_date DATE,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, mb_transaction_id)
);

-- 2. Settlements - Bank batch matching for reconciliation
CREATE TABLE IF NOT EXISTS mb_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    settlement_id TEXT NOT NULL,
    settlement_date DATE,
    
    -- Totals from Mindbody
    mb_gross DECIMAL(10,2) DEFAULT 0,
    mb_tax DECIMAL(10,2) DEFAULT 0,
    mb_tips DECIMAL(10,2) DEFAULT 0,
    mb_fees DECIMAL(10,2) DEFAULT 0,
    mb_net DECIMAL(10,2) DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    
    -- Bank Match (links to your transactions table)
    bank_transaction_id UUID,
    bank_amount DECIMAL(10,2),
    
    -- Reconciliation Status
    reconciled BOOLEAN DEFAULT false,
    reconciled_at TIMESTAMPTZ,
    variance DECIMAL(10,2) DEFAULT 0,     -- Difference for review
    auto_reconciled BOOLEAN DEFAULT false,
    
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, settlement_id)
);

-- 3. Memberships - Active/Suspended/Terminated tracking
CREATE TABLE IF NOT EXISTS mb_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    mb_client_id TEXT NOT NULL,
    mb_membership_id TEXT NOT NULL,
    
    -- Membership Details
    membership_name TEXT,
    program_name TEXT,
    status TEXT,                          -- 'Active', 'Suspended', 'Terminated', 'Expired'
    
    -- Dates
    start_date DATE,
    end_date DATE,
    termination_date DATE,
    
    -- Payment Info
    autopay_enabled BOOLEAN DEFAULT false,
    payment_amount DECIMAL(10,2) DEFAULT 0,
    next_payment_date DATE,
    
    -- Risk Flags
    expiring_soon BOOLEAN DEFAULT false,  -- Within 30 days
    at_risk BOOLEAN DEFAULT false,        -- Low attendance or payment issues
    
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, mb_membership_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_mb_transactions_user ON mb_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_mb_transactions_settlement ON mb_transactions(user_id, settlement_id);
CREATE INDEX IF NOT EXISTS idx_mb_transactions_date ON mb_transactions(user_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_mb_transactions_client ON mb_transactions(user_id, mb_client_id);

CREATE INDEX IF NOT EXISTS idx_mb_settlements_user ON mb_settlements(user_id);
CREATE INDEX IF NOT EXISTS idx_mb_settlements_date ON mb_settlements(user_id, settlement_date);
CREATE INDEX IF NOT EXISTS idx_mb_settlements_reconciled ON mb_settlements(user_id, reconciled);

CREATE INDEX IF NOT EXISTS idx_mb_memberships_user ON mb_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_mb_memberships_client ON mb_memberships(user_id, mb_client_id);
CREATE INDEX IF NOT EXISTS idx_mb_memberships_status ON mb_memberships(user_id, status);
CREATE INDEX IF NOT EXISTS idx_mb_memberships_expiring ON mb_memberships(user_id, expiring_soon);

-- RLS Policies
ALTER TABLE mb_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mb_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE mb_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own mb_transactions" ON mb_transactions
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users view own mb_settlements" ON mb_settlements
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users view own mb_memberships" ON mb_memberships
    FOR ALL USING (auth.uid() = user_id);
