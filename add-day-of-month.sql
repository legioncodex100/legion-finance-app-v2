-- Add day_of_month column to payables table for bill templates
-- This allows templates to specify which day of the month bills are due

ALTER TABLE payables ADD COLUMN IF NOT EXISTS day_of_month INTEGER;

-- Add comment explaining the column
COMMENT ON COLUMN payables.day_of_month IS 'Day of month (1-28) when recurring bills are due. Used by templates during bill generation.';
