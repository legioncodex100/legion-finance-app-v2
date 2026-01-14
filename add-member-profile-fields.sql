-- Migration: Add member profile fields
-- Run this in Supabase SQL Editor

-- ============================================
-- MERGE TRACKING FIELDS
-- ============================================

-- Track when clients are merged in Mindbody
ALTER TABLE mb_members ADD COLUMN IF NOT EXISTS merged_into_id TEXT;
ALTER TABLE mb_members ADD COLUMN IF NOT EXISTS is_merged BOOLEAN DEFAULT false;
ALTER TABLE mb_members ADD COLUMN IF NOT EXISTS merged_at TIMESTAMPTZ;

-- ============================================
-- PROFILE FIELDS
-- ============================================

-- Contact info
ALTER TABLE mb_members ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE mb_members ADD COLUMN IF NOT EXISTS mobile_phone TEXT;
ALTER TABLE mb_members ADD COLUMN IF NOT EXISTS home_phone TEXT;
ALTER TABLE mb_members ADD COLUMN IF NOT EXISTS work_phone TEXT;

-- Personal info
ALTER TABLE mb_members ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE mb_members ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE mb_members ADD COLUMN IF NOT EXISTS address_line1 TEXT;
ALTER TABLE mb_members ADD COLUMN IF NOT EXISTS address_line2 TEXT;
ALTER TABLE mb_members ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE mb_members ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE mb_members ADD COLUMN IF NOT EXISTS country TEXT;

-- Membership details
ALTER TABLE mb_members ADD COLUMN IF NOT EXISTS join_date DATE;
ALTER TABLE mb_members ADD COLUMN IF NOT EXISTS referred_by TEXT;
ALTER TABLE mb_members ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE mb_members ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;

-- Internal notes
ALTER TABLE mb_members ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE mb_members ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- Photo URL from Mindbody
ALTER TABLE mb_members ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- ============================================
-- INDEXES
-- ============================================

-- Index for filtering out merged members
CREATE INDEX IF NOT EXISTS idx_mb_members_is_merged ON mb_members(is_merged);

-- Index for search
CREATE INDEX IF NOT EXISTS idx_mb_members_email ON mb_members(email);
CREATE INDEX IF NOT EXISTS idx_mb_members_phone ON mb_members(phone);

-- ============================================
-- VERIFY
-- ============================================
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'mb_members' 
ORDER BY ordinal_position;
