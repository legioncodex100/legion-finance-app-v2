-- Fix the unique constraint on cash_flow_sources for upsert to work
-- Run this in Supabase SQL Editor

-- Check if the constraint exists
DO $$ 
BEGIN
    -- Add unique constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'cash_flow_sources_user_source_unique'
    ) THEN
        ALTER TABLE cash_flow_sources 
        ADD CONSTRAINT cash_flow_sources_user_source_unique 
        UNIQUE (user_id, source_type);
    END IF;
END $$;

-- Verify constraint was added
SELECT conname FROM pg_constraint WHERE conrelid = 'cash_flow_sources'::regclass;

-- Now manually insert a test record to verify scheduled payments
-- (Run the Mindbody sync after this)
INSERT INTO cash_flow_sources (user_id, source_type, last_import_at, record_count)
SELECT auth.uid(), 'mindbody_scheduled', NOW(), 
    (SELECT COUNT(*) FROM scheduled_payments WHERE user_id = auth.uid())
ON CONFLICT (user_id, source_type) 
DO UPDATE SET 
    last_import_at = NOW(),
    record_count = EXCLUDED.record_count;

-- Check what's in cash_flow_sources
SELECT * FROM cash_flow_sources WHERE source_type = 'mindbody_scheduled';

-- Check what's in scheduled_payments
SELECT source, payment_status, COUNT(*), SUM(amount) 
FROM scheduled_payments 
GROUP BY source, payment_status;
