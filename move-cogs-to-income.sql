-- Move COGS category to be under Income (in Revenue class)

-- First, find the Income category ID
SELECT id, name, parent_id, class_id 
FROM categories 
WHERE name ILIKE '%Income%' AND parent_id IS NULL
LIMIT 5;

-- Find the COGS category
SELECT id, name, parent_id, class_id 
FROM categories 
WHERE name ILIKE '%COGS%' OR name ILIKE '%Cost of Goods%' OR name ILIKE '%Cost of Sales%'
LIMIT 5;

-- After checking the results, run this to update COGS parent to Income:
-- Replace 'INCOME_CATEGORY_ID' with the actual ID from the first query
-- Replace 'COGS_CATEGORY_ID' with the actual ID from the second query

-- UPDATE categories 
-- SET parent_id = 'INCOME_CATEGORY_ID'
-- WHERE id = 'COGS_CATEGORY_ID';
