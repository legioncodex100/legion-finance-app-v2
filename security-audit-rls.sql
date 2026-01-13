-- ================================================
-- LEGION FINANCE - SECURITY AUDIT & RLS HARDENING
-- Run EACH SECTION separately if you get errors
-- ================================================

-- SECTION 1: Check current RLS status
SELECT 
    tablename,
    CASE WHEN rowsecurity THEN '✅ RLS ON' ELSE '❌ RLS OFF' END as status
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- ================================================
-- SECTION 2: Fix Categories policy (IMPORTANT - currently open!)
-- ================================================
DROP POLICY IF EXISTS "Categories Access" ON categories;
CREATE POLICY "Categories Access" ON categories 
    FOR ALL 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

-- ================================================
-- SECTION 3: Core tables (these have user_id)
-- ================================================
-- Vendors
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Vendors Access" ON vendors;
CREATE POLICY "Vendors Access" ON vendors FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Transactions Access" ON transactions;
CREATE POLICY "Transactions Access" ON transactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Recurring Bills
ALTER TABLE recurring_bills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Bills Access" ON recurring_bills;
CREATE POLICY "Bills Access" ON recurring_bills FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Debts
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Debts Access" ON debts;
CREATE POLICY "Debts Access" ON debts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- User Settings
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Settings Access" ON user_settings;
CREATE POLICY "Settings Access" ON user_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ================================================
-- SECTION 4: Budget tables (if they exist)
-- Run this separately
-- ================================================
ALTER TABLE budget_scenarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "budget_scenarios_access" ON budget_scenarios;
CREATE POLICY "budget_scenarios_access" ON budget_scenarios FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ================================================
-- SECTION 5: Staff table (if it exists)
-- Run this separately
-- ================================================
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_access" ON staff;
CREATE POLICY "staff_access" ON staff FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ================================================
-- SECTION 6: Creditors table (if it exists)
-- Run this separately
-- ================================================
ALTER TABLE creditors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "creditors_access" ON creditors;
CREATE POLICY "creditors_access" ON creditors FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ================================================
-- SECTION 7: Payables table (if it exists)
-- Run this separately  
-- ================================================
ALTER TABLE payables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payables_access" ON payables;
CREATE POLICY "payables_access" ON payables FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ================================================
-- SECTION 8: Verify all RLS is enabled
-- ================================================
SELECT 
    tablename,
    CASE WHEN rowsecurity THEN '✅ RLS ON' ELSE '❌ RLS OFF' END as status
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY status DESC, tablename;
