-- Check actual weekly totals from 2025
SELECT 
    EXTRACT(WEEK FROM transaction_date) as week_num,
    SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as weekly_income,
    SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as weekly_expenses,
    COUNT(*) as tx_count
FROM transactions
WHERE EXTRACT(YEAR FROM transaction_date) = 2025
GROUP BY EXTRACT(WEEK FROM transaction_date)
ORDER BY week_num
LIMIT 10;
