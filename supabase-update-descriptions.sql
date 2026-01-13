-- Update Category Descriptions
-- Run this in Supabase SQL Editor to add descriptions to all categories

-- 1000 - Income
UPDATE categories SET description = 'All revenue streams from gym operations and services' WHERE code = '1000';
UPDATE categories SET description = 'Monthly/annual membership fees, drop-ins, trial passes, and pay-as-you-go class credits' WHERE code = '1100';
UPDATE categories SET description = 'Gi sales, rashguards, apparel, supplements, and gear sold to members' WHERE code = '1200';
UPDATE categories SET description = 'Belt grading fees, seminar ticket sales, and visiting instructor event revenue' WHERE code = '1300';
UPDATE categories SET description = '1-on-1 or small group private coaching sessions with members' WHERE code = '1400';

-- 2000 - Mat Operations
UPDATE categories SET description = 'Direct costs of running classes and training sessions (COGS equivalent)' WHERE code = '2000';
UPDATE categories SET description = 'First aid kits, ice packs, tape, bandages, and medical consumables' WHERE code = '2100';
UPDATE categories SET description = 'Payments to junior instructors and assistant coaches' WHERE code = '2200';
UPDATE categories SET description = 'Payments to head instructors and senior coaching staff' WHERE code = '2300';
UPDATE categories SET description = 'Mat sanitiser, deep cleaning services, laundry of gym towels and equipment' WHERE code = '2400';
UPDATE categories SET description = 'Pads, dummies, crash mats, kettlebells, bands, and replacement training gear' WHERE code = '2500';
UPDATE categories SET description = 'Annual affiliation fees to BJJ associations (IBJJF, UKBJJA), insurance levies' WHERE code = '2600';

-- 3000 - Facilities
UPDATE categories SET description = 'Overhead costs related to the physical premises' WHERE code = '3000';
UPDATE categories SET description = 'Monthly lease payments, service charge, and any landlord fees' WHERE code = '3100';
UPDATE categories SET description = 'Council business rates and property taxes' WHERE code = '3200';
UPDATE categories SET description = 'Heating, lighting, and electricity bills' WHERE code = '3300';
UPDATE categories SET description = 'Water supply, sewerage, and waste collection fees' WHERE code = '3400';
UPDATE categories SET description = 'Building repairs, HVAC servicing, plumbing, electrical fixes' WHERE code = '3500';

-- 4000 - Gym Tech & SaaS
UPDATE categories SET description = 'Software subscriptions and technology costs' WHERE code = '4000';
UPDATE categories SET description = 'Membership software (TeamUp, Glofox, Wodify) and class scheduling tools' WHERE code = '4100';
UPDATE categories SET description = 'Facebook/Instagram ads, Google Ads, SEO tools, and promotional campaigns' WHERE code = '4200';
UPDATE categories SET description = 'AI-powered tools, chatbots, automation platforms (Zapier, Make)' WHERE code = '4300';
UPDATE categories SET description = 'Internet, phone lines, and communication services' WHERE code = '4400';
UPDATE categories SET description = 'Hosting, domains, AWS/Vercel, and cloud storage services' WHERE code = '4500';
UPDATE categories SET description = 'CRM tools, accounting integrations, and back-office management platforms' WHERE code = '4600';
UPDATE categories SET description = 'Canva, Adobe Creative Cloud, video editing, and design subscriptions' WHERE code = '4700';

-- 5000 - Admin & Financial
UPDATE categories SET description = 'Administrative and financial operating costs' WHERE code = '5000';
UPDATE categories SET description = 'Stripe, GoCardless, PayPal fees, and card processing charges' WHERE code = '5100';
UPDATE categories SET description = 'Accountant fees, legal fees, and business consultancy' WHERE code = '5200';
UPDATE categories SET description = 'Stationery, postage, printing, and general admin supplies' WHERE code = '5300';

-- 6000 - Owner & Personal
UPDATE categories SET description = 'Owner-related withdrawals and personal expenses (not operating costs)' WHERE code = '6000';
UPDATE categories SET description = 'PAYE salary payments to company directors' WHERE code = '6100';
UPDATE categories SET description = 'Non-salary withdrawals from the business account' WHERE code = '6200';
UPDATE categories SET description = 'Meals, travel, and expenses during business activities' WHERE code = '6300';

-- Verify updates
SELECT code, name, description FROM categories ORDER BY code;
