-- Fix: Add unique constraint for webhook upsert to work
-- Run this in Supabase SQL Editor

-- First, check for duplicates and remove them if any
DELETE FROM mb_members a
USING mb_members b
WHERE a.id > b.id 
  AND a.mb_client_id = b.mb_client_id 
  AND a.user_id = b.user_id;

-- Add unique constraint
ALTER TABLE mb_members 
ADD CONSTRAINT mb_members_client_id_unique 
UNIQUE (mb_client_id, user_id);

-- Verify
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'mb_members' 
  AND constraint_type = 'UNIQUE';
