-- Clean up existing rule names to use new format: [keywords] → [category]
-- Run this in Supabase SQL Editor

-- First, let's see what we have
-- SELECT id, name, match_type, action_category_id FROM reconciliation_rules;

-- Update rules to use cleaner naming: [condition values] → [category name]
UPDATE reconciliation_rules r
SET name = CONCAT(
    CASE 
        -- For vendor rules: use vendor name
        WHEN r.match_type = 'vendor' AND r.match_vendor_id IS NOT NULL THEN
            (SELECT v.name FROM vendors v WHERE v.id = r.match_vendor_id)
        -- For staff rules: use staff name
        WHEN r.match_type = 'staff' AND r.match_staff_id IS NOT NULL THEN
            (SELECT s.name FROM staff s WHERE s.id = r.match_staff_id)
        -- For description rules: use the pattern
        WHEN r.match_type = 'description' AND r.match_description_pattern IS NOT NULL THEN
            CONCAT('"', LEFT(r.match_description_pattern, 20), 
                   CASE WHEN LENGTH(r.match_description_pattern) > 20 THEN '…' ELSE '' END, '"')
        -- For counter_party rules
        WHEN r.match_counter_party_pattern IS NOT NULL THEN
            CONCAT(LEFT(r.match_counter_party_pattern, 20),
                   CASE WHEN LENGTH(r.match_counter_party_pattern) > 20 THEN '…' ELSE '' END)
        -- For amount rules
        WHEN r.match_type = 'amount' THEN
            CONCAT('£', COALESCE(r.match_amount_min::text, '0'), '-', COALESCE(r.match_amount_max::text, '∞'))
        -- For composite/conditions rules: try to extract from name
        ELSE LEFT(REGEXP_REPLACE(r.name, '^Auto:\s*', ''), 30)
    END,
    ' → ',
    COALESCE((SELECT c.name FROM categories c WHERE c.id = r.action_category_id), 'Unknown')
)
WHERE r.name LIKE 'Auto:%' OR r.name LIKE 'Auto-categorize%';

-- Verify the changes
SELECT id, name, match_type, 
       (SELECT c.name FROM categories c WHERE c.id = r.action_category_id) as category
FROM reconciliation_rules r
ORDER BY name;
