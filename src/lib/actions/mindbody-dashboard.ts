"use server"

import { createClient } from "@/lib/supabase/server"

/**
 * Enrichment Dashboard Service - Logic Layer
 * 
 * Provides aggregated data for the enrichment dashboard:
 * - Revenue breakdown (Gross, Tax, Tips, Fees)
 * - Membership snapshot (Active, Suspended, Terminated)
 * - Risk metrics (Declines, Expiring Contracts)
 */

export interface RevenueBreakdown {
    gross: number
    tax: number
    tips: number
    fees: number
    net: number
    transactionCount: number
}

export interface MembershipSnapshot {
    active: number       // Including "New" members
    suspended: number
    terminated: number
    declined: number     // Payment declined
    expired: number      // Membership expired
    expiringSoon: number
    total: number
}

export interface RiskMetrics {
    declinedCount: number
    atRiskCount: number
    expiringNext30Days: number
    unreconciledSettlements: number
    unreconciledValue: number
}

export interface EnrichmentDashboardData {
    revenue: RevenueBreakdown
    memberships: MembershipSnapshot
    risks: RiskMetrics
    lastSynced: string | null
}

/**
 * Get revenue breakdown for a date range (only successful transactions)
 */
export async function getRevenueBreakdown(
    daysBack: number = 30
): Promise<RevenueBreakdown> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { gross: 0, tax: 0, tips: 0, fees: 0, net: 0, transactionCount: 0 }

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysBack)

    // Only query successful transactions (gross_amount > 0)
    const { data } = await supabase
        .from("mb_transactions")
        .select("gross_amount, tax_amount, tip_amount, calculated_fee, net_amount")
        .eq("user_id", user.id)
        .gt("gross_amount", 0)
        .gte("transaction_date", startDate.toISOString())

    if (!data) return { gross: 0, tax: 0, tips: 0, fees: 0, net: 0, transactionCount: 0 }

    return {
        gross: round(data.reduce((s, t) => s + (t.gross_amount || 0), 0)),
        tax: round(data.reduce((s, t) => s + (t.tax_amount || 0), 0)),
        tips: round(data.reduce((s, t) => s + (t.tip_amount || 0), 0)),
        fees: round(data.reduce((s, t) => s + (t.calculated_fee || 0), 0)),
        net: round(data.reduce((s, t) => s + (t.net_amount || 0), 0)),
        transactionCount: data.length,
    }
}

/**
 * Get membership status snapshot from mb_members (one record per unique client)
 * This matches what the main Mindbody Intelligence page uses
 */
export async function getMembershipSnapshot(): Promise<MembershipSnapshot> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { active: 0, suspended: 0, terminated: 0, declined: 0, expired: 0, expiringSoon: 0, total: 0 }

    // Fetch ALL members with pagination (each row = one unique client)
    const allMembers: any[] = []
    let offset = 0
    const limit = 1000

    while (true) {
        const { data } = await supabase
            .from("mb_members")
            .select("mb_client_id, membership_status, monthly_rate, next_payment_date, membership_name")
            .eq("user_id", user.id)
            .range(offset, offset + limit - 1)

        if (!data || data.length === 0) break
        allMembers.push(...data)
        if (data.length < limit) break
        offset += limit
    }

    // ============================================================
    // MINDBODY STATUS PRIORITY HIERARCHY
    // A client with multiple memberships gets their HIGHEST priority status
    // Priority: Suspended (1) > Declined (2) > Active (3) > Terminated (4) > Expired (5)
    // ============================================================

    const STATUS_PRIORITY: Record<string, number> = {
        'Suspended': 1,   // Highest - freeze/pause on contract
        'Declined': 2,    // Last autopay failed
        'Active': 3,      // Current and paid
        'Terminated': 4,  // Manually ended before expiration
        'Expired': 5,     // Naturally ended
        'Non-Member': 99, // No membership
    }

    const now = new Date()
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(now.getDate() + 30)

    // Cross-reference with voided transactions to detect Declined status
    const { data: voidedTransactions } = await supabase
        .from('mb_transactions')
        .select('mb_client_id')
        .eq('user_id', user.id)
        .eq('status', 'Voided')
        .gte('transaction_date', new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString())

    const declinedClientIds = new Set<string>()
    for (const tx of voidedTransactions || []) {
        if (tx.mb_client_id) declinedClientIds.add(tx.mb_client_id)
    }

    // Apply status override based on transaction history
    // If client has voided transactions, they're Declined (priority 2)
    for (const m of allMembers) {
        if (declinedClientIds.has(m.mb_client_id)) {
            // Override to Declined if current status has lower priority
            const currentPriority = STATUS_PRIORITY[m.membership_status] || 99
            if (currentPriority > 2) {
                m.membership_status = 'Declined'
            }
        }
    }

    // Group by unique client and determine their highest priority status
    const clientStatusMap = new Map<string, { status: string; priority: number; hasRate: boolean; expiringSoon: boolean }>()

    for (const m of allMembers) {
        const clientId = m.mb_client_id
        if (!clientId) continue

        const status = m.membership_status || 'Non-Member'
        const priority = STATUS_PRIORITY[status] || 99
        const hasRate = (m.monthly_rate || 0) > 0
        const paymentDate = m.next_payment_date ? new Date(m.next_payment_date) : null
        const expiringSoon = paymentDate ? (paymentDate <= thirtyDaysFromNow && paymentDate >= now) : false

        const current = clientStatusMap.get(clientId)

        // Use HIGHEST priority (lowest number) status
        if (!current || priority < current.priority) {
            clientStatusMap.set(clientId, { status, priority, hasRate: hasRate || current?.hasRate || false, expiringSoon })
        } else if (expiringSoon && current) {
            current.expiringSoon = true
        }
    }

    // Count unique clients by their effective status
    const clients = Array.from(clientStatusMap.values())
    const membersWithRate = clients.filter(c => c.hasRate)

    return {
        active: clients.filter(c => c.status === 'Active').length,
        suspended: clients.filter(c => c.status === 'Suspended').length,
        terminated: clients.filter(c => c.status === 'Terminated').length,
        declined: clients.filter(c => c.status === 'Declined').length,
        expired: clients.filter(c => c.status === 'Expired').length,
        expiringSoon: clients.filter(c => c.expiringSoon).length,
        total: membersWithRate.length,
    }
}

/**
 * Get risk metrics
 */
export async function getRiskMetrics(): Promise<RiskMetrics> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { declinedCount: 0, atRiskCount: 0, expiringNext30Days: 0, unreconciledSettlements: 0, unreconciledValue: 0 }

    const [members, memberships, settlements] = await Promise.all([
        supabase.from("mb_members").select("membership_status").eq("user_id", user.id),
        supabase.from("mb_memberships").select("at_risk, expiring_soon").eq("user_id", user.id),
        supabase.from("mb_settlements").select("mb_net").eq("user_id", user.id).eq("reconciled", false),
    ])

    return {
        declinedCount: (members.data || []).filter(m => m.membership_status === "Declined").length,
        atRiskCount: (memberships.data || []).filter(m => m.at_risk).length,
        expiringNext30Days: (memberships.data || []).filter(m => m.expiring_soon).length,
        unreconciledSettlements: (settlements.data || []).length,
        unreconciledValue: round((settlements.data || []).reduce((s, t) => s + (t.mb_net || 0), 0)),
    }
}

/**
 * Get full enrichment dashboard data
 */
export async function getEnrichmentDashboardData(
    daysBack: number = 30
): Promise<EnrichmentDashboardData> {
    const [revenue, memberships, risks] = await Promise.all([
        getRevenueBreakdown(daysBack),
        getMembershipSnapshot(),
        getRiskMetrics(),
    ])

    return { revenue, memberships, risks, lastSynced: new Date().toISOString() }
}

/**
 * Analyze voided transactions to check for repeat customers
 * Now includes client names and contact info for recovery outreach
 */
export async function analyzeVoidedTransactions(): Promise<{
    totalVoided: number
    uniqueClients: number
    repeatOffenders: {
        clientId: string
        name: string
        email: string
        retryAttempts: number
        uniqueMonthsFailed: number
        estimatedLoss: number
    }[]
    statusBreakdown: Record<string, number>
    summary: {
        totalEstimatedLoss: number
        avgFailuresPerClient: number
    }
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return {
        totalVoided: 0,
        uniqueClients: 0,
        repeatOffenders: [],
        statusBreakdown: {},
        summary: { totalEstimatedLoss: 0, avgFailuresPerClient: 0 }
    }

    // Get all transactions (include date for month grouping)
    const { data: transactions } = await supabase
        .from("mb_transactions")
        .select("mb_client_id, status, description, transaction_date")
        .eq("user_id", user.id)

    // Get all members for name lookup (with pagination to avoid 1000 row limit)
    const allMembers: any[] = []
    let memberOffset = 0
    const memberLimit = 1000

    while (true) {
        const { data: memberBatch } = await supabase
            .from("mb_members")
            .select("mb_client_id, first_name, last_name, email, monthly_rate")
            .eq("user_id", user.id)
            .range(memberOffset, memberOffset + memberLimit - 1)

        if (!memberBatch || memberBatch.length === 0) break
        allMembers.push(...memberBatch)
        if (memberBatch.length < memberLimit) break
        memberOffset += memberLimit
    }

    if (!transactions) return {
        totalVoided: 0,
        uniqueClients: 0,
        repeatOffenders: [],
        statusBreakdown: {},
        summary: { totalEstimatedLoss: 0, avgFailuresPerClient: 0 }
    }

    // Create member lookup map
    const memberMap = new Map<string, { name: string; email: string; rate: number }>()
    for (const m of allMembers) {
        memberMap.set(m.mb_client_id, {
            name: `${m.first_name || ''} ${m.last_name || ''}`.trim() || 'Unknown',
            email: m.email || '',
            rate: m.monthly_rate || 0
        })
    }

    // Status breakdown
    const statusBreakdown: Record<string, number> = {}
    for (const tx of transactions) {
        const s = tx.status || 'Unknown'
        statusBreakdown[s] = (statusBreakdown[s] || 0) + 1
    }

    // Filter voided transactions
    const voided = transactions.filter(tx =>
        tx.status?.toLowerCase().includes('void') || tx.status?.toLowerCase().includes('credit')
    )

    // Group by client AND month (to count unique failed months, not retries)
    const clientMap = new Map<string, {
        totalRetries: number
        uniqueMonths: Set<string>
    }>()

    for (const tx of voided) {
        const clientId = tx.mb_client_id || 'Unknown'
        const txDate = tx.transaction_date ? new Date(tx.transaction_date) : new Date()
        const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`

        const current = clientMap.get(clientId) || { totalRetries: 0, uniqueMonths: new Set() }
        current.totalRetries += 1
        current.uniqueMonths.add(monthKey)
        clientMap.set(clientId, current)
    }

    // Find client IDs not in our local database
    const unknownClientIds = Array.from(clientMap.keys())
        .filter(id => id !== 'Unknown' && !memberMap.has(id))

    // Fetch missing clients from Mindbody API (batch of 20 max per request)
    if (unknownClientIds.length > 0) {
        try {
            const { MindbodyClient } = await import('@/lib/integrations/mindbody/client')
            const client = new MindbodyClient()

            // Fetch in batches of 20
            for (let i = 0; i < unknownClientIds.length; i += 20) {
                const batch = unknownClientIds.slice(i, i + 20)
                const response = await client.getClients(batch)
                const clients = response.Clients || []

                for (const c of clients) {
                    const id = c.Id?.toString()
                    if (id) {
                        memberMap.set(id, {
                            name: `${c.FirstName || ''} ${c.LastName || ''}`.trim() || 'Unknown',
                            email: c.Email || '',
                            rate: 70 // Default rate for unknown members
                        })
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching unknown clients:', error)
        }
    }

    // Build repeat offenders with names (now includes API-fetched clients)
    // Use uniqueMonths for accurate loss, not totalRetries
    const repeatOffenders = Array.from(clientMap.entries())
        .filter(([_, data]) => data.uniqueMonths.size > 0) // At least 1 failed month
        .map(([clientId, data]) => {
            const member = memberMap.get(clientId) || { name: 'Unknown', email: '', rate: 70 }
            const uniqueMonthsFailed = data.uniqueMonths.size
            return {
                clientId,
                name: member.name,
                email: member.email,
                retryAttempts: data.totalRetries,
                uniqueMonthsFailed,
                estimatedLoss: uniqueMonthsFailed * member.rate
            }
        })
        .sort((a, b) => b.retryAttempts - a.retryAttempts) // Most retries first = needs most follow-up
        .slice(0, 30) // Top 30

    // Calculate summary
    const totalEstimatedLoss = repeatOffenders.reduce((sum, r) => sum + r.estimatedLoss, 0)
    const avgFailuresPerClient = clientMap.size > 0 ? voided.length / clientMap.size : 0

    return {
        totalVoided: voided.length,
        uniqueClients: clientMap.size,
        repeatOffenders,
        statusBreakdown,
        summary: {
            totalEstimatedLoss: Math.round(totalEstimatedLoss),
            avgFailuresPerClient: Math.round(avgFailuresPerClient * 10) / 10
        }
    }
}

/**
 * Debug function to check if a specific Client ID exists and compare formats
 */
export async function debugClientIdLookup(clientId: string): Promise<{
    inMembers: boolean
    inTransactions: boolean
    memberRecord: any
    transactionSample: any
    allMemberIds: string[]
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { inMembers: false, inTransactions: false, memberRecord: null, transactionSample: null, allMemberIds: [] }

    // Check in members
    const { data: memberRecord } = await supabase
        .from("mb_members")
        .select("mb_client_id, first_name, last_name, email")
        .eq("user_id", user.id)
        .eq("mb_client_id", clientId)
        .single()

    // Check in transactions
    const { data: txRecord } = await supabase
        .from("mb_transactions")
        .select("mb_client_id, status, description")
        .eq("user_id", user.id)
        .eq("mb_client_id", clientId)
        .limit(1)
        .single()

    // Get sample of all member IDs to compare format
    const { data: sampleMembers } = await supabase
        .from("mb_members")
        .select("mb_client_id")
        .eq("user_id", user.id)
        .limit(10)

    return {
        inMembers: !!memberRecord,
        inTransactions: !!txRecord,
        memberRecord,
        transactionSample: txRecord,
        allMemberIds: (sampleMembers || []).map(m => m.mb_client_id)
    }
}

// Helper
function round(n: number): number {
    return Math.round(n * 100) / 100
}
