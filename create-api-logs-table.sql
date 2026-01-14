-- Create api_logs table for webhook and API call logging
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS api_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    log_type TEXT NOT NULL, -- 'webhook', 'api_call', 'sync'
    source TEXT NOT NULL,   -- 'mindbody', 'starling', 'supabase'
    event_type TEXT,        -- e.g., 'client.created', 'sale.created'
    status TEXT NOT NULL,   -- 'success', 'error', 'pending'
    request_data JSONB,     -- incoming payload or request params
    response_data JSONB,    -- response or result
    error_message TEXT,     -- error details if failed
    duration_ms INTEGER,    -- how long the operation took
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_api_logs_created_at ON api_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_log_type ON api_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_api_logs_source ON api_logs(source);
CREATE INDEX IF NOT EXISTS idx_api_logs_status ON api_logs(status);

-- RLS policy (optional - if you want user-specific logs)
-- ALTER TABLE api_logs ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can view their own logs" ON api_logs 
--   FOR SELECT USING (auth.uid() = user_id);

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'api_logs';
