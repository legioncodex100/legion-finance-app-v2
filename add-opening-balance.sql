-- Add opening balance to user settings
-- Run this in Supabase SQL Editor

-- Add opening_balance column to track starting bank balance
ALTER TABLE cash_flow_sources 
ADD COLUMN IF NOT EXISTS opening_balance DECIMAL(12,2) DEFAULT 0;

-- Create a simple settings table if needed for user preferences
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL UNIQUE,
    opening_balance DECIMAL(12,2) DEFAULT 0,
    opening_balance_date DATE DEFAULT CURRENT_DATE,
    danger_threshold DECIMAL(12,2) DEFAULT 2000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Users can manage their own settings"
    ON user_settings FOR ALL
    USING (auth.uid() = user_id);

SELECT 'Opening balance support added!' as result;
