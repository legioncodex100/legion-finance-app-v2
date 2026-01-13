-- Reconciliation Rules Feature Migration
-- Run this in Supabase SQL Editor after backing up your database

-- 1. Create reconciliation_rules table
CREATE TABLE reconciliation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    priority INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Match Criteria
    match_type TEXT CHECK (match_type IN ('vendor', 'description', 'amount', 'regex', 'composite')) NOT NULL,
    match_vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    match_description_pattern TEXT,
    match_amount_min DECIMAL(12, 2),
    match_amount_max DECIMAL(12, 2),
    match_transaction_type TEXT CHECK (match_transaction_type IN ('income', 'expense')),
    
    -- Actions
    action_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    action_notes_template TEXT,
    requires_approval BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_matched_at TIMESTAMPTZ,
    match_count INTEGER DEFAULT 0,
    
    UNIQUE(name, user_id)
);

-- 2. Create pending_matches table
CREATE TABLE pending_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    rule_id UUID NOT NULL REFERENCES reconciliation_rules(id) ON DELETE CASCADE,
    
    suggested_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    suggested_notes TEXT,
    match_confidence DECIMAL(3, 2) DEFAULT 1.00,
    
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    
    UNIQUE(transaction_id, rule_id)
);

-- 3. Add new columns to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reconciliation_status TEXT 
    CHECK (reconciliation_status IN (
        'unreconciled',
        'pending_approval',
        'approved',
        'rejected', 
        'manually_matched',
        'exception'
    )) DEFAULT 'unreconciled';

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS matched_rule_id UUID REFERENCES reconciliation_rules(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reconciled_by TEXT;

-- 4. Enable RLS on new tables
ALTER TABLE reconciliation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_matches ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies
CREATE POLICY "Rules Access" ON reconciliation_rules 
    FOR ALL USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Pending Matches Access" ON pending_matches 
    FOR ALL USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

-- 6. Create indexes for performance
CREATE INDEX idx_rules_user_active ON reconciliation_rules(user_id, is_active);
CREATE INDEX idx_rules_user_priority ON reconciliation_rules(user_id, priority);
CREATE INDEX idx_pending_user_status ON pending_matches(user_id, status);
CREATE INDEX idx_pending_transaction ON pending_matches(transaction_id);
CREATE INDEX idx_transactions_recon_status ON transactions(user_id, reconciliation_status);

-- 7. Update existing transactions to have reconciliation_status based on confirmed flag
UPDATE transactions 
SET reconciliation_status = CASE 
    WHEN confirmed = TRUE THEN 'manually_matched'
    ELSE 'unreconciled'
END
WHERE reconciliation_status IS NULL;
