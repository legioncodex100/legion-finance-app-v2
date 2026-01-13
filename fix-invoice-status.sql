-- Fix invoice status constraint to allow new values
-- Run this in Supabase SQL Editor

-- First, drop any existing constraint on status
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;

-- Add new constraint with correct values
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check 
  CHECK (status IN ('pending', 'paid', 'review'));

-- Also fix any remaining old status values
UPDATE invoices SET status = 'pending' WHERE status NOT IN ('pending', 'paid', 'review');
