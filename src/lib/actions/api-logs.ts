"use server"

import { createServiceClient } from "@/lib/supabase/server"

// ============================================
// TYPES
// ============================================

export type LogType = 'webhook' | 'api_call' | 'sync'
export type LogSource = 'mindbody' | 'starling' | 'supabase' | 'stripe'
export type LogStatus = 'success' | 'error' | 'pending'

export interface ApiLog {
    id: string
    user_id: string | null
    log_type: LogType
    source: LogSource
    event_type: string | null
    status: LogStatus
    request_data: any
    response_data: any
    error_message: string | null
    duration_ms: number | null
    created_at: string
}

// ============================================
// LOG API CALL
// ============================================

export async function logApiCall({
    logType,
    source,
    eventType,
    status,
    requestData,
    responseData,
    errorMessage,
    durationMs,
    userId
}: {
    logType: LogType
    source: LogSource
    eventType?: string
    status: LogStatus
    requestData?: any
    responseData?: any
    errorMessage?: string
    durationMs?: number
    userId?: string
}): Promise<void> {
    try {
        const supabase = createServiceClient()

        await supabase.from('api_logs').insert({
            user_id: userId || null,
            log_type: logType,
            source,
            event_type: eventType,
            status,
            request_data: requestData ? JSON.parse(JSON.stringify(requestData)) : null,
            response_data: responseData ? JSON.parse(JSON.stringify(responseData)) : null,
            error_message: errorMessage,
            duration_ms: durationMs
        })
    } catch (error) {
        // Don't throw - logging should never break the main flow
        console.error('[API_LOG] Failed to write log:', error)
    }
}

// ============================================
// GET LOGS (for UI)
// ============================================

export async function getApiLogs(
    filters: {
        logType?: LogType
        source?: LogSource
        status?: LogStatus
        limit?: number
    } = {}
): Promise<ApiLog[]> {
    const supabase = createServiceClient()

    let query = supabase
        .from('api_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(filters.limit || 100)

    if (filters.logType) {
        query = query.eq('log_type', filters.logType)
    }
    if (filters.source) {
        query = query.eq('source', filters.source)
    }
    if (filters.status) {
        query = query.eq('status', filters.status)
    }

    const { data, error } = await query

    if (error) {
        console.error('[API_LOG] Failed to fetch logs:', error)
        return []
    }

    return data || []
}

// ============================================
// GET LOG STATS
// ============================================

export async function getApiLogStats(): Promise<{
    total: number
    webhooks: number
    apiCalls: number
    syncs: number
    errors: number
    last24h: number
}> {
    const supabase = createServiceClient()

    // Get all logs from last 7 days for stats
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data, error } = await supabase
        .from('api_logs')
        .select('log_type, status, created_at')
        .gte('created_at', sevenDaysAgo.toISOString())

    if (error || !data) {
        return { total: 0, webhooks: 0, apiCalls: 0, syncs: 0, errors: 0, last24h: 0 }
    }

    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)

    return {
        total: data.length,
        webhooks: data.filter(l => l.log_type === 'webhook').length,
        apiCalls: data.filter(l => l.log_type === 'api_call').length,
        syncs: data.filter(l => l.log_type === 'sync').length,
        errors: data.filter(l => l.status === 'error').length,
        last24h: data.filter(l => new Date(l.created_at) > oneDayAgo).length
    }
}

// ============================================
// CLEAR OLD LOGS (maintenance)
// ============================================

export async function clearOldLogs(daysToKeep: number = 30): Promise<number> {
    const supabase = createServiceClient()

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    const { data, error } = await supabase
        .from('api_logs')
        .delete()
        .lt('created_at', cutoffDate.toISOString())
        .select('id')

    if (error) {
        console.error('[API_LOG] Failed to clear old logs:', error)
        return 0
    }

    return data?.length || 0
}
