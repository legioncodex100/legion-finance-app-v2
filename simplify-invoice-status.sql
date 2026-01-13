-- Simplify invoice status
-- Run this in Supabase SQL Editor

-- Update existing invoice statuses to new values
UPDATE invoices SET status = 'pending' WHERE status IN ('draft', 'submitted');
UPDATE invoices SET status = 'paid' WHERE status = 'approved';

-- Note: 'rejected' -> 'review' migration if any exist
UPDATE invoices SET status = 'review' WHERE status = 'rejected';

-- Update the status constraint (if it exists)
-- ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
-- ALTER TABLE invoices ADD CONSTRAINT invoices_status_check CHECK (status IN ('pending', 'paid', 'review'));
