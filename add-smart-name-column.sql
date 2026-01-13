-- Add smart name toggle to templates
-- Run this in Supabase SQL Editor

ALTER TABLE payables
ADD COLUMN IF NOT EXISTS use_smart_name BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN payables.use_smart_name IS 'If true, generated bills get smart names like "Rent - January 2026". If false, just use template name.';

-- Verify
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'payables' AND column_name = 'use_smart_name';
