-- Add service date range to invoices
-- Run this in Supabase SQL Editor

-- Rename service_date to service_date_from and add service_date_to
ALTER TABLE invoices RENAME COLUMN service_date TO service_date_from;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS service_date_to DATE;
