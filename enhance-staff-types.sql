-- Enhanced staff types and rates
-- Run this in Supabase SQL Editor

-- Add staff type flags (can be multiple)
ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_coach BOOLEAN DEFAULT FALSE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_facilities BOOLEAN DEFAULT FALSE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_va BOOLEAN DEFAULT FALSE;

-- Add discipline-specific rates for coaches
ALTER TABLE staff ADD COLUMN IF NOT EXISTS coach_disciplines TEXT[]; -- Array: ['BJJ', 'MMA', 'Kickboxing', 'Wrestling', 'Judo']
ALTER TABLE staff ADD COLUMN IF NOT EXISTS coach_hourly_rate DECIMAL(10,2);

-- Add facilities hourly rate
ALTER TABLE staff ADD COLUMN IF NOT EXISTS facilities_hourly_rate DECIMAL(10,2);

-- Add VA monthly rate
ALTER TABLE staff ADD COLUMN IF NOT EXISTS va_monthly_rate DECIMAL(10,2);

-- Migrate existing data based on current role
UPDATE staff SET is_coach = TRUE WHERE role = 'coach';
UPDATE staff SET is_facilities = TRUE WHERE role = 'staff';

-- Optional: Copy existing pay_rate to appropriate field
UPDATE staff SET coach_hourly_rate = pay_rate WHERE role = 'coach' AND pay_rate IS NOT NULL;
UPDATE staff SET facilities_hourly_rate = pay_rate WHERE role = 'staff' AND pay_rate IS NOT NULL;
