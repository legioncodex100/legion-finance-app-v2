-- Bills Enhancement Migration
-- Adds new columns to recurring_bills table for enhanced functionality

-- Add category reference for expense categorization
ALTER TABLE recurring_bills ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id);

-- Add description for notes
ALTER TABLE recurring_bills ADD COLUMN IF NOT EXISTS description TEXT;

-- Auto-pay indicator
ALTER TABLE recurring_bills ADD COLUMN IF NOT EXISTS auto_pay BOOLEAN DEFAULT FALSE;

-- Days before due date to show reminder
ALTER TABLE recurring_bills ADD COLUMN IF NOT EXISTS reminder_days INTEGER DEFAULT 3;

-- Track when bill was last paid
ALTER TABLE recurring_bills ADD COLUMN IF NOT EXISTS last_paid_date DATE;

-- Bill status: active, paused, cancelled
ALTER TABLE recurring_bills ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Add constraint for status values
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recurring_bills_status_check') THEN
        ALTER TABLE recurring_bills ADD CONSTRAINT recurring_bills_status_check 
        CHECK (status IN ('active', 'paused', 'cancelled'));
    END IF;
END $$;

-- Add created_at for sorting (if not exists)
ALTER TABLE recurring_bills ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_recurring_bills_status ON recurring_bills(status);
CREATE INDEX IF NOT EXISTS idx_recurring_bills_next_due ON recurring_bills(next_due);
