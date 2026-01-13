-- Migrate existing recurring payables to templates
-- Run this in Supabase SQL Editor

-- This will create a template for each unique recurring bill pattern
-- (based on vendor_id, staff_id, amount, and frequency)

INSERT INTO payables (
    user_id,
    name,
    payee_type,
    vendor_id,
    staff_id,
    amount,
    amount_tax,
    frequency,
    next_due,
    is_recurring,
    is_template,
    is_active,
    is_variable_amount,
    bill_status,
    category_id,
    auto_pay,
    notes,
    created_at,
    updated_at
)
SELECT DISTINCT ON (user_id, vendor_id, staff_id, amount, frequency)
    user_id,
    -- Strip month/year from name to create base template name
    REGEXP_REPLACE(
        REGEXP_REPLACE(
            REGEXP_REPLACE(name, '\s*-\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s*\d{4}$', '', 'i'),
            '\s*\d{4}-\d{2}$', ''
        ),
        '\s*\d{4}$', ''
    ) as name,
    payee_type,
    vendor_id,
    staff_id,
    amount,
    COALESCE(amount_tax, 0),
    frequency,
    '2099-12-31'::date as next_due, -- Placeholder for templates
    true as is_recurring,
    true as is_template,
    true as is_active,
    COALESCE(is_variable_amount, false),
    'scheduled' as bill_status,
    category_id,
    COALESCE(auto_pay, false),
    'Migrated from recurring bill' as notes,
    NOW(),
    NOW()
FROM payables
WHERE is_recurring = true 
  AND (is_template = false OR is_template IS NULL)
  AND frequency != 'one-time'
ORDER BY user_id, vendor_id, staff_id, amount, frequency, created_at ASC;

-- Verify what was created
SELECT 
    name,
    frequency,
    amount,
    is_template,
    is_active
FROM payables 
WHERE is_template = true
ORDER BY name;
