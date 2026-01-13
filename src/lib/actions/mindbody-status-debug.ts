"use server"

import { createClient } from "@/lib/supabase/server"

/**
 * Debug function to see unique status values and counts in the database
 */
export async function getStatusBreakdown(): Promise<{
    statuses: { status: string; count: number }[]
    memberTypes: { type: string; count: number }[]
    totalMembers: number
    withPricing: number
    withoutPricing: number
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Get all members
    const { data: members } = await supabase
        .from('mb_members')
        .select('membership_status, member_type, monthly_rate, membership_name')
        .eq('user_id', user.id)

    if (!members) {
        return {
            statuses: [],
            memberTypes: [],
            totalMembers: 0,
            withPricing: 0,
            withoutPricing: 0
        }
    }

    // Count by status
    const statusCounts = new Map<string, number>()
    for (const m of members) {
        const status = m.membership_status || 'null'
        statusCounts.set(status, (statusCounts.get(status) || 0) + 1)
    }

    // Count by member type
    const typeCounts = new Map<string, number>()
    for (const m of members) {
        const type = m.member_type || 'null'
        typeCounts.set(type, (typeCounts.get(type) || 0) + 1)
    }

    // Pricing stats
    const withPricing = members.filter(m => (m.monthly_rate || 0) > 0).length
    const withoutPricing = members.length - withPricing

    return {
        statuses: Array.from(statusCounts.entries())
            .map(([status, count]) => ({ status, count }))
            .sort((a, b) => b.count - a.count),
        memberTypes: Array.from(typeCounts.entries())
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => b.count - a.count),
        totalMembers: members.length,
        withPricing,
        withoutPricing
    }
}
