-- Cash Flow Forecast Schema
-- Run this in Supabase SQL Editor

-- 1. Table for tracking data source freshness
CREATE TABLE IF NOT EXISTS cash_flow_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    source_type TEXT NOT NULL, -- 'bank', 'mindbody_scheduled', 'mindbody_failed', 'historical_analysis'
    last_import_at TIMESTAMPTZ,
    import_start_date DATE,
    import_end_date DATE,
    record_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table for derived patterns from historical data
CREATE TABLE IF NOT EXISTS cash_flow_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    pattern_type TEXT NOT NULL, -- 'weekly_income', 'weekly_expense', 'seasonal'
    week_of_month INTEGER, -- 1-5 (which week of the month)
    day_of_week INTEGER, -- 0-6 (Sunday=0)
    month INTEGER, -- 1-12 for seasonality
    category_id UUID REFERENCES categories(id),
    average_amount DECIMAL(12,2) DEFAULT 0,
    total_amount DECIMAL(12,2) DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    std_deviation DECIMAL(12,2) DEFAULT 0,
    confidence DECIMAL(3,2) DEFAULT 0.50, -- 0.00 to 1.00
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, pattern_type, week_of_month, month, category_id)
);

-- 3. Table for future scheduled payments (Mindbody imports)
CREATE TABLE IF NOT EXISTS scheduled_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    source TEXT DEFAULT 'mindbody', -- 'mindbody', 'manual', 'recurring'
    client_name TEXT,
    description TEXT,
    amount DECIMAL(12,2) NOT NULL,
    scheduled_date DATE NOT NULL,
    payment_status TEXT DEFAULT 'scheduled', -- 'scheduled', 'failed', 'collected', 'cancelled'
    failure_reason TEXT,
    imported_at TIMESTAMPTZ DEFAULT NOW(),
    source_import_id UUID REFERENCES cash_flow_sources(id)
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cf_patterns_user ON cash_flow_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_cf_patterns_lookup ON cash_flow_patterns(user_id, pattern_type, week_of_month, month);
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_user_date ON scheduled_payments(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_status ON scheduled_payments(user_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_cf_sources_user ON cash_flow_sources(user_id, source_type);

-- 5. Enable RLS
ALTER TABLE cash_flow_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_flow_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_payments ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
CREATE POLICY "Users can manage their own cash flow sources"
    ON cash_flow_sources FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own cash flow patterns"
    ON cash_flow_patterns FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own scheduled payments"
    ON scheduled_payments FOR ALL
    USING (auth.uid() = user_id);

-- Success!
SELECT 'Cash flow tables created successfully!' as result;
