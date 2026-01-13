-- Migration Script: Move INVOICES table to payables
-- Run this in Supabase SQL Editor

-- Migrate invoices → payables (as staff invoices)
INSERT INTO payables (
    user_id,
    name,
    payee_type,
    staff_id,
    amount,
    frequency,
    next_due,
    is_recurring,
    bill_status,
    is_paid,
    invoice_number,
    notes,
    description,
    document_url
)
SELECT 
    i.user_id,
    COALESCE(s.name, 'Staff Invoice') || ' - ' || i.invoice_number,
    'staff',
    i.staff_id,
    i.amount,
    'one-time',
    COALESCE(i.due_date, i.service_date_from),
    FALSE,
    CASE 
        WHEN i.status = 'paid' THEN 'paid'
        WHEN i.status = 'review' THEN 'draft'
        ELSE 'approved'
    END,
    CASE WHEN i.status = 'paid' THEN TRUE ELSE FALSE END,
    i.invoice_number,
    i.notes,
    COALESCE(i.description, '') || 
        CASE WHEN i.hours_worked IS NOT NULL 
            THEN ' (' || i.hours_worked || 'h @ £' || i.hourly_rate || '/h)'
            ELSE '' 
        END,
    i.document_url
FROM invoices i
LEFT JOIN staff s ON i.staff_id = s.id
WHERE NOT EXISTS (
    SELECT 1 FROM payables p 
    WHERE p.invoice_number = i.invoice_number 
    AND p.user_id = i.user_id
);

-- Show migration summary
SELECT 
    'Invoices migrated' as status,
    (SELECT COUNT(*) FROM payables WHERE payee_type = 'staff') as staff_invoices,
    (SELECT COUNT(*) FROM payables WHERE payee_type = 'vendor') as vendor_bills,
    (SELECT COUNT(*) FROM payables) as total_payables;
