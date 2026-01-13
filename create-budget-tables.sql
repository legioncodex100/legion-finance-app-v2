-- Predictive Budgeting Module - Database Schema
-- Run this in Supabase SQL Editor

-- Budget Scenarios table - stores named budget versions
CREATE TABLE IF NOT EXISTS budget_scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    year INT NOT NULL DEFAULT 2026,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT false,
    inflation_rate DECIMAL(5,2) DEFAULT 3.0,
    revenue_growth_rate DECIMAL(5,2) DEFAULT 5.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Budget Items table - individual line items per category/month
CREATE TABLE IF NOT EXISTS budget_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id UUID REFERENCES budget_scenarios(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    month INT NOT NULL CHECK (month >= 1 AND month <= 12),
    budgeted_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    is_auto_populated BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(scenario_id, category_id, month)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_budget_scenarios_user ON budget_scenarios(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_scenarios_year ON budget_scenarios(year);
CREATE INDEX IF NOT EXISTS idx_budget_items_scenario ON budget_items(scenario_id);
CREATE INDEX IF NOT EXISTS idx_budget_items_category ON budget_items(category_id);

-- RLS Policies
ALTER TABLE budget_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;

-- Scenarios policies
CREATE POLICY "Users can view own budget scenarios"
    ON budget_scenarios FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own budget scenarios"
    ON budget_scenarios FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budget scenarios"
    ON budget_scenarios FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own budget scenarios"
    ON budget_scenarios FOR DELETE
    USING (auth.uid() = user_id);

-- Items policies (via scenario ownership)
CREATE POLICY "Users can view budget items via scenario"
    ON budget_items FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM budget_scenarios 
        WHERE budget_scenarios.id = budget_items.scenario_id 
        AND budget_scenarios.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert budget items via scenario"
    ON budget_items FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM budget_scenarios 
        WHERE budget_scenarios.id = budget_items.scenario_id 
        AND budget_scenarios.user_id = auth.uid()
    ));

CREATE POLICY "Users can update budget items via scenario"
    ON budget_items FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM budget_scenarios 
        WHERE budget_scenarios.id = budget_items.scenario_id 
        AND budget_scenarios.user_id = auth.uid()
    ));

CREATE POLICY "Users can delete budget items via scenario"
    ON budget_items FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM budget_scenarios 
        WHERE budget_scenarios.id = budget_items.scenario_id 
        AND budget_scenarios.user_id = auth.uid()
    ));
