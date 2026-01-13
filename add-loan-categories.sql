-- Create "Financing Inflows" parent category for Income
INSERT INTO categories (name, type, is_system)
VALUES ('Financing Inflows', 'income', true)
ON CONFLICT (name, type) DO NOTHING;

-- Create "Loan Proceeds" subcategory
WITH parent AS (SELECT id FROM categories WHERE name = 'Financing Inflows' AND type = 'income' LIMIT 1)
INSERT INTO categories (name, type, parent_id, is_system)
SELECT 'Loan Proceeds', 'income', id, true FROM parent
ON CONFLICT (name, type) DO NOTHING;

-- Create "Capital Injection" subcategory
WITH parent AS (SELECT id FROM categories WHERE name = 'Financing Inflows' AND type = 'income' LIMIT 1)
INSERT INTO categories (name, type, parent_id, is_system)
SELECT 'Capital Injection', 'income', id, true FROM parent
ON CONFLICT (name, type) DO NOTHING;


-- Create "Debt Service" parent category for Expenses
INSERT INTO categories (name, type, is_system)
VALUES ('Debt Service', 'expense', true)
ON CONFLICT (name, type) DO NOTHING;

-- Create "Loan Principal Repayment" subcategory
WITH parent AS (SELECT id FROM categories WHERE name = 'Debt Service' AND type = 'expense' LIMIT 1)
INSERT INTO categories (name, type, parent_id, is_system)
SELECT 'Loan Principal Repayment', 'expense', id, true FROM parent
ON CONFLICT (name, type) DO NOTHING;

-- Create "Interest Expense" subcategory
WITH parent AS (SELECT id FROM categories WHERE name = 'Debt Service' AND type = 'expense' LIMIT 1)
INSERT INTO categories (name, type, parent_id, is_system)
SELECT 'Interest Expense', 'expense', id, true FROM parent
ON CONFLICT (name, type) DO NOTHING;
