-- Add bill_id to transactions for linking payments to bills
-- Run this in Supabase SQL Editor

-- Add the bill_id column
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS bill_id UUID REFERENCES recurring_bills(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_bill_id ON transactions(bill_id);

-- Function to advance next_due date based on bill frequency
CREATE OR REPLACE FUNCTION advance_bill_next_due(p_bill_id UUID)
RETURNS void AS $$
DECLARE
    v_frequency TEXT;
    v_current_next_due DATE;
BEGIN
    SELECT frequency, next_due INTO v_frequency, v_current_next_due
    FROM recurring_bills
    WHERE id = p_bill_id;
    
    -- Calculate new next_due based on frequency
    UPDATE recurring_bills
    SET next_due = CASE v_frequency
        WHEN 'weekly' THEN v_current_next_due + INTERVAL '1 week'
        WHEN 'fortnightly' THEN v_current_next_due + INTERVAL '2 weeks'
        WHEN 'monthly' THEN v_current_next_due + INTERVAL '1 month'
        WHEN 'quarterly' THEN v_current_next_due + INTERVAL '3 months'
        WHEN 'yearly' THEN v_current_next_due + INTERVAL '1 year'
        WHEN 'annually' THEN v_current_next_due + INTERVAL '1 year'
        ELSE v_current_next_due + INTERVAL '1 month'
    END,
    is_paid = false,  -- Reset for next period
    last_paid_date = CURRENT_DATE
    WHERE id = p_bill_id;
END;
$$ LANGUAGE plpgsql;

SELECT 'Bill linking columns added!' as result;
