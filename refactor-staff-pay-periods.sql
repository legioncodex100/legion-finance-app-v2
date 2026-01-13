-- Refactor staff payment structure
-- Each staff type has its own rate AND pay period
-- Run this in Supabase SQL Editor

-- Add pay period columns per type
ALTER TABLE staff ADD COLUMN IF NOT EXISTS coach_pay_period TEXT DEFAULT 'hourly' CHECK (coach_pay_period IN ('hourly', 'weekly', 'monthly'));
ALTER TABLE staff ADD COLUMN IF NOT EXISTS facilities_pay_period TEXT DEFAULT 'hourly' CHECK (facilities_pay_period IN ('hourly', 'weekly', 'monthly'));
ALTER TABLE staff ADD COLUMN IF NOT EXISTS va_pay_period TEXT DEFAULT 'monthly' CHECK (va_pay_period IN ('hourly', 'weekly', 'monthly'));

-- Note: coach_hourly_rate, facilities_hourly_rate, va_monthly_rate columns already exist
-- Now they're just "rates" that can be hourly/weekly/monthly based on the pay_period

-- Optional: Drop the old 'role' column if no longer needed
-- ALTER TABLE staff DROP COLUMN IF EXISTS role;
