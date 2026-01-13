-- Backfill last_paid_date from linked transactions
-- This updates all payables that have a linked_transaction_id to use the transaction's date as the paid date

UPDATE payables p
SET last_paid_date = t.transaction_date
FROM transactions t
WHERE p.linked_transaction_id = t.id
  AND p.linked_transaction_id IS NOT NULL;

-- Verify the update
SELECT 
    p.name,
    p.last_paid_date as new_paid_date,
    t.transaction_date as transaction_date,
    p.linked_transaction_id
FROM payables p
JOIN transactions t ON p.linked_transaction_id = t.id
WHERE p.linked_transaction_id IS NOT NULL
LIMIT 10;
