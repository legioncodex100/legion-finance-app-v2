-- Add is_ended column for permanently ended templates
-- Run this in Supabase SQL Editor

ALTER TABLE payables
ADD COLUMN IF NOT EXISTS is_ended BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN payables.is_ended IS 'True if template is permanently ended (switched provider, cancelled service)';
COMMENT ON COLUMN payables.ended_at IS 'When the template was ended';

-- Verify
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'payables' AND column_name IN ('is_ended', 'ended_at');
