"use server"

import { createClient } from "@/lib/supabase/server"
import { MindbodyClient } from "@/lib/integrations/mindbody/client"
import { MBMember, MBDecline, MRRSummary } from "@/lib/integrations/mindbody/bi-types"

// Get MRR Summary
export async function getMRRSummary(): Promise<MRRSummary> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Fetch ALL members with pagination (Supabase default limit is 1000)
    const allMembers: any[] = []
    let offset = 0
    const limit = 1000

    while (true) {
        const { data: batch } = await supabase
            .from('mb_members')
            .select('mb_client_id, monthly_rate, membership_status, member_type, next_payment_date')
            .eq('user_id', user.id)
            .range(offset, offset + limit - 1)

        if (!batch || batch.length === 0) break
        allMembers.push(...batch)
        if (batch.length < limit) break
        offset += limit
    }

    const members = allMembers

    if (members.length === 0) {
        return {
            total_mrr: 0,
            at_risk_mrr: 0,
            active_members: 0,
            declined_members: 0,
            pack_members: 0
        }
    }

    // ============================================================
    // MINDBODY STATUS PRIORITY HIERARCHY
    // Priority: Suspended (1) > Declined (2) > Active (3) > Terminated (4) > Expired (5)
    // ============================================================

    const STATUS_PRIORITY: Record<string, number> = {
        'Suspended': 1,
        'Declined': 2,
        'Active': 3,
        'Terminated': 4,
        'Expired': 5,
        'Non-Member': 99,
    }

    // Group by unique client, apply highest priority status
    const clientStatusMap = new Map<string, { status: string; priority: number; rate: number; type: string }>()

    for (const m of members) {
        const clientId = m.mb_client_id
        if (!clientId) continue

        const status = m.membership_status || 'Non-Member'
        const priority = STATUS_PRIORITY[status] || 99
        const rate = m.monthly_rate || 0
        const type = m.member_type || 'monthly'

        const current = clientStatusMap.get(clientId)

        if (!current || priority < current.priority) {
            clientStatusMap.set(clientId, { status, priority, rate, type })
        }
    }

    const clients = Array.from(clientStatusMap.values())

    // Active = status is Active (after priority applied)
    const activeMembers = clients.filter(c => c.status === 'Active')
    const declined = clients.filter(c => c.status === 'Declined')
    const packs = clients.filter(c => c.type === 'pack')

    // MRR = sum of monthly_rate for truly ACTIVE members
    const totalMrr = activeMembers.reduce((sum, c) => sum + c.rate, 0)

    return {
        total_mrr: totalMrr,
        at_risk_mrr: declined.reduce((sum, c) => sum + c.rate, 0),
        active_members: activeMembers.length,
        declined_members: declined.length,
        pack_members: packs.length
    }
}

/**
 * Get metrics for a specific period (month)
 * Uses Sales API for revenue (accounting record) and Transactions for declines (banking record)
 * @param startDate - Start of period (inclusive)
 * @param endDate - End of period (inclusive)
 */
export async function getPeriodMetrics(startDate: Date, endDate: Date): Promise<{
    revenue_collected: number
    transactions_count: number
    declined_amount: number
    declined_count: number
    active_members: number
    suspended_members: number
    declined_members: number
    previous_period?: {
        revenue_collected: number
        declined_amount: number
    }
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Import client dynamically to avoid circular deps
    const { MindbodyClient } = await import('@/lib/integrations/mindbody/client')
    const client = new MindbodyClient()

    // Get all sales for the period (this is the "Accounting" view - what was sold)
    const sales = await client.getAllSales(startDate, endDate) as any[]

    // Calculate gross revenue from sales
    let revenue_collected = 0
    let transactions_count = 0
    for (const sale of sales) {
        for (const item of (sale.PurchasedItems || [])) {
            if (!item.Returned) { // Don't count returned items
                revenue_collected += item.TotalAmount || 0
                transactions_count++
            }
        }
    }

    // Get declined tracking from stored transactions (the "Banking" view - how was it paid)
    const startStr = startDate.toISOString().split('T')[0]
    const endStr = endDate.toISOString().split('T')[0]

    const { data: txData } = await supabase
        .from('mb_transactions')
        .select('gross_amount, status, mb_client_id')
        .eq('user_id', user.id)
        .gte('transaction_date', startStr)
        .lte('transaction_date', endStr)

    const voided = (txData || []).filter(t =>
        t.status?.toLowerCase().includes('void')
    )

    // Count UNIQUE members with declined payments in this period
    const uniqueDeclinedClientIds = [...new Set(voided.map(t => t.mb_client_id).filter(Boolean))]
    const declined_members_in_period = uniqueDeclinedClientIds.length

    // Get member data to calculate at-risk revenue from their monthly_rate
    const { data: declinedMemberData } = await supabase
        .from('mb_members')
        .select('mb_client_id, monthly_rate')
        .eq('user_id', user.id)
        .in('mb_client_id', uniqueDeclinedClientIds.length > 0 ? uniqueDeclinedClientIds : ['none'])

    // Calculate at-risk revenue from declined members' monthly rates
    const declined_amount = (declinedMemberData || []).reduce((sum, m) => sum + (m.monthly_rate || 0), 0)

    // Get member status counts (current snapshot for active/suspended)
    const { data: members } = await supabase
        .from('mb_members')
        .select('membership_status')
        .eq('user_id', user.id)
        .gt('monthly_rate', 0)

    const statusCounts = { active: 0, suspended: 0, declined: 0 }
    for (const m of members || []) {
        const status = m.membership_status
        if (status === 'Active') statusCounts.active++
        else if (status === 'Suspended') statusCounts.suspended++
        else if (status === 'Declined') statusCounts.declined++
    }

    // Get previous period for comparison
    const duration = endDate.getTime() - startDate.getTime()
    const prevStart = new Date(startDate.getTime() - duration - 86400000)
    const prevEnd = new Date(startDate.getTime() - 86400000)

    // Previous period revenue from Sales API
    const prevSales = await client.getAllSales(prevStart, prevEnd) as any[]
    let prevRevenue = 0
    for (const sale of prevSales) {
        for (const item of (sale.PurchasedItems || [])) {
            if (!item.Returned) {
                prevRevenue += item.TotalAmount || 0
            }
        }
    }

    // Previous period declines from stored transactions
    const { data: prevTxData } = await supabase
        .from('mb_transactions')
        .select('gross_amount, status')
        .eq('user_id', user.id)
        .gte('transaction_date', prevStart.toISOString().split('T')[0])
        .lte('transaction_date', prevEnd.toISOString().split('T')[0])

    const prevVoided = (prevTxData || []).filter(t =>
        t.status?.toLowerCase().includes('void')
    )
    const prevDeclined = prevVoided.reduce((sum, t) => sum + (t.gross_amount || 0), 0)

    return {
        revenue_collected,
        transactions_count,
        declined_amount,
        declined_count: voided.length,
        active_members: statusCounts.active,
        suspended_members: statusCounts.suspended,
        declined_members: declined_members_in_period, // Period-specific unique members
        previous_period: {
            revenue_collected: prevRevenue,
            declined_amount: prevDeclined
        }
    }
}

/**
 * Debug function to inspect transaction data
 */
export async function debugTransactionData(): Promise<{
    totalTransactions: number
    withTransactionDate: number
    withoutTransactionDate: number
    sampleDates: string[]
    statusBreakdown: Record<string, number>
    decemberCount: number
    januaryCount: number
    voidedBreakdown: {
        total: number
        december: number
        january: number
        sampleVoidedDates: { date: string; amount: number }[]
    }
    sampleTransactions: any[]
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Get all transactions
    const { data: all } = await supabase
        .from('mb_transactions')
        .select('transaction_date, gross_amount, net_amount, status')
        .eq('user_id', user.id)
        .limit(1000)

    const transactions = all || []

    const withDate = transactions.filter(t => t.transaction_date)
    const withoutDate = transactions.filter(t => !t.transaction_date)

    // Status breakdown
    const statusBreakdown: Record<string, number> = {}
    for (const t of transactions) {
        const status = t.status || 'null'
        statusBreakdown[status] = (statusBreakdown[status] || 0) + 1
    }

    // December 2025 count
    const december = transactions.filter(t => {
        if (!t.transaction_date) return false
        const d = new Date(t.transaction_date)
        return d.getMonth() === 11 && d.getFullYear() === 2025
    })

    // January 2026 count
    const january = transactions.filter(t => {
        if (!t.transaction_date) return false
        const d = new Date(t.transaction_date)
        return d.getMonth() === 0 && d.getFullYear() === 2026
    })

    // Voided transactions breakdown by month
    const voided = transactions.filter(t => t.status?.toLowerCase().includes('void'))
    const voidedDecember = voided.filter(t => {
        const d = new Date(t.transaction_date)
        return d.getMonth() === 11 && d.getFullYear() === 2025
    })
    const voidedJanuary = voided.filter(t => {
        const d = new Date(t.transaction_date)
        return d.getMonth() === 0 && d.getFullYear() === 2026
    })

    return {
        totalTransactions: transactions.length,
        withTransactionDate: withDate.length,
        withoutTransactionDate: withoutDate.length,
        sampleDates: withDate.slice(0, 5).map(t => t.transaction_date),
        statusBreakdown,
        decemberCount: december.length,
        januaryCount: january.length,
        voidedBreakdown: {
            total: voided.length,
            december: voidedDecember.length,
            january: voidedJanuary.length,
            sampleVoidedDates: voided.slice(0, 5).map(t => ({
                date: t.transaction_date,
                amount: t.gross_amount
            }))
        },
        sampleTransactions: transactions.slice(0, 3)
    }
}

/**
 * Debug: Call API directly to see raw transaction field names
 */
export async function debugRawApiTransaction(): Promise<any> {
    const { MindbodyClient } = await import('@/lib/integrations/mindbody/client')
    const client = new MindbodyClient()

    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 45)

    try {
        const response = await client.getTransactions(startDate, endDate, 3, 0)
        const transactions = response.Transactions || []

        if (transactions.length === 0) {
            return { message: 'No transactions found', raw: response }
        }

        // Show all field names from first transaction
        const first = transactions[0]
        const fields = Object.keys(first)
        const dateFields = fields.filter(f => f.toLowerCase().includes('date') || f.toLowerCase().includes('time'))

        return {
            totalFields: fields.length,
            allFields: fields,
            dateFields,
            sampleTransaction: first
        }
    } catch (error) {
        return { error: error instanceof Error ? error.message : 'Failed to fetch' }
    }
}

// Get members at high churn risk
export async function getAtRiskMembers(limit: number = 10): Promise<MBMember[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { data } = await supabase
        .from('mb_members')
        .select('*')
        .eq('user_id', user.id)
        .gte('churn_risk', 50)
        .order('monthly_rate', { ascending: false })
        .order('churn_risk', { ascending: false })
        .limit(limit)

    return data || []
}

/**
 * Get members in the "At Risk" danger zone (35-45 days since last payment).
 * These are silent churn candidates - they haven't declined but haven't paid either.
 */
export async function getAtRiskSilentChurn(): Promise<{
    clientId: string
    name: string
    email: string
    monthly_rate: number
    daysSincePayment: number
    lastPaymentDate: string
}[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Get active members with monthly_rate > 0
    const { data: members } = await supabase
        .from('mb_members')
        .select('mb_client_id, first_name, last_name, email, monthly_rate')
        .eq('user_id', user.id)
        .gt('monthly_rate', 0)

    if (!members || members.length === 0) return []

    // Get last successful transaction for each member
    const clientIds = members.map(m => m.mb_client_id)
    const { data: transactions } = await supabase
        .from('mb_transactions')
        .select('mb_client_id, transaction_date')
        .eq('user_id', user.id)
        .in('status', ['Approved', 'Completed'])
        .in('mb_client_id', clientIds)
        .order('transaction_date', { ascending: false })

    // Map to last transaction date per client
    const lastTxMap = new Map<string, string>()
    for (const tx of transactions || []) {
        if (!lastTxMap.has(tx.mb_client_id)) {
            lastTxMap.set(tx.mb_client_id, tx.transaction_date)
        }
    }

    const today = new Date()
    const atRisk: {
        clientId: string
        name: string
        email: string
        monthly_rate: number
        daysSincePayment: number
        lastPaymentDate: string
    }[] = []

    for (const member of members) {
        const lastTx = lastTxMap.get(member.mb_client_id)
        if (!lastTx) continue

        const lastPaymentDate = new Date(lastTx)
        const daysSince = Math.floor((today.getTime() - lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24))

        // At Risk: 35-45 days since last payment (danger zone before churn)
        if (daysSince >= 35 && daysSince <= 45) {
            atRisk.push({
                clientId: member.mb_client_id,
                name: `${member.first_name || ''} ${member.last_name || ''}`.trim() || 'Unknown',
                email: member.email || '',
                monthly_rate: member.monthly_rate || 0,
                daysSincePayment: daysSince,
                lastPaymentDate: lastTx
            })
        }
    }

    // Sort by highest value first
    return atRisk.sort((a, b) => b.monthly_rate - a.monthly_rate)
}

// Get declined members for a specific period (based on transaction dates, not status)
// Excludes members who made a successful payment AFTER their last decline
export async function getPeriodDeclines(startDate: Date, endDate: Date): Promise<{
    clientId: string
    name: string
    email: string
    monthly_rate: number
    declineDate: string
    declineCount: number
    recovered: boolean
}[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const startStr = startDate.toISOString().split('T')[0]
    const endStr = endDate.toISOString().split('T')[0]

    // Get voided transactions in period
    const { data: voidedTx } = await supabase
        .from('mb_transactions')
        .select('mb_client_id, transaction_date, gross_amount')
        .eq('user_id', user.id)
        .ilike('status', '%void%')
        .gte('transaction_date', startStr)
        .lte('transaction_date', endStr)

    if (!voidedTx || voidedTx.length === 0) return []

    // Group by client and find their last decline date
    const clientDeclines = new Map<string, { dates: string[]; count: number; lastDecline: string }>()
    for (const tx of voidedTx) {
        if (!tx.mb_client_id) continue
        const existing = clientDeclines.get(tx.mb_client_id) || { dates: [], count: 0, lastDecline: '' }
        existing.dates.push(tx.transaction_date)
        existing.count++
        // Track most recent decline
        if (!existing.lastDecline || tx.transaction_date > existing.lastDecline) {
            existing.lastDecline = tx.transaction_date
        }
        clientDeclines.set(tx.mb_client_id, existing)
    }

    const clientIds = [...clientDeclines.keys()]

    // Get ALL transactions for these clients to check for recovery
    const { data: allTx } = await supabase
        .from('mb_transactions')
        .select('mb_client_id, transaction_date, status')
        .eq('user_id', user.id)
        .eq('status', 'Approved')
        .in('mb_client_id', clientIds)
        .gte('transaction_date', startStr)

    // Build map of successful payments after last decline
    const clientRecoveries = new Map<string, boolean>()
    for (const clientId of clientIds) {
        const declineData = clientDeclines.get(clientId)!
        const lastDecline = declineData.lastDecline

        // Check if there's an approved payment AFTER the last decline
        const hasRecovered = (allTx || []).some(tx =>
            tx.mb_client_id === clientId &&
            tx.transaction_date > lastDecline
        )
        clientRecoveries.set(clientId, hasRecovered)
    }

    // Get member details for those clients
    const { data: members } = await supabase
        .from('mb_members')
        .select('mb_client_id, first_name, last_name, email, monthly_rate')
        .eq('user_id', user.id)
        .in('mb_client_id', clientIds)

    // Combine data - filter out recovered members by default but add flag
    return (members || [])
        .map(m => {
            const declineData = clientDeclines.get(m.mb_client_id) || { dates: [], count: 0, lastDecline: '' }
            const recovered = clientRecoveries.get(m.mb_client_id) || false
            return {
                clientId: m.mb_client_id,
                name: `${m.first_name || ''} ${m.last_name || ''}`.trim() || 'Unknown',
                email: m.email || '',
                monthly_rate: m.monthly_rate || 0,
                declineDate: declineData.dates[0] || '',
                declineCount: declineData.count,
                recovered
            }
        })
        .filter(m => !m.recovered) // Only show unrecovered declines
        .sort((a, b) => b.monthly_rate - a.monthly_rate)
}

// Get members who have declined in multiple months (repeat offenders)
export async function getRepeatDecliners(monthsBack: number = 6): Promise<{
    clientId: string
    name: string
    email: string
    monthly_rate: number
    monthsWithDeclines: number
    totalDeclineCount: number
    declineMonths: string[]
}[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const endDate = new Date()
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - monthsBack)

    // Get all voided transactions in the lookback period
    const { data: voidedTx } = await supabase
        .from('mb_transactions')
        .select('mb_client_id, transaction_date')
        .eq('user_id', user.id)
        .ilike('status', '%void%')
        .gte('transaction_date', startDate.toISOString().split('T')[0])
        .lte('transaction_date', endDate.toISOString().split('T')[0])

    if (!voidedTx || voidedTx.length === 0) return []

    // Group by client and count unique months
    const clientStats = new Map<string, { months: Set<string>; count: number }>()
    for (const tx of voidedTx) {
        if (!tx.mb_client_id) continue
        const monthKey = tx.transaction_date.substring(0, 7) // YYYY-MM
        const existing = clientStats.get(tx.mb_client_id) || { months: new Set(), count: 0 }
        existing.months.add(monthKey)
        existing.count++
        clientStats.set(tx.mb_client_id, existing)
    }

    // Filter to only members with declines in 2+ months
    const repeatClientIds = [...clientStats.entries()]
        .filter(([_, stats]) => stats.months.size >= 2)
        .map(([id]) => id)

    if (repeatClientIds.length === 0) return []

    // Get member details
    const { data: members } = await supabase
        .from('mb_members')
        .select('mb_client_id, first_name, last_name, email, monthly_rate')
        .eq('user_id', user.id)
        .in('mb_client_id', repeatClientIds)

    return (members || []).map(m => {
        const stats = clientStats.get(m.mb_client_id)!
        return {
            clientId: m.mb_client_id,
            name: `${m.first_name || ''} ${m.last_name || ''}`.trim() || 'Unknown',
            email: m.email || '',
            monthly_rate: m.monthly_rate || 0,
            monthsWithDeclines: stats.months.size,
            totalDeclineCount: stats.count,
            declineMonths: [...stats.months].sort().reverse()
        }
    }).sort((a, b) => b.monthsWithDeclines - a.monthsWithDeclines || b.monthly_rate - a.monthly_rate)
}

// Get active declines
export async function getActiveDeclines(): Promise<MBDecline[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { data } = await supabase
        .from('mb_declines')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['new', 'contacted'])
        .order('amount', { ascending: false })

    return data || []
}

// Update decline status
export async function updateDeclineStatus(
    declineId: string,
    status: 'contacted' | 'recovered' | 'lost',
    notes?: string
): Promise<{ success: boolean }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // First get current contact_attempts
    const { data: current } = await supabase
        .from('mb_declines')
        .select('contact_attempts')
        .eq('id', declineId)
        .single()

    const updates: any = { status }

    if (status === 'contacted') {
        updates.contact_attempts = (current?.contact_attempts || 0) + 1
        updates.last_contacted_at = new Date().toISOString()
    } else if (status === 'recovered') {
        updates.recovered_at = new Date().toISOString()
    }

    if (notes) {
        updates.notes = notes
    }

    const { error } = await supabase
        .from('mb_declines')
        .update(updates)
        .eq('id', declineId)
        .eq('user_id', user.id)

    return { success: !error }
}

// Get credit pack members needing renewal
export async function getLowCreditMembers(): Promise<MBMember[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { data } = await supabase
        .from('mb_members')
        .select('*')
        .eq('user_id', user.id)
        .eq('member_type', 'pack')
        .gt('credits_remaining', 0)
        .lte('credits_remaining', 3)
        .order('credits_remaining', { ascending: true })

    return data || []
}

// Get trial conversion stats
export async function getTrialConversionStats(): Promise<{
    type: string
    total: number
    converted: number
    conversion_rate: number
    monthly_revenue: number
}[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { data: members } = await supabase
        .from('mb_members')
        .select('first_purchase_type, member_type, monthly_rate')
        .eq('user_id', user.id)
        .in('first_purchase_type', ['free_trial', 'paid_trial', 'drop_in'])

    if (!members) return []

    const stats: Record<string, { total: number; converted: number; revenue: number }> = {}

    members.forEach(m => {
        const type = m.first_purchase_type || 'unknown'
        if (!stats[type]) {
            stats[type] = { total: 0, converted: 0, revenue: 0 }
        }
        stats[type].total++
        if (m.member_type === 'monthly') {
            stats[type].converted++
            stats[type].revenue += m.monthly_rate || 0
        }
    })

    return Object.entries(stats).map(([type, data]) => ({
        type,
        total: data.total,
        converted: data.converted,
        conversion_rate: data.total > 0 ? Math.round((data.converted / data.total) * 100) : 0,
        monthly_revenue: data.revenue
    }))
}

// Get last sync time
export async function getLastSyncTime(syncType: string): Promise<Date | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data } = await supabase
        .from('mb_sync_log')
        .select('last_sync_at')
        .eq('user_id', user.id)
        .eq('sync_type', syncType)
        .order('last_sync_at', { ascending: false })
        .limit(1)
        .single()

    return data?.last_sync_at ? new Date(data.last_sync_at) : null
}

// Log a sync
export async function logSync(
    syncType: string,
    recordsSynced: number,
    apiCallsUsed: number,
    success: boolean = true,
    errorMessage?: string
): Promise<void> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('mb_sync_log').insert({
        user_id: user.id,
        sync_type: syncType,
        last_sync_at: new Date().toISOString(),
        records_synced: recordsSynced,
        api_calls_used: apiCallsUsed,
        success,
        error_message: errorMessage
    })
}

// ============================================
// AUTOPAY FORECAST INTEGRATION
// ============================================

/**
 * Sync Mindbody member autopay schedules to the scheduled_payments table.
 * Uses mb_members table (synced from member sync) to populate scheduled payments.
 */
export async function syncMindbodyScheduledPayments(): Promise<{
    success: boolean
    scheduled: number
    updated: number
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    console.log('[AUTOPAY SYNC] Fetching members for autopay forecast...')

    // Get Active AND Declined members - Mindbody still attempts autopay on Declined!
    // Note: We don't filter by next_payment_date anymore - we'll derive it if null
    const { data: members, error } = await supabase
        .from('mb_members')
        .select('mb_client_id, first_name, last_name, next_payment_date, monthly_rate, membership_name, membership_status')
        .eq('user_id', user.id)
        .in('membership_status', ['Active', 'Declined'])  // Include Declined - they're still billed!
        .gt('monthly_rate', 0)

    if (error) throw error
    console.log(`[AUTOPAY SYNC] Found ${members?.length || 0} members with autopay (Active + Declined)`)

    if (!members || members.length === 0) {
        return { success: true, scheduled: 0, updated: 0 }
    }

    // Get last transaction dates for members without next_payment_date
    const memberIdsWithoutDate = members
        .filter(m => !m.next_payment_date)
        .map(m => m.mb_client_id)

    let lastTransactionMap: Record<string, string> = {}
    if (memberIdsWithoutDate.length > 0) {
        // Fetch last successful transaction per client
        const { data: lastTxns } = await supabase
            .from('mb_transactions')
            .select('clientId, saleDate')
            .eq('user_id', user.id)
            .eq('status', 'Approved')
            .in('clientId', memberIdsWithoutDate)
            .order('saleDate', { ascending: false })

        // Build map of clientId -> last transaction date
        for (const txn of lastTxns || []) {
            if (!lastTransactionMap[txn.clientId]) {
                lastTransactionMap[txn.clientId] = txn.saleDate
            }
        }
    }

    // Calculate date range (current month + next month)
    const today = new Date()
    const endDate = new Date(today.getFullYear(), today.getMonth() + 2, 0) // End of next month

    // Clear old scheduled payments from Mindbody for future dates
    await supabase
        .from('scheduled_payments')
        .delete()
        .eq('user_id', user.id)
        .eq('source', 'mindbody')
        .eq('payment_status', 'scheduled')
        .gte('scheduled_date', today.toISOString().split('T')[0])

    // Build scheduled payments from members
    const payments: {
        user_id: string
        source: string
        client_name: string
        description: string
        amount: number
        scheduled_date: string
        payment_status: string
    }[] = []

    for (const member of members) {
        if (!member.monthly_rate) continue

        const clientName = `${member.first_name || ''} ${member.last_name || ''}`.trim() || 'Unknown'

        // Derive payment date if not set
        let paymentDate: Date
        if (member.next_payment_date) {
            paymentDate = new Date(member.next_payment_date)
        } else {
            // Check if we have a last transaction to derive from
            const lastTxn = lastTransactionMap[member.mb_client_id]
            if (lastTxn) {
                paymentDate = new Date(lastTxn)
                paymentDate.setMonth(paymentDate.getMonth() + 1) // +1 month from last payment
            } else {
                // No traceable history - skip this member (they're likely truly inactive)
                // They'll be included once they make a payment
                continue
            }
        }

        // Add payments for current and next month (if recurring monthly)
        while (paymentDate <= endDate) {
            if (paymentDate >= today) {
                payments.push({
                    user_id: user.id,
                    source: 'mindbody',
                    client_name: clientName,
                    description: member.membership_name || 'Membership',
                    amount: member.monthly_rate,
                    scheduled_date: paymentDate.toISOString().split('T')[0],
                    payment_status: 'scheduled'
                })
            }
            // Move to next month (same day)
            paymentDate.setMonth(paymentDate.getMonth() + 1)
        }
    }

    console.log(`[AUTOPAY SYNC] Created ${payments.length} scheduled payments`)

    if (payments.length === 0) {
        return { success: true, scheduled: 0, updated: 0 }
    }

    // Insert new scheduled payments
    const { error: insertError } = await supabase
        .from('scheduled_payments')
        .insert(payments)

    if (insertError) throw insertError

    // Update the cash_flow_sources table for freshness tracking
    await supabase
        .from('cash_flow_sources')
        .upsert({
            user_id: user.id,
            source_type: 'mindbody_scheduled',
            last_import_at: new Date().toISOString(),
            record_count: payments.length,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,source_type' })

    // Now update any scheduled payments that have already been collected
    const updated = await updateScheduledPaymentsFromTransactions()

    return {
        success: true,
        scheduled: payments.length,
        updated
    }
}

/**
 * Update scheduled_payments status based on actual mb_transactions.
 * Marks payments as 'collected' if a matching transaction is found.
 */
export async function updateScheduledPaymentsFromTransactions(): Promise<number> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Get scheduled payments that haven't been marked collected yet
    const { data: scheduled } = await supabase
        .from('scheduled_payments')
        .select('id, client_name, scheduled_date, amount')
        .eq('user_id', user.id)
        .eq('source', 'mindbody')
        .eq('payment_status', 'scheduled')

    if (!scheduled || scheduled.length === 0) return 0

    // Get all successful transactions in the relevant date range
    const scheduledDates = scheduled.map(s => s.scheduled_date)
    const minDate = scheduledDates.reduce((a, b) => a < b ? a : b)
    const maxDate = scheduledDates.reduce((a, b) => a > b ? a : b)

    const { data: transactions } = await supabase
        .from('mb_transactions')
        .select('mb_client_id, transaction_date, gross_amount, status')
        .eq('user_id', user.id)
        .eq('status', 'Approved')
        .gte('transaction_date', minDate)
        .lte('transaction_date', maxDate)

    if (!transactions || transactions.length === 0) return 0

    // Build a set of transaction dates for quick lookup
    const txDates = new Set(transactions.map(t => t.transaction_date))

    // Update payments that match a transaction (±2 days tolerance)
    const toUpdate: string[] = []
    for (const payment of scheduled) {
        const paymentDate = new Date(payment.scheduled_date)

        // Check if any transaction is within ±2 days
        for (let offset = -2; offset <= 2; offset++) {
            const checkDate = new Date(paymentDate)
            checkDate.setDate(checkDate.getDate() + offset)
            const checkStr = checkDate.toISOString().split('T')[0]

            if (txDates.has(checkStr)) {
                toUpdate.push(payment.id)
                break
            }
        }
    }

    if (toUpdate.length > 0) {
        await supabase
            .from('scheduled_payments')
            .update({ payment_status: 'collected' })
            .in('id', toUpdate)
    }

    return toUpdate.length
}

/**
 * Get upcoming scheduled autopay payments for forecasting display
 */
export async function getUpcomingScheduledPayments(): Promise<{
    thisMonth: { count: number; total: number }
    nextMonth: { count: number; total: number }
    payments: Array<{
        client_name: string
        description: string
        amount: number
        scheduled_date: string
        payment_status: string
    }>
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const today = new Date()
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0)

    // Get all scheduled payments for this and next month
    const { data: payments, error } = await supabase
        .from('scheduled_payments')
        .select('client_name, description, amount, scheduled_date, payment_status')
        .eq('user_id', user.id)
        .eq('source', 'mindbody')
        .eq('payment_status', 'scheduled')
        .gte('scheduled_date', thisMonthStart.toISOString().split('T')[0])
        .lte('scheduled_date', nextMonthEnd.toISOString().split('T')[0])
        .order('scheduled_date', { ascending: true })

    if (error) throw error

    const thisMonthPayments = (payments || []).filter(p => {
        const d = new Date(p.scheduled_date)
        return d >= thisMonthStart && d <= thisMonthEnd
    })

    const nextMonthPayments = (payments || []).filter(p => {
        const d = new Date(p.scheduled_date)
        return d >= nextMonthStart && d <= nextMonthEnd
    })

    return {
        thisMonth: {
            count: thisMonthPayments.length,
            total: thisMonthPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
        },
        nextMonth: {
            count: nextMonthPayments.length,
            total: nextMonthPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
        },
        payments: payments || []
    }
}
