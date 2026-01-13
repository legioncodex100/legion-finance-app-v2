"use server"

import { createClient } from "@/lib/supabase/server"

export type DateRange = 'week' | 'month' | '30days' | '90days'

export interface TrendMetrics {
    new_signups: number
    cancellations: number
    new_declines: number
    revenue_collected: number
    period_start: string
    period_end: string
}

function getDateRange(range: DateRange): { start: Date; end: Date } {
    const end = new Date()
    const start = new Date()

    switch (range) {
        case 'week':
            start.setDate(end.getDate() - 7)
            break
        case 'month':
            start.setMonth(end.getMonth() - 1)
            break
        case '30days':
            start.setDate(end.getDate() - 30)
            break
        case '90days':
            start.setDate(end.getDate() - 90)
            break
    }

    return { start, end }
}

/**
 * Get trend metrics for a date range
 */
export async function getTrendMetrics(range: DateRange): Promise<TrendMetrics> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { start, end } = getDateRange(range)
    const startStr = start.toISOString().split('T')[0]
    const endStr = end.toISOString().split('T')[0]

    // New signups = members created in date range
    const { count: newSignups } = await supabase
        .from('mb_members')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('creation_date', startStr)
        .lte('creation_date', endStr)

    // New declines = declines created in date range
    const { count: newDeclines } = await supabase
        .from('mb_declines')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('decline_date', startStr)
        .lte('decline_date', endStr)

    // Expired/Cancelled = members with 'Expired' status (synced recently)
    // Note: This is an estimate - we don't track when status changed
    const { count: expired } = await supabase
        .from('mb_members')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('membership_status', 'Expired')
        .gte('synced_at', start.toISOString())

    // Revenue = sum of monthly_rate for ACTIVE members only
    const { data: activeMembers } = await supabase
        .from('mb_members')
        .select('monthly_rate')
        .eq('user_id', user.id)
        .eq('membership_status', 'Active')
        .gt('monthly_rate', 0)

    const revenue = activeMembers?.reduce((sum, m) => sum + (m.monthly_rate || 0), 0) || 0

    return {
        new_signups: newSignups || 0,
        cancellations: expired || 0, // Expired members = cancellations
        new_declines: newDeclines || 0,
        revenue_collected: revenue,
        period_start: startStr,
        period_end: endStr
    }
}

/**
 * Get last sync timestamp
 */
export async function getLastSyncTime(): Promise<string | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data } = await supabase
        .from('mb_sync_log')
        .select('synced_at')
        .eq('user_id', user.id)
        .order('synced_at', { ascending: false })
        .limit(1)
        .single()

    return data?.synced_at || null
}
