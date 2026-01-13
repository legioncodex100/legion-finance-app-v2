-- Add variable amount column to payables
-- Run this in Supabase SQL Editor

ALTER TABLE payables
ADD COLUMN IF NOT EXISTS is_variable_amount BOOLEAN DEFAULT FALSE;

-- Comment
COMMENT ON COLUMN payables.is_variable_amount IS 'True for metered/variable bills like electricity where amount changes each period';

-- Verify
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'payables' AND column_name = 'is_variable_amount';
