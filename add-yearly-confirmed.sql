-- Add yearly_confirmed column to budget_scenarios
ALTER TABLE budget_scenarios 
ADD COLUMN IF NOT EXISTS yearly_confirmed BOOLEAN NOT NULL DEFAULT false;

-- Comment
COMMENT ON COLUMN budget_scenarios.yearly_confirmed IS 'True when yearly budget totals are confirmed and monthly view is enabled';
