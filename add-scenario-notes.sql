-- Add notes column to budget_scenarios table
ALTER TABLE budget_scenarios 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Optional: Add a comment for documentation
COMMENT ON COLUMN budget_scenarios.notes IS 'User notes to provide context about this budget scenario';
