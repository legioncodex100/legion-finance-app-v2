-- Financial Classes Migration
-- Run this in your Supabase SQL Editor

-- 1. Create financial_classes table (if not exists)
CREATE TABLE IF NOT EXISTS financial_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    affects_profit BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(code, user_id)
);

-- 2. Enable RLS
ALTER TABLE financial_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Financial Classes Access" ON financial_classes FOR ALL 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

-- 3. Add class_id to categories table
ALTER TABLE categories ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES financial_classes(id);

-- 4. Index for performance
CREATE INDEX idx_financial_classes_user ON financial_classes(user_id);
CREATE INDEX idx_categories_class ON categories(class_id);

-- 5. Seed default financial classes
DO $$
DECLARE
    uid UUID;
BEGIN
    SELECT id INTO uid FROM auth.users LIMIT 1;
    
    INSERT INTO financial_classes (code, name, description, affects_profit, sort_order, user_id)
    VALUES 
        ('REVENUE', 'Revenue', 'Income from operations', TRUE, 1, uid),
        ('COGS', 'Cost of Goods Sold', 'Direct costs of providing services', TRUE, 2, uid),
        ('EXPENSE', 'Operating Expense', 'Overhead and administrative costs', TRUE, 3, uid),
        ('EQUITY', 'Owner Equity/Drawings', 'Non-operating owner transactions', FALSE, 4, uid)
    ON CONFLICT (code, user_id) DO NOTHING;
    
    RAISE NOTICE 'Financial classes seeded for user: %', uid;
END $$;

-- 6. Link existing categories to classes (based on your chart of accounts)
DO $$
DECLARE
    uid UUID;
    rev_id UUID;
    cogs_id UUID;
    exp_id UUID;
    eq_id UUID;
BEGIN
    SELECT id INTO uid FROM auth.users LIMIT 1;
    
    SELECT id INTO rev_id FROM financial_classes WHERE code = 'REVENUE' AND user_id = uid;
    SELECT id INTO cogs_id FROM financial_classes WHERE code = 'COGS' AND user_id = uid;
    SELECT id INTO exp_id FROM financial_classes WHERE code = 'EXPENSE' AND user_id = uid;
    SELECT id INTO eq_id FROM financial_classes WHERE code = 'EQUITY' AND user_id = uid;
    
    -- Revenue: 1000 series
    UPDATE categories SET class_id = rev_id 
    WHERE name LIKE '1%' AND user_id = uid;
    
    -- COGS: 2000 series (Mat Operations)
    UPDATE categories SET class_id = cogs_id 
    WHERE name LIKE '2%' AND user_id = uid;
    
    -- Expense: 3000-5000 series
    UPDATE categories SET class_id = exp_id 
    WHERE (name LIKE '3%' OR name LIKE '4%' OR name LIKE '5%') AND user_id = uid;
    
    -- Equity: 6000 series
    UPDATE categories SET class_id = eq_id 
    WHERE name LIKE '6%' AND user_id = uid;
    
    RAISE NOTICE 'Categories linked to financial classes';
END $$;

-- Verify
SELECT fc.name as class, COUNT(c.id) as categories
FROM financial_classes fc
LEFT JOIN categories c ON c.class_id = fc.id
GROUP BY fc.name
ORDER BY fc.sort_order;
