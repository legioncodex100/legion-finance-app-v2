-- Add debt name/reference field
-- Run this in Supabase SQL Editor

ALTER TABLE debts ADD COLUMN IF NOT EXISTS name TEXT;

-- If you want to migrate existing data, uncomment this:
-- UPDATE debts SET name = creditor_name WHERE name IS NULL;
