-- Add full address fields to mb_members
-- Run this in Supabase SQL Editor

ALTER TABLE mb_members ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE mb_members ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE mb_members ADD COLUMN IF NOT EXISTS address_line1 TEXT;
ALTER TABLE mb_members ADD COLUMN IF NOT EXISTS address_city TEXT;
ALTER TABLE mb_members ADD COLUMN IF NOT EXISTS address_state TEXT;
ALTER TABLE mb_members ADD COLUMN IF NOT EXISTS address_postal_code TEXT;
ALTER TABLE mb_members ADD COLUMN IF NOT EXISTS creation_date DATE;
