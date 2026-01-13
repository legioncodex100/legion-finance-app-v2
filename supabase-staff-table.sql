-- Staff Table Normalization Migration
-- Run this in your Supabase SQL Editor

-- 1. Create dedicated staff table
CREATE TABLE staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    role TEXT CHECK (role IN ('coach', 'staff')) NOT NULL,
    email TEXT,
    phone TEXT,
    pay_rate DECIMAL(10, 2),
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    UNIQUE(name, user_id)
);

-- 2. Enable RLS
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff Access" ON staff FOR ALL 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

-- 3. Link transactions to staff (optional payee)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES staff(id);

-- 4. Update coach_invoices to reference staff instead of vendors
ALTER TABLE coach_invoices ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES staff(id);

-- 5. Clean vendors table (remove type column if exists)
ALTER TABLE vendors DROP COLUMN IF EXISTS type;

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_user_role ON staff(user_id, role);
CREATE INDEX IF NOT EXISTS idx_transactions_staff ON transactions(staff_id);
