-- Migration Script: Move bills and invoices to payables table
-- Run this in Supabase SQL Editor AFTER create-payables-table.sql

-- 1. Migrate recurring_bills → payables
INSERT INTO payables (
    user_id,
    name,
    payee_type,
    vendor_id,
    amount,
    frequency,
    next_due,
    is_recurring,
    bill_status,
    is_paid,
    last_paid_date,
    document_url,
    category_id,
    auto_pay,
    reminder_days,
    notes,
    description
)
SELECT 
    user_id,
    name,
    'vendor',
    vendor_id,
    amount,
    CASE 
        WHEN frequency = 'yearly' THEN 'yearly'
        WHEN frequency = 'annual' THEN 'yearly'
        WHEN frequency = 'quarterly' THEN 'quarterly'
        WHEN frequency = 'monthly' THEN 'monthly'
        WHEN frequency = 'weekly' THEN 'weekly'
        ELSE 'one-time'
    END,
    next_due,
    CASE WHEN frequency IS NOT NULL AND frequency != 'one-time' THEN TRUE ELSE FALSE END,
    CASE 
        WHEN is_paid = TRUE THEN 'paid'
        WHEN next_due < CURRENT_DATE THEN 'overdue'
        ELSE 'approved'
    END,
    COALESCE(is_paid, FALSE),
    last_paid_date,
    document_url,
    category_id,
    COALESCE(auto_pay, FALSE),
    COALESCE(reminder_days, 3),
    NULL,
    description
FROM recurring_bills
WHERE NOT EXISTS (
    SELECT 1 FROM payables p 
    WHERE p.name = recurring_bills.name 
    AND p.user_id = recurring_bills.user_id
    AND p.next_due = recurring_bills.next_due
);

-- 2. Migrate coach_invoices → payables (as staff payables)
INSERT INTO payables (
    user_id,
    name,
    payee_type,
    vendor_id,
    amount,
    frequency,
    next_due,
    is_recurring,
    bill_status,
    invoice_number,
    notes
)
SELECT 
    user_id,
    COALESCE((SELECT v.name FROM vendors v WHERE v.id = ci.vendor_id), 'Staff Invoice'),
    'staff',
    vendor_id,
    amount,
    'one-time',
    due_date,
    FALSE,
    CASE 
        WHEN status = 'paid' THEN 'paid'
        WHEN status = 'overdue' THEN 'overdue'
        ELSE 'approved'
    END,
    invoice_number,
    notes
FROM coach_invoices ci
WHERE NOT EXISTS (
    SELECT 1 FROM payables p 
    WHERE p.invoice_number = ci.invoice_number 
    AND p.user_id = ci.user_id
);

-- 3. Show migration summary
SELECT 
    'Migration complete' as status,
    (SELECT COUNT(*) FROM payables WHERE payee_type = 'vendor') as vendor_bills,
    (SELECT COUNT(*) FROM payables WHERE payee_type = 'staff') as staff_invoices,
    (SELECT COUNT(*) FROM payables) as total_payables;
