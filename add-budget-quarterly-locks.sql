-- Add quarterly lock columns to budget_scenarios table

-- Add quarterly lock flags
ALTER TABLE budget_scenarios
ADD COLUMN IF NOT EXISTS q1_locked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS q2_locked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS q3_locked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS q4_locked BOOLEAN DEFAULT false;

-- Add status column (draft = planning mode, active = committed, archived = historical)
ALTER TABLE budget_scenarios
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'archived'));

-- Migrate existing scenarios: if is_active = true, set status to 'active'
UPDATE budget_scenarios
SET status = 'active'
WHERE is_active = true AND status IS NULL;

-- Set all others to 'draft'
UPDATE budget_scenarios  
SET status = 'draft'
WHERE status IS NULL;
