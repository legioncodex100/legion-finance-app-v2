-- Mindbody Financial Intelligence Schema
-- Run this in Supabase SQL Editor

-- 1. Member Financial Data
CREATE TABLE IF NOT EXISTS mb_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    mb_client_id TEXT NOT NULL,
    
    -- Identity
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    
    -- Revenue Classification
    member_type TEXT,           -- 'monthly', 'pack', 'drop_in'
    membership_name TEXT,
    membership_status TEXT,     -- 'Active', 'Declined', 'Expired', 'Suspended'
    monthly_rate DECIMAL(10,2) DEFAULT 0,
    
    -- Credit Packs
    credits_remaining INTEGER DEFAULT 0,
    credits_expiration DATE,
    
    -- Payments
    next_payment_date DATE,
    contract_end_date DATE,
    
    -- Engagement (Aggregated)
    last_visit_date DATE,
    total_visits INTEGER DEFAULT 0,
    visits_30d INTEGER DEFAULT 0,
    visits_prev_30d INTEGER DEFAULT 0,
    
    -- Conversion Tracking
    first_purchase_type TEXT,   -- 'free_trial', 'paid_trial', 'drop_in', 'pack', 'monthly'
    first_purchase_date DATE,
    upgraded_at TIMESTAMPTZ,
    upgraded_from TEXT,
    
    -- Calculated
    lifetime_value DECIMAL(10,2) DEFAULT 0,
    churn_risk INTEGER DEFAULT 0,  -- 0-100
    
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, mb_client_id)
);

-- 2. Decline Recovery Tracking
CREATE TABLE IF NOT EXISTS mb_declines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    mb_client_id TEXT NOT NULL,
    member_name TEXT,
    email TEXT,
    phone TEXT,
    amount DECIMAL(10,2),
    decline_date DATE,
    decline_reason TEXT,
    
    -- Recovery Workflow
    status TEXT DEFAULT 'new',  -- 'new', 'contacted', 'recovered', 'lost'
    contact_attempts INTEGER DEFAULT 0,
    last_contacted_at TIMESTAMPTZ,
    recovered_at TIMESTAMPTZ,
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Class Performance (Daily Aggregates)
CREATE TABLE IF NOT EXISTS mb_class_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    class_date DATE NOT NULL,
    class_name TEXT,
    class_time TIME,
    instructor TEXT,
    
    -- Metrics
    capacity INTEGER DEFAULT 0,
    booked INTEGER DEFAULT 0,
    attended INTEGER DEFAULT 0,
    no_shows INTEGER DEFAULT 0,
    fill_rate DECIMAL(5,2) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, class_date, class_name, class_time)
);

-- 4. Weekly Trends (For Seasonal Analysis)
CREATE TABLE IF NOT EXISTS mb_weekly_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    week_of_year INTEGER NOT NULL,
    
    -- Revenue
    total_revenue DECIMAL(10,2) DEFAULT 0,
    mrr DECIMAL(10,2) DEFAULT 0,
    
    -- Members
    active_monthly INTEGER DEFAULT 0,
    active_packs INTEGER DEFAULT 0,
    new_members INTEGER DEFAULT 0,
    churned_members INTEGER DEFAULT 0,
    
    -- Conversions
    trials_started INTEGER DEFAULT 0,
    trials_converted INTEGER DEFAULT 0,
    
    -- Engagement
    total_visits INTEGER DEFAULT 0,
    avg_class_fill_rate DECIMAL(5,2) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, year, week_of_year)
);

-- 5. Sync Tracking
CREATE TABLE IF NOT EXISTS mb_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    sync_type TEXT NOT NULL,  -- 'members', 'sales', 'classes'
    last_sync_at TIMESTAMPTZ NOT NULL,
    records_synced INTEGER DEFAULT 0,
    api_calls_used INTEGER DEFAULT 0,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_mb_members_user ON mb_members(user_id);
CREATE INDEX IF NOT EXISTS idx_mb_members_status ON mb_members(user_id, membership_status);
CREATE INDEX IF NOT EXISTS idx_mb_members_churn ON mb_members(user_id, churn_risk DESC);
CREATE INDEX IF NOT EXISTS idx_mb_declines_user ON mb_declines(user_id);
CREATE INDEX IF NOT EXISTS idx_mb_declines_status ON mb_declines(user_id, status);
CREATE INDEX IF NOT EXISTS idx_mb_class_metrics_date ON mb_class_metrics(user_id, class_date);
CREATE INDEX IF NOT EXISTS idx_mb_weekly_metrics_period ON mb_weekly_metrics(user_id, year, week_of_year);

-- RLS Policies
ALTER TABLE mb_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE mb_declines ENABLE ROW LEVEL SECURITY;
ALTER TABLE mb_class_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE mb_weekly_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE mb_sync_log ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users view own mb_members" ON mb_members
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users view own mb_declines" ON mb_declines
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users view own mb_class_metrics" ON mb_class_metrics
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users view own mb_weekly_metrics" ON mb_weekly_metrics
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users view own mb_sync_log" ON mb_sync_log
    FOR ALL USING (auth.uid() = user_id);
