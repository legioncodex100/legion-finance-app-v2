-- Diagnostic queries for in-flight cash debugging
-- Run these in your Supabase SQL Editor to see what's happening

-- 1. Check all approved transactions from January
SELECT 
  COUNT(*) as total_transactions,
  COUNT(DISTINCT settlement_id) as unique_settlements,
  COUNT(CASE WHEN settlement_id IS NULL THEN 1 END) as missing_settlement_id,
  COUNT(CASE WHEN is_matched = true THEN 1 END) as matched_transactions,
  COUNT(CASE WHEN is_matched = false OR is_matched IS NULL THEN 1 END) as unmatched_transactions,
  SUM(CASE WHEN is_matched = false OR is_matched IS NULL THEN gross_amount ELSE 0 END) as unmatched_gross,
  SUM(CASE WHEN is_matched = false OR is_matched IS NULL THEN calculated_fee ELSE 0 END) as unmatched_fees
FROM mb_transactions
WHERE status = 'Approved'
  AND transaction_date >= '2026-01-01'
  AND transaction_date < '2026-02-01';

-- 2. Show settlements grouped (this is what in-flight cash should see)
SELECT 
  settlement_id,
  settlement_date,
  COUNT(*) as tx_count,
  SUM(gross_amount) as gross_total,
  SUM(calculated_fee) as fee_total,
  SUM(gross_amount) - SUM(calculated_fee) as net_amount,
  BOOL_OR(is_matched) as any_matched,
  MIN(transaction_date) as earliest_tx,
  MAX(transaction_date) as latest_tx
FROM mb_transactions
WHERE status = 'Approved'
  AND transaction_date >= '2026-01-01'
  AND settlement_id IS NOT NULL
GROUP BY settlement_id, settlement_date
ORDER BY settlement_date DESC
LIMIT 20;

-- 3. Show bank deposits from January (to match against)
SELECT 
  transaction_date,
  description,
  amount,
  raw_party,
  confirmed
FROM transactions
WHERE transaction_date >= '2026-01-01'
  AND amount > 0  -- Income only
  AND description ILIKE '%mindbody%' OR raw_party ILIKE '%mindbody%'
ORDER BY transaction_date DESC
LIMIT 20;

-- 4. Find potential matches (settlements close to bank deposits)
WITH settlements AS (
  SELECT 
    settlement_id,
    settlement_date,
    SUM(gross_amount) - SUM(calculated_fee) as net_amount,
    BOOL_OR(is_matched) as is_matched
  FROM mb_transactions
  WHERE status = 'Approved'
    AND transaction_date >= '2026-01-01'
    AND settlement_id IS NOT NULL
  GROUP BY settlement_id, settlement_date
),
deposits AS (
  SELECT 
    id as bank_tx_id,
    transaction_date,
    amount,
    description
  FROM transactions
  WHERE transaction_date >= '2026-01-01'
    AND amount > 0
)
SELECT 
  s.settlement_id,
  s.settlement_date,
  s.net_amount as settlement_net,
  d.transaction_date as deposit_date,
  d.amount as deposit_amount,
  ABS(s.net_amount - d.amount) as difference,
  d.description,
  s.is_matched,
  d.bank_tx_id
FROM settlements s
CROSS JOIN deposits d
WHERE ABS(s.net_amount - d.amount) < 5  -- Within £5
  AND d.transaction_date BETWEEN s.settlement_date AND s.settlement_date + INTERVAL '7 days'
  AND s.is_matched = false
ORDER BY s.settlement_date DESC, difference ASC
LIMIT 30;
