-- Quick auto-match script for January 2026
-- This finds and applies matches automatically for high-confidence matches

-- Step 1: See what would be matched (DRY RUN)
WITH mb_daily AS (
  SELECT 
    transaction_date::date as mb_date,
    ARRAY_AGG(id) as mb_transaction_ids,
    COUNT(*) as tx_count,
    SUM(gross_amount) as gross,
    SUM(calculated_fee) as fees,
    SUM(gross_amount) - SUM(calculated_fee) as net
  FROM mb_transactions
  WHERE status = 'Approved'
    AND transaction_date >= '2026-01-01'
    AND (is_matched = false OR is_matched IS NULL)
  GROUP BY transaction_date::date
),
bank_deposits AS (
  SELECT 
    id as bank_id,
    transaction_date::date as bank_date,
    amount,
    description
  FROM transactions
  WHERE transaction_date >= '2026-01-01'
    AND amount > 0
    AND (raw_party ILIKE '%MINDBODY%' OR description ILIKE '%MINDBODY%')
)
SELECT 
  mb.mb_date,
  mb.tx_count,
  mb.net as mb_net,
  bd.bank_date,
  bd.amount as bank_amount,
  ABS(mb.net - bd.amount) as difference,
  bd.description,
  mb.mb_transaction_ids,
  bd.bank_id,
  CASE 
    WHEN ABS(mb.net - bd.amount) < 0.50 
      AND (bd.bank_date::date - mb.mb_date::date) BETWEEN 0 AND 3
    THEN 'HIGH'
    WHEN ABS(mb.net - bd.amount) < 2 
      AND (bd.bank_date::date - mb.mb_date::date) BETWEEN 0 AND 5
    THEN 'MEDIUM'
    ELSE 'LOW'
  END as confidence
FROM mb_daily mb
CROSS JOIN bank_deposits bd
WHERE ABS(mb.net - bd.amount) < 5
  AND (bd.bank_date::date - mb.mb_date::date) BETWEEN 0 AND 7
ORDER BY 
  CASE 
    WHEN ABS(mb.net - bd.amount) < 0.50 THEN 0
    WHEN ABS(mb.net - bd.amount) < 2 THEN 1
    ELSE 2
  END,
  ABS(mb.net - bd.amount);

-- Step 2: Apply high-confidence matches (RUN THIS AFTER REVIEWING STEP 1)
-- UNCOMMENT THE LINES BELOW TO ACTUALLY APPLY MATCHES

/*
WITH matches AS (
  -- Same query as above, filtered to HIGH confidence only
  SELECT 
    mb.mb_transaction_ids,
    bd.bank_id
  FROM (
    SELECT 
      transaction_date::date as mb_date,
      ARRAY_AGG(id) as mb_transaction_ids,
      SUM(gross_amount) - SUM(calculated_fee) as net
    FROM mb_transactions
    WHERE status = 'Approved'
      AND transaction_date >= '2026-01-01'
      AND (is_matched = false OR is_matched IS NULL)
    GROUP BY transaction_date::date
  ) mb
  CROSS JOIN (
    SELECT 
      id as bank_id,
      transaction_date::date as bank_date,
      amount
    FROM transactions
    WHERE transaction_date >= '2026-01-01'
      AND amount > 0
      AND (raw_party ILIKE '%MINDBODY%' OR description ILIKE '%MINDBODY%')
  ) bd
  WHERE ABS(mb.net - bd.amount) < 0.50
    AND (bd.bank_date - mb.mb_date) BETWEEN 0 AND 3
)
UPDATE mb_transactions
SET 
  is_matched = true,
  matched_transaction_id = matches.bank_id
FROM matches
WHERE mb_transactions.id = ANY(matches.mb_transaction_ids);
*/

-- Step 3: Verify results
SELECT 
  COUNT(*) FILTER (WHERE is_matched = true) as matched_count,
  COUNT(*) FILTER (WHERE is_matched = false OR is_matched IS NULL) as unmatched_count,
  SUM(gross_amount) FILTER (WHERE is_matched = false OR is_matched IS NULL) as unmatched_gross,
  SUM(calculated_fee) FILTER (WHERE is_matched = false OR is_matched IS NULL) as unmatched_fees,
  SUM(gross_amount) FILTER (WHERE is_matched = false OR is_matched IS NULL) - 
    SUM(calculated_fee) FILTER (WHERE is_matched = false OR is_matched IS NULL) as unmatched_net
FROM mb_transactions
WHERE status = 'Approved'
  AND transaction_date >= '2026-01-01';
