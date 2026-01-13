"use server"

import { createClient } from "@/lib/supabase/server"
import { testGeminiConnection, isGeminiConfigured } from "@/lib/integrations"
import type { Integration, IntegrationProvider, IntegrationStatus } from "@/lib/integrations"

/**
 * Get all integrations for the current user
 */
export async function getIntegrations(): Promise<Integration[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return []

    const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('user_id', user.id)
        .order('provider')

    if (error) {
        console.error('Error fetching integrations:', error)
        return []
    }

    return data || []
}

/**
 * Get a specific integration by provider
 */
export async function getIntegration(provider: IntegrationProvider): Promise<Integration | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('user_id', user.id)
        .eq('provider', provider)
        .single()

    if (error && error.code !== 'PGRST116') { // Ignore "no rows returned"
        console.error('Error fetching integration:', error)
    }

    return data || null
}

/**
 * Create or update an integration
 */
export async function upsertIntegration(
    provider: IntegrationProvider,
    updates: Partial<Pick<Integration, 'is_enabled' | 'settings' | 'status' | 'error_message'>>
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { success: false, error: 'Not authenticated' }

    const { error } = await supabase
        .from('integrations')
        .upsert({
            user_id: user.id,
            provider,
            ...updates,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'user_id,provider'
        })

    if (error) {
        console.error('Error upserting integration:', error)
        return { success: false, error: error.message }
    }

    return { success: true }
}

/**
 * Test Gemini connection and update status
 */
export async function testGeminiIntegration(): Promise<{
    success: boolean
    latencyMs: number
    model: string
    error?: string
}> {
    // Check if configured
    if (!isGeminiConfigured()) {
        return {
            success: false,
            latencyMs: 0,
            model: '',
            error: 'GEMINI_API_KEY environment variable not set'
        }
    }

    // Run the test
    const result = await testGeminiConnection()

    // Update integration status in database
    const status: IntegrationStatus = result.success ? 'connected' : 'error'
    await upsertIntegration('gemini', {
        is_enabled: result.success,
        status,
        error_message: result.error || null
    })

    // Log the test
    await logIntegrationSync('gemini', 'test', result.success ? 'completed' : 'failed', {
        latencyMs: result.latencyMs,
        model: result.model,
        error: result.error
    })

    return result
}

/**
 * Enable or disable an integration
 */
export async function toggleIntegration(
    provider: IntegrationProvider,
    enabled: boolean
): Promise<{ success: boolean }> {
    return upsertIntegration(provider, { is_enabled: enabled })
}

/**
 * Log an integration sync event
 */
async function logIntegrationSync(
    provider: IntegrationProvider,
    syncType: string,
    status: 'started' | 'completed' | 'failed',
    metadata?: Record<string, any>
): Promise<void> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    // Get integration ID
    const integration = await getIntegration(provider)
    if (!integration) return

    await supabase.from('integration_sync_logs').insert({
        integration_id: integration.id,
        sync_type: syncType,
        status,
        records_processed: 0,
        duration_ms: metadata?.latencyMs,
        error_details: metadata?.error,
        metadata: metadata || {},
        completed_at: status !== 'started' ? new Date().toISOString() : null
    })
}

/**
 * Get integration status summary for dashboard
 */
export async function getIntegrationStatuses(): Promise<{
    gemini: { configured: boolean; enabled: boolean; status: IntegrationStatus }
    mindbody: { configured: boolean; enabled: boolean; status: IntegrationStatus }
}> {
    const integrations = await getIntegrations()

    const findStatus = (provider: IntegrationProvider) => {
        const int = integrations.find(i => i.provider === provider)
        return {
            configured: provider === 'gemini' ? isGeminiConfigured() : !!int,
            enabled: int?.is_enabled || false,
            status: (int?.status as IntegrationStatus) || 'disconnected'
        }
    }

    return {
        gemini: findStatus('gemini'),
        mindbody: findStatus('mindbody')
    }
}
