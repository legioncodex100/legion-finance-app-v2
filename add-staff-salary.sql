-- Add weekly_salary column to staff table
-- Run this in Supabase SQL Editor

ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS weekly_salary DECIMAL(10,2) DEFAULT 0;

-- Add is_owner flag to distinguish owners from regular staff
ALTER TABLE staff
ADD COLUMN IF NOT EXISTS is_owner BOOLEAN DEFAULT FALSE;

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'staff' 
ORDER BY ordinal_position;
