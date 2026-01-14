"use server"

import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"

// ============================================
// TYPES
// ============================================

export interface Member {
    id: string
    user_id: string
    mb_client_id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    phone: string | null
    mobile_phone: string | null
    gender: string | null
    birth_date: string | null
    photo_url: string | null
    membership_status: string | null
    membership_name: string | null
    monthly_rate: number
    member_type: string | null
    join_date: string | null
    next_payment_date: string | null
    last_visit_date: string | null
    churn_risk: number | null
    notes: string | null
    is_merged: boolean
    merged_into_id: string | null
    merged_at: string | null
    address_line1: string | null
    city: string | null
    postal_code: string | null
    synced_at: string | null
}

export interface MemberFilters {
    search?: string
    status?: string
    memberType?: string
    showMerged?: boolean
}

// ============================================
// GET MEMBERS (with pagination, search, filter)
// Handles Supabase 1000 row limit by batching
// ============================================

export async function getMembers(
    filters: MemberFilters = {},
    limit: number = 50,
    offset: number = 0
): Promise<{ members: Member[]; total: number }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Build common filters
    const buildQuery = () => {
        let query = supabase
            .from('mb_members')
            .select('*', { count: 'exact' })
            .eq('user_id', user.id)

        // Filter out merged members by default
        if (!filters.showMerged) {
            query = query.or('is_merged.is.null,is_merged.eq.false')
        }

        // Search by name or email
        if (filters.search) {
            const searchTerm = `%${filters.search}%`
            query = query.or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm}`)
        }

        // Filter by status
        if (filters.status && filters.status !== 'all') {
            query = query.eq('membership_status', filters.status)
        }

        // Filter by member type
        if (filters.memberType && filters.memberType !== 'all') {
            query = query.eq('member_type', filters.memberType)
        }

        return query
    }

    // If limit is <= 1000, single query is fine
    if (limit <= 1000) {
        const query = buildQuery()
            .order('first_name', { ascending: true })
            .range(offset, offset + limit - 1)

        const { data, error, count } = await query

        if (error) {
            logger.error('MINDBODY', 'Failed to fetch members', { error: error.message })
            throw error
        }

        return { members: data || [], total: count || 0 }
    }

    // For limit > 1000, paginate in batches
    const allMembers: Member[] = []
    let currentOffset = offset
    const batchSize = 1000
    let totalCount = 0

    while (allMembers.length < limit) {
        const query = buildQuery()
            .order('first_name', { ascending: true })
            .range(currentOffset, currentOffset + batchSize - 1)

        const { data: batch, error, count } = await query

        if (error) {
            logger.error('MINDBODY', 'Failed to fetch members batch', { error: error.message })
            throw error
        }

        if (count !== null) totalCount = count
        if (!batch || batch.length === 0) break

        allMembers.push(...batch)
        if (batch.length < batchSize) break // No more data
        currentOffset += batchSize
    }

    // Deduplicate by id to prevent React duplicate key errors
    const seen = new Set<string>()
    const uniqueMembers = allMembers.filter(m => {
        if (seen.has(m.id)) return false
        seen.add(m.id)
        return true
    })

    return {
        members: uniqueMembers.slice(0, limit),
        total: totalCount
    }
}

// ============================================
// GET SINGLE MEMBER
// ============================================

export async function getMember(mbClientId: string): Promise<Member | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { data, error } = await supabase
        .from('mb_members')
        .select('*')
        .eq('user_id', user.id)
        .eq('mb_client_id', mbClientId)
        .single()

    if (error) {
        if (error.code === 'PGRST116') return null // Not found
        throw error
    }

    return data
}

// ============================================
// GET MEMBER TRANSACTIONS (Payment History)
// Includes transactions from any clients merged into this member
// ============================================

export async function getMemberTransactions(mbClientId: string, limit: number = 50): Promise<{
    transactions: {
        id: string
        mb_sale_id: string
        gross_amount: number
        net_amount: number
        status: string
        payment_type: string
        description: string | null
        transaction_date: string
        from_merged_client?: boolean
    }[]
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // First, find any clients that were merged INTO this member
    const { data: mergedClients } = await supabase
        .from('mb_members')
        .select('mb_client_id')
        .eq('user_id', user.id)
        .eq('merged_into_id', mbClientId)

    // Build list of all client IDs to fetch transactions for
    const clientIds = [mbClientId]
    const mergedClientIds = (mergedClients || []).map(m => m.mb_client_id)
    clientIds.push(...mergedClientIds)

    // Fetch transactions for all related client IDs
    const { data, error } = await supabase
        .from('mb_transactions')
        .select('id, mb_sale_id, mb_client_id, gross_amount, net_amount, status, payment_type, description, transaction_date')
        .eq('user_id', user.id)
        .in('mb_client_id', clientIds)
        .order('transaction_date', { ascending: false })
        .limit(limit)

    if (error) throw error

    // Mark transactions that came from merged clients
    const transactions = (data || []).map(tx => ({
        ...tx,
        from_merged_client: mergedClientIds.includes(tx.mb_client_id)
    }))

    return { transactions }
}

// ============================================
// UPDATE MEMBER NOTES
// ============================================

export async function updateMemberNotes(
    mbClientId: string,
    notes: string
): Promise<{ success: boolean }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { error } = await supabase
        .from('mb_members')
        .update({ notes, synced_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('mb_client_id', mbClientId)

    if (error) {
        logger.error('MINDBODY', 'Failed to update member notes', { mbClientId, error: error.message })
        throw error
    }

    return { success: true }
}

// ============================================
// GET MEMBER STATS (for page header)
// Uses pagination to handle >1000 members
// ============================================

export async function getMemberStats(): Promise<{
    total: number
    active: number
    declined: number
    suspended: number
    terminated: number
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Paginate to get ALL members (Supabase default limit is 1000)
    const allMembers: { membership_status: string | null }[] = []
    let offset = 0
    const limit = 1000

    while (true) {
        const { data: batch, error } = await supabase
            .from('mb_members')
            .select('membership_status')
            .eq('user_id', user.id)
            .or('is_merged.is.null,is_merged.eq.false')
            .range(offset, offset + limit - 1)

        if (error) throw error
        if (!batch || batch.length === 0) break

        allMembers.push(...batch)

        // If we got less than limit, we're done
        if (batch.length < limit) break
        offset += limit
    }

    const stats = {
        total: allMembers.length,
        active: 0,
        declined: 0,
        suspended: 0,
        terminated: 0
    }

    for (const m of allMembers) {
        switch (m.membership_status) {
            case 'Active': stats.active++; break
            case 'Declined': stats.declined++; break
            case 'Suspended': stats.suspended++; break
            case 'Terminated': stats.terminated++; break
        }
    }

    return stats
}

// ============================================
// HANDLE MERGED MEMBER
// ============================================

export async function markMemberAsMerged(
    loserId: string,
    winnerId: string
): Promise<{ success: boolean }> {
    const supabase = await createClient()

    const { error } = await supabase
        .from('mb_members')
        .update({
            is_merged: true,
            merged_into_id: winnerId,
            merged_at: new Date().toISOString()
        })
        .eq('mb_client_id', loserId)

    if (error) {
        logger.error('MINDBODY', 'Failed to mark member as merged', { loserId, winnerId, error: error.message })
        return { success: false }
    }

    logger.info('MINDBODY', 'Member marked as merged', { loserId, winnerId })
    return { success: true }
}
