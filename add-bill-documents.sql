-- Add document storage support for bills
-- Run this in Supabase SQL Editor

-- Add document_url column to store uploaded bill files
ALTER TABLE recurring_bills ADD COLUMN IF NOT EXISTS document_url TEXT;

-- Create storage bucket for bill documents (run this via Supabase Dashboard Storage)
-- Bucket name: bill-documents
-- Public: No (private)
-- File size limit: 10MB
-- Allowed MIME types: application/pdf, image/png, image/jpeg, image/jpg, image/webp

-- Note: You must also create the bucket in Supabase Dashboard:
-- 1. Go to Storage in Supabase Dashboard
-- 2. Click "New bucket"
-- 3. Name: "bill-documents"
-- 4. Keep as private (not public)
-- 5. Click Create

-- RLS Policy for bill documents bucket (run after creating bucket)
-- This allows users to upload/view their own bill documents
