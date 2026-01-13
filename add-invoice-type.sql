-- Add invoice_type column to track what type of work the invoice is for
-- Run this in Supabase SQL Editor

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_type TEXT CHECK (invoice_type IN ('coaching', 'facilities', 'va'));
