-- Fix existing bills that are incorrectly marked as paid
-- Run AFTER add-bill-payments.sql
UPDATE recurring_bills 
SET is_paid = false 
WHERE is_paid = true OR is_paid IS NULL;
