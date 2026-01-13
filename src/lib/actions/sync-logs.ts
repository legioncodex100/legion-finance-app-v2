"use server"

import { createClient } from "@/lib/supabase/server"

export type SyncLog = {
    id: string
    integration_id: string
    sync_type: string
    status: 'started' | 'completed' | 'failed'
    records_processed: number
    duration_ms: number | null
    error_details: string | null
    metadata: any
    started_at: string
    completed_at: string | null
}

/**
 * Get recent sync logs for all integrations
 */
export async function getSyncLogs(limit: number = 50): Promise<SyncLog[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
        .from('integration_sync_logs')
        .select(`
            *,
            integrations!inner(user_id, provider)
        `)
        .eq('integrations.user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(limit)

    if (error) {
        console.error('Error fetching sync logs:', error)
        return []
    }

    return data || []
}

/**
 * Get sync stats summary
 */
export async function getSyncStats(): Promise<{
    lastMindbodySync: string | null
    lastStarlingSync: string | null
    totalSyncsToday: number
    failedSyncsToday: number
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { lastMindbodySync: null, lastStarlingSync: null, totalSyncsToday: 0, failedSyncsToday: 0 }

    const today = new Date().toISOString().split('T')[0]

    // Get last Mindbody sync
    const { data: mbSync } = await supabase
        .from('integration_sync_logs')
        .select('completed_at, integrations!inner(provider)')
        .eq('integrations.user_id', user.id)
        .eq('integrations.provider', 'mindbody')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .single()

    // Get today's sync count
    const { count: totalToday } = await supabase
        .from('integration_sync_logs')
        .select('*', { count: 'exact', head: true })
        .gte('started_at', today)

    const { count: failedToday } = await supabase
        .from('integration_sync_logs')
        .select('*', { count: 'exact', head: true })
        .gte('started_at', today)
        .eq('status', 'failed')

    return {
        lastMindbodySync: mbSync?.completed_at || null,
        lastStarlingSync: null, // Add when Starling integration is tracked
        totalSyncsToday: totalToday || 0,
        failedSyncsToday: failedToday || 0,
    }
}

/**
 * Clear old sync logs (older than 30 days)
 */
export async function clearOldSyncLogs(): Promise<{ deleted: number }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { deleted: 0 }

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Count first, then delete
    const { count } = await supabase
        .from('integration_sync_logs')
        .select('*', { count: 'exact', head: true })
        .lt('started_at', thirtyDaysAgo.toISOString())

    await supabase
        .from('integration_sync_logs')
        .delete()
        .lt('started_at', thirtyDaysAgo.toISOString())

    return { deleted: count || 0 }
}
