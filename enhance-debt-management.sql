-- Enhanced Debt Management Schema
-- Run this in Supabase SQL Editor

-- 1. Creditors Table (reusable creditor profiles)
CREATE TABLE IF NOT EXISTS creditors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('bank', 'family', 'investor', 'director', 'supplier', 'other')) DEFAULT 'other',
    contact_email TEXT,
    contact_phone TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(name, user_id)
);

-- Enable RLS
ALTER TABLE creditors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creditors Access" ON creditors FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. Debt Types Table (user-customizable)
CREATE TABLE IF NOT EXISTS debt_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    name TEXT NOT NULL,
    color TEXT DEFAULT '#f59e0b',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(name, user_id)
);

-- Enable RLS
ALTER TABLE debt_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Debt Types Access" ON debt_types FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Insert default debt types for current user (run this after the table is created)
-- You can customize these in the UI later
INSERT INTO debt_types (user_id, name, sort_order) VALUES 
    ('e29589a7-3d44-4678-b06c-5829ef68cebc', 'Bank Loan', 1),
    ('e29589a7-3d44-4678-b06c-5829ef68cebc', 'Director Loan', 2),
    ('e29589a7-3d44-4678-b06c-5829ef68cebc', 'Family Loan', 3),
    ('e29589a7-3d44-4678-b06c-5829ef68cebc', 'Investor', 4),
    ('e29589a7-3d44-4678-b06c-5829ef68cebc', 'Supplier Credit', 5)
ON CONFLICT (name, user_id) DO NOTHING;

-- 3. Add new columns to debts table
ALTER TABLE debts ADD COLUMN IF NOT EXISTS creditor_id UUID REFERENCES creditors(id);
ALTER TABLE debts ADD COLUMN IF NOT EXISTS debt_type_id UUID REFERENCES debt_types(id);
ALTER TABLE debts ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('active', 'paused', 'paid_off')) DEFAULT 'active';
ALTER TABLE debts ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS target_payoff_date DATE;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS notes TEXT;

-- 4. Debt Activity Log (system + manual notes)
CREATE TABLE IF NOT EXISTS debt_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debt_id UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    activity_type TEXT CHECK (activity_type IN ('system', 'manual', 'status_change', 'payment', 'adjustment')) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE debt_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Debt Activity Access" ON debt_activity_log FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_creditors_user ON creditors(user_id);
CREATE INDEX IF NOT EXISTS idx_debt_types_user ON debt_types(user_id);
CREATE INDEX IF NOT EXISTS idx_debts_creditor ON debts(creditor_id);
CREATE INDEX IF NOT EXISTS idx_debts_type ON debts(debt_type_id);
CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status);
CREATE INDEX IF NOT EXISTS idx_debt_activity_debt ON debt_activity_log(debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_activity_created ON debt_activity_log(created_at DESC);

