-- Check recurring salary templates for Mohammed Yahiaoui
SELECT id, name, amount, next_due, frequency, is_template, is_recurring, is_active
FROM payables 
WHERE (is_template = true OR is_recurring = true)
  AND staff_id = (SELECT id FROM staff WHERE name ILIKE '%Mohammed Yahiaoui%' LIMIT 1);

-- Check ALL Mohammed Yahiaoui payables ever created (including historical)
SELECT id, name, amount, next_due, bill_status, is_paid, created_at
FROM payables 
WHERE staff_id = (SELECT id FROM staff WHERE name ILIKE '%Mohammed Yahiaoui%' LIMIT 1)
ORDER BY next_due DESC;

-- Check the staff record
SELECT * FROM staff WHERE name ILIKE '%Mohammed Yahiaoui%';
