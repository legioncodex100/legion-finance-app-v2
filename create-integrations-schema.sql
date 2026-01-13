-- Integrations Hub Schema
-- Run this in your Supabase SQL Editor

-- 1. Integrations Table (stores provider configurations)
CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    provider TEXT NOT NULL, -- 'gemini', 'mindbody', 'stripe', etc.
    display_name TEXT, -- User-friendly name override
    is_enabled BOOLEAN DEFAULT false,
    credentials JSONB DEFAULT '{}', -- Encrypted API keys (for user-provided keys)
    settings JSONB DEFAULT '{}', -- Provider-specific settings
    status TEXT DEFAULT 'disconnected' CHECK (status IN ('connected', 'error', 'disconnected')),
    last_sync_at TIMESTAMPTZ,
    last_test_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

-- 2. Integration Tokens (for OAuth-based integrations like Mindbody)
CREATE TABLE IF NOT EXISTS integration_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_type TEXT DEFAULT 'Bearer',
    expires_at TIMESTAMPTZ,
    scope TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Integration Sync Logs (for debugging and audit)
CREATE TABLE IF NOT EXISTS integration_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE NOT NULL,
    sync_type TEXT NOT NULL, -- 'test', 'categorize', 'chat', 'sales_import', etc.
    status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
    records_processed INTEGER DEFAULT 0,
    duration_ms INTEGER,
    error_details TEXT,
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Integrations Access" ON integrations;
CREATE POLICY "Integrations Access" ON integrations 
    FOR ALL USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Integration Tokens Access" ON integration_tokens;
CREATE POLICY "Integration Tokens Access" ON integration_tokens
    FOR ALL USING (
        EXISTS (SELECT 1 FROM integrations WHERE integrations.id = integration_tokens.integration_id AND integrations.user_id = auth.uid())
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM integrations WHERE integrations.id = integration_tokens.integration_id AND integrations.user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Integration Sync Logs Access" ON integration_sync_logs;
CREATE POLICY "Integration Sync Logs Access" ON integration_sync_logs
    FOR ALL USING (
        EXISTS (SELECT 1 FROM integrations WHERE integrations.id = integration_sync_logs.integration_id AND integrations.user_id = auth.uid())
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM integrations WHERE integrations.id = integration_sync_logs.integration_id AND integrations.user_id = auth.uid())
    );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_integrations_user_provider ON integrations(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_integration_tokens_integration ON integration_tokens(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_integration ON integration_sync_logs(integration_id, started_at DESC);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_integration_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS integrations_updated_at ON integrations;
CREATE TRIGGER integrations_updated_at
    BEFORE UPDATE ON integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_integration_updated_at();

DROP TRIGGER IF EXISTS integration_tokens_updated_at ON integration_tokens;
CREATE TRIGGER integration_tokens_updated_at
    BEFORE UPDATE ON integration_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_integration_updated_at();
