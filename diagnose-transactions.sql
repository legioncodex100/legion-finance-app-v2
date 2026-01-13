-- Check transactions for a specific category ID
-- Run this in Supabase SQL Editor to diagnose

-- 1. Check if the category exists
SELECT id, name, parent_id, type 
FROM categories 
WHERE id = '735e00b2-f789-4a31-b600-271732688213';

-- 2. Check transactions with this exact category_id in 2025
SELECT COUNT(*), SUM(amount) as total
FROM transactions 
WHERE category_id = '735e00b2-f789-4a31-b600-271732688213'
AND transaction_date >= '2025-01-01'
AND transaction_date < '2026-01-01';

-- 3. Show sample transactions for this category
SELECT id, transaction_date, description, amount, category_id
FROM transactions 
WHERE category_id = '735e00b2-f789-4a31-b600-271732688213'
ORDER BY transaction_date DESC
LIMIT 10;

-- 4. Find what category_id membership dues transactions actually have
SELECT DISTINCT t.category_id, c.name as category_name, COUNT(*) as tx_count, SUM(t.amount) as total
FROM transactions t
LEFT JOIN categories c ON t.category_id = c.id
WHERE t.description ILIKE '%member%'
AND t.transaction_date >= '2025-01-01'
AND t.transaction_date < '2026-01-01'
GROUP BY t.category_id, c.name
ORDER BY total DESC;
