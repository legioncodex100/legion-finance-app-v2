-- Add discipline field to invoices for coaches
-- Run this in Supabase SQL Editor

-- Add discipline column for coach invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discipline TEXT;

-- Optional: create a disciplines reference table for future use
-- CREATE TABLE IF NOT EXISTS disciplines (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     name TEXT NOT NULL UNIQUE,
--     created_at TIMESTAMPTZ DEFAULT NOW()
-- );
-- INSERT INTO disciplines (name) VALUES ('BJJ'), ('MMA'), ('Kickboxing'), ('Wrestling'), ('Judo'), ('No-Gi') ON CONFLICT DO NOTHING;
