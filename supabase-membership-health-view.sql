-- Membership Health Snapshot View
-- Creates a dynamic view of member health derived from transaction data
-- This avoids N+1 API calls to Mindbody's slow Autopay endpoint

-- Run this in Supabase SQL Editor

CREATE OR REPLACE VIEW membership_health_snapshot AS
WITH latest_payments AS (
    -- Get the last successful and last failed payment for every client
    SELECT 
        mb_client_id,
        user_id,
        MAX(CASE WHEN status = 'Approved' OR status = 'Completed' THEN transaction_date END) as last_success,
        MAX(CASE WHEN status IN ('Declined', 'Voided', 'Rejected') THEN transaction_date END) as last_failure,
        COUNT(*) FILTER (WHERE status IN ('Declined', 'Voided', 'Rejected') AND transaction_date > NOW() - INTERVAL '31 days') as recent_declines
    FROM mb_transactions
    GROUP BY mb_client_id, user_id
)
SELECT 
    m.id,
    m.user_id,
    m.mb_client_id,
    m.first_name,
    m.last_name,
    m.email,
    m.phone,
    m.monthly_rate,
    m.membership_status as synced_status,
    m.next_payment_date,
    lp.last_success,
    lp.last_failure,
    lp.recent_declines,
    
    -- Days since last payment
    EXTRACT(DAY FROM NOW() - lp.last_success::timestamp)::integer as days_since_payment,
    
    -- THE HIERARCHY LOGIC (Priority: Suspended > Declined > Active > At Risk > Inactive)
    CASE 
        WHEN m.membership_status = 'Suspended' THEN 'Suspended'
        WHEN lp.recent_declines > 0 THEN 'Declined'
        WHEN m.monthly_rate > 0 AND lp.last_success > NOW() - INTERVAL '35 days' THEN 'Active'
        WHEN m.monthly_rate > 0 AND lp.last_success > NOW() - INTERVAL '45 days' THEN 'At Risk'
        WHEN m.monthly_rate > 0 AND (lp.last_success < NOW() - INTERVAL '45 days' OR lp.last_success IS NULL) THEN 'Churned'
        ELSE 'Inactive'
    END as derived_status
FROM mb_members m
LEFT JOIN latest_payments lp ON m.mb_client_id = lp.mb_client_id AND m.user_id = lp.user_id;

-- Enable RLS on the view by creating a function-based policy
-- Views inherit RLS from underlying tables, so no additional policy needed

-- Create index for performance on the base tables if not exists
CREATE INDEX IF NOT EXISTS idx_mb_transactions_client_status 
ON mb_transactions(user_id, mb_client_id, status, transaction_date);

-- Verify the view works
SELECT derived_status, COUNT(*) as count, SUM(monthly_rate) as mrr
FROM membership_health_snapshot
GROUP BY derived_status
ORDER BY 
    CASE derived_status 
        WHEN 'Active' THEN 1 
        WHEN 'At Risk' THEN 2
        WHEN 'Declined' THEN 3
        WHEN 'Suspended' THEN 4
        WHEN 'Churned' THEN 5
        ELSE 6 
    END;
