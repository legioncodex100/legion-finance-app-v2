-- Add template support columns to payables
-- Run this in Supabase SQL Editor

-- is_template: true = this is a template, not a real bill
-- template_id: links generated bill back to its template
-- is_active: for pausing/stopping templates (inactive templates don't generate bills)

ALTER TABLE payables
ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES payables(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Index for fast template lookups
CREATE INDEX IF NOT EXISTS idx_payables_is_template ON payables(user_id, is_template) WHERE is_template = true;
CREATE INDEX IF NOT EXISTS idx_payables_template_id ON payables(template_id) WHERE template_id IS NOT NULL;

-- Comments
COMMENT ON COLUMN payables.is_template IS 'True for bill templates, false for actual payable bills';
COMMENT ON COLUMN payables.template_id IS 'Links generated bill to its source template';
COMMENT ON COLUMN payables.is_active IS 'For templates: inactive templates do not generate new bills';

-- Verify
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'payables' AND column_name IN ('is_template', 'template_id', 'is_active');
