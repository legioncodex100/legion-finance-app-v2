-- Create Finance Tables for Legion Finance App
-- Run this in your Supabase SQL Editor

-- Reset schema for a clean, secure start
DROP TABLE IF EXISTS coach_invoices CASCADE;
DROP TABLE IF EXISTS client_invoices CASCADE;
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS recurring_bills CASCADE;
DROP TABLE IF EXISTS debts CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS vendors CASCADE;

-- 1. Vendors (Payee Registry)
CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    name TEXT NOT NULL,
    default_category_id UUID,
    is_recurring BOOLEAN DEFAULT FALSE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    UNIQUE(name, user_id)
);

-- 2. Coach Invoices (Accounts Payable)
CREATE TABLE coach_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    vendor_id UUID REFERENCES vendors(id),
    invoice_number TEXT,
    amount DECIMAL(12, 2) NOT NULL,
    due_date DATE NOT NULL,
    status TEXT CHECK (status IN ('pending', 'paid', 'overdue')) DEFAULT 'pending',
    notes TEXT,
    user_id UUID NOT NULL REFERENCES auth.users(id)
);

-- 3. Client Invoices (Accounts Receivable)
CREATE TABLE client_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    client_name TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    due_date DATE NOT NULL,
    status TEXT CHECK (status IN ('draft', 'sent', 'paid', 'overdue')) DEFAULT 'draft',
    description TEXT,
    user_id UUID NOT NULL REFERENCES auth.users(id)
);

-- 4. Categories Table (Hierarchical)
-- 6. Financial Classes Table (for chart of accounts classifications)
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

-- Enable RLS for financial_classes
DROP POLICY IF EXISTS "Financial Classes Access" ON financial_classes;
ALTER TABLE financial_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Financial Classes Access" ON financial_classes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_financial_classes_user ON financial_classes(user_id);

-- 4. Categories Table (Hierarchical)
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    group_name TEXT CHECK (group_name IN ('operating', 'financing', 'investing')),
    type TEXT CHECK (type IN ('income', 'expense')),
    sort_order INTEGER DEFAULT 0,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    class_id UUID REFERENCES financial_classes(id),
    UNIQUE(name, parent_id, user_id)
);

-- Rename column if needed (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='financial_class_id') THEN
    ALTER TABLE categories RENAME COLUMN financial_class_id TO class_id;
  END IF;
END $$;

-- Drop old index if exists and create new one on class_id
DROP INDEX IF EXISTS idx_categories_financial_class;
CREATE INDEX IF NOT EXISTS idx_categories_class ON categories(class_id);


-- 5. Transactions Table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    amount DECIMAL(12, 2) NOT NULL,
    description TEXT NOT NULL,
    raw_party TEXT,
    vendor_id UUID REFERENCES vendors(id),
    transaction_date DATE NOT NULL,
    category_id UUID REFERENCES categories(id),
    linked_invoice_id UUID REFERENCES coach_invoices(id),
    ai_suggested TEXT,
    bank_category TEXT,
    confirmed BOOLEAN DEFAULT FALSE,
    type TEXT CHECK (type IN ('income', 'expense')),
    notes TEXT,
    reconciliation_status TEXT DEFAULT 'unreconciled',
    import_hash TEXT NOT NULL,
    UNIQUE(import_hash, user_id)
);

-- 6. Recurring Bills
CREATE TABLE recurring_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    vendor_id UUID REFERENCES vendors(id),
    amount DECIMAL(12, 2) NOT NULL,
    frequency TEXT NOT NULL,
    next_due DATE NOT NULL,
    is_paid BOOLEAN DEFAULT FALSE,
    user_id UUID NOT NULL REFERENCES auth.users(id)
);

-- 7. Debts
CREATE TABLE debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creditor_name TEXT NOT NULL,
    original_balance DECIMAL(12, 2) NOT NULL,
    remaining_balance DECIMAL(12, 2) NOT NULL,
    monthly_payment DECIMAL(12, 2),
    user_id UUID NOT NULL REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies (Explicit INSERT/SELECT/UPDATE/DELETE)
-- Vendors
CREATE POLICY "Vendors Access" ON vendors FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Coach Invoices
CREATE POLICY "Coach Invoices Access" ON coach_invoices FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Client Invoices
CREATE POLICY "Client Invoices Access" ON client_invoices FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Categories
CREATE POLICY "Categories Access" ON categories FOR ALL USING (true) WITH CHECK (true);
-- Transactions
CREATE POLICY "Transactions Access" ON transactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Recurring Bills
CREATE POLICY "Bills Access" ON recurring_bills FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Debts
CREATE POLICY "Debts Access" ON debts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 9. User Settings (for Opening Balance, etc.)
DROP TABLE IF EXISTS user_settings CASCADE;

CREATE TABLE user_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    setting_key TEXT NOT NULL,
    setting_value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, setting_key)
);
ALTER TABLE IF EXISTS user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settings Access" ON user_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 10. Performance Indexes
CREATE INDEX idx_transactions_user_date ON transactions(user_id, transaction_date DESC);
CREATE INDEX idx_transactions_user_confirmed ON transactions(user_id, confirmed);
CREATE INDEX idx_transactions_user_ai ON transactions(user_id, ai_suggested);
CREATE INDEX idx_categories_user_parent ON categories(user_id, parent_id);
