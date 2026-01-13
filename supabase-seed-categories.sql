-- Chart of Accounts Seed for Legion Grappling Gym
-- Run this in your Supabase SQL Editor
-- NOTE: This script includes the code column for proper sorting

DO $$
DECLARE
    uid UUID;
BEGIN
    -- Get the first user's ID (adjust if you have multiple users)
    uid := 'e29589a7-3d44-4678-b06c-5829ef68cebc'::uuid;
    
    -- ============================================
    -- 1000 - INCOME (Revenue)
    -- ============================================
    INSERT INTO categories (code, name, parent_id, group_name, type, sort_order, user_id)
    VALUES ('1000', 'Income', NULL, 'operating', 'income', 1000, uid)
    ON CONFLICT (code) DO NOTHING;
    
    INSERT INTO categories (code, name, parent_id, group_name, type, sort_order, user_id)
    SELECT '1100', 'Membership Dues', id, 'operating', 'income', 1100, uid
    FROM categories WHERE code = '1000'
    ON CONFLICT (code) DO NOTHING;
    
    INSERT INTO categories (code, name, parent_id, group_name, type, sort_order, user_id)
    SELECT '1200', 'Merchandise & Retail', id, 'operating', 'income', 1200, uid
    FROM categories WHERE code = '1000'
    ON CONFLICT (code) DO NOTHING;
    
    INSERT INTO categories (code, name, parent_id, group_name, type, sort_order, user_id)
    SELECT '1300', 'Seminars & Gradings', id, 'operating', 'income', 1300, uid
    FROM categories WHERE code = '1000'
    ON CONFLICT (code) DO NOTHING;
    
    INSERT INTO categories (code, name, parent_id, group_name, type, sort_order, user_id)
    SELECT '1400', 'Private Lessons', id, 'operating', 'income', 1400, uid
    FROM categories WHERE code = '1000'
    ON CONFLICT (code) DO NOTHING;
    
    -- ============================================
    -- 2000 - MAT OPERATIONS (COGS)
    -- ============================================
    INSERT INTO categories (code, name, parent_id, group_name, type, sort_order, user_id)
    VALUES ('2000', 'Mat Operations', NULL, 'operating', 'expense', 2000, uid)
    ON CONFLICT (code) DO NOTHING;
    
    INSERT INTO categories (code, name, parent_id, group_name, type, sort_order, user_id)
    SELECT '2100', 'Coaching Fees', id, 'operating', 'expense', 2100, uid
    FROM categories WHERE code = '2000'
    ON CONFLICT (code) DO NOTHING;
    
    INSERT INTO categories (code, name, parent_id, group_name, type, sort_order, user_id)
    SELECT '2200', 'Mat Hygiene & Cleaning', id, 'operating', 'expense', 2200, uid
    FROM categories WHERE code = '2000'
    ON CONFLICT (code) DO NOTHING;
    
    INSERT INTO categories (code, name, parent_id, group_name, type, sort_order, user_id)
    SELECT '2300', 'Training Equipment', id, 'operating', 'expense', 2300, uid
    FROM categories WHERE code = '2000'
    ON CONFLICT (code) DO NOTHING;
    
    INSERT INTO categories (code, name, parent_id, group_name, type, sort_order, user_id)
    SELECT '2400', 'Affiliate & Governing Fees', id, 'operating', 'expense', 2400, uid
    FROM categories WHERE code = '2000'
    ON CONFLICT (code) DO NOTHING;
    
    -- ============================================
    -- 3000 - FACILITIES (Overhead)
    -- ============================================
    INSERT INTO categories (code, name, parent_id, group_name, type, sort_order, user_id)
    VALUES ('3000', 'Facilities', NULL, 'operating', 'expense', 3000, uid)
    ON CONFLICT (code) DO NOTHING;
    
    INSERT INTO categories (code, name, parent_id, group_name, type, sort_order, user_id)
    SELECT '3100', 'Rent & Service Charge', id, 'operating', 'expense', 3100, uid
    FROM categories WHERE code = '3000'
    ON CONFLICT (code) DO NOTHING;
    
    INSERT INTO categories (code, name, parent_id, group_name, type, sort_order, user_id)
    SELECT '3200', 'Business Rates', id, 'operating', 'expense', 3200, uid
    FROM categories WHERE code = '3000'
    ON CONFLICT (code) DO NOTHING;
    
    INSERT INTO categories (code, name, parent_id, group_name, type, sort_order, user_id)
    SELECT '3300', 'Utilities - Gas & Electric', id, 'operating', 'expense', 3300, uid
    FROM categories WHERE code = '3000'
    ON CONFLICT (code) DO NOTHING;
    
    INSERT INTO categories (code, name, parent_id, group_name, type, sort_order, user_id)
    SELECT '3400', 'Utilities - Water & Waste', id, 'operating', 'expense', 3400, uid
    FROM categories WHERE code = '3000'
    ON CONFLICT (code) DO NOTHING;
    
    INSERT INTO categories (code, name, parent_id, group_name, type, sort_order, user_id)
    SELECT '3500', 'Repairs & Maintenance', id, 'operating', 'expense', 3500, uid
    FROM categories WHERE code = '3000'
    ON CONFLICT (code) DO NOTHING;
    
    -- ============================================
    -- 4000 - GYM TECH & SaaS
    -- ============================================
    INSERT INTO categories (code, name, parent_id, group_name, type, sort_order, user_id)
    VALUES ('4000', 'Gym Tech & SaaS', NULL, 'operating', 'expense', 4000, uid)
    ON CONFLICT (code) DO NOTHING;
    
    INSERT INTO categories (code, name, parent_id, group_name, type, sort_order, user_id)
    SELECT '4100', 'Booking & CRM', id, 'operating', 'expense', 4100, uid
    FROM categories WHERE code = '4000'
    ON CONFLICT (code) DO NOTHING;
    
    INSERT INTO categories (code, name, parent_id, group_name, type, sort_order, user_id)
    SELECT '4200', 'Marketing & Ads', id, 'operating', 'expense', 4200, uid
    FROM categories WHERE code = '4000'
    ON CONFLICT (code) DO NOTHING;
    
    INSERT INTO categories (code, name, parent_id, group_name, type, sort_order, user_id)
    SELECT '4300', 'AI & Automation', id, 'operating', 'expense', 4300, uid
    FROM categories WHERE code = '4000'
    ON CONFLICT (code) DO NOTHING;
    
    INSERT INTO categories (code, name, parent_id, group_name, type, sort_order, user_id)
    SELECT '4400', 'Connectivity', id, 'operating', 'expense', 4400, uid
    FROM categories WHERE code = '4000'
    ON CONFLICT (code) DO NOTHING;
    
    -- ============================================
    -- 5000 - ADMIN & FINANCIAL
    -- ============================================
    INSERT INTO categories (code, name, parent_id, group_name, type, sort_order, user_id)
    VALUES ('5000', 'Admin & Financial', NULL, 'operating', 'expense', 5000, uid)
    ON CONFLICT (code) DO NOTHING;
    
    INSERT INTO categories (code, name, parent_id, group_name, type, sort_order, user_id)
    SELECT '5100', 'Merchant & Payment Fees', id, 'operating', 'expense', 5100, uid
    FROM categories WHERE code = '5000'
    ON CONFLICT (code) DO NOTHING;
    
    INSERT INTO categories (code, name, parent_id, group_name, type, sort_order, user_id)
    SELECT '5200', 'Professional Fees', id, 'operating', 'expense', 5200, uid
    FROM categories WHERE code = '5000'
    ON CONFLICT (code) DO NOTHING;
    
    INSERT INTO categories (code, name, parent_id, group_name, type, sort_order, user_id)
    SELECT '5400', 'General Office', id, 'operating', 'expense', 5400, uid
    FROM categories WHERE code = '5000'
    ON CONFLICT (code) DO NOTHING;
    
    -- ============================================
    -- 6000 - OWNER & PERSONAL (Equity/Drawings)
    -- ============================================
    INSERT INTO categories (code, name, parent_id, group_name, type, sort_order, user_id)
    VALUES ('6000', 'Owner & Personal', NULL, 'financing', 'expense', 6000, uid)
    ON CONFLICT (code) DO NOTHING;
    
    INSERT INTO categories (code, name, parent_id, group_name, type, sort_order, user_id)
    SELECT '6100', 'Director Salary', id, 'financing', 'expense', 6100, uid
    FROM categories WHERE code = '6000'
    ON CONFLICT (code) DO NOTHING;
    
    INSERT INTO categories (code, name, parent_id, group_name, type, sort_order, user_id)
    SELECT '6200', 'Owner Drawings', id, 'financing', 'expense', 6200, uid
    FROM categories WHERE code = '6000'
    ON CONFLICT (code) DO NOTHING;
    
    INSERT INTO categories (code, name, parent_id, group_name, type, sort_order, user_id)
    SELECT '6300', 'Personal Subsistence', id, 'financing', 'expense', 6300, uid
    FROM categories WHERE code = '6000'
    ON CONFLICT (code) DO NOTHING;
    
    RAISE NOTICE 'Chart of Accounts seeded successfully for user: %', uid;
END $$;

-- Verify the seed
SELECT 
    c1.code as parent_code,
    c1.name as category,
    c2.code as sub_code,
    c2.name as subcategory
FROM categories c1
LEFT JOIN categories c2 ON c2.parent_id = c1.id
WHERE c1.parent_id IS NULL
ORDER BY c1.code, c2.code;
