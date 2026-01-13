"use server"

import { createClient } from "@/lib/supabase/server"
import { MindbodyClient } from "@/lib/integrations/mindbody/client"

export type MemberStatus = 'Suspended' | 'Declined' | 'Active' | 'Inactive'

interface ClientStatus {
    clientId: string
    status: MemberStatus
    name?: string
    email?: string
    monthlyRate?: number
}

/**
 * Calculate true member status using Priority Hierarchy:
 * 1. Suspended (highest) - Contract has AutopayStatus = "Suspended"
 * 2. Declined - Client has voided/declined transaction in last 31 days
 * 3. Active - Has contract with AutopayStatus = "Active" and no TerminationDate
 * 4. Inactive (lowest) - No active contract or all terminated
 */
function calculateTrueMemberStatus(
    clientContracts: any[],
    recentDeclines: Set<string>,
    clientId: string
): MemberStatus {
    // 1. Highest Priority: Suspension
    const hasSuspended = clientContracts.some(c => c.AutopayStatus === 'Suspended')
    if (hasSuspended) return 'Suspended'

    // 2. Second Priority: Declined Payment
    if (recentDeclines.has(clientId)) return 'Declined'

    // 3. Third Priority: Active Contract
    // Active = AutopayStatus is "Active" AND not terminated
    const hasActive = clientContracts.some(c =>
        c.AutopayStatus === 'Active' && !c.TerminationDate
    )
    if (hasActive) return 'Active'

    return 'Inactive'
}

/**
 * Calculate all member statuses using contracts and transaction data
 * Returns a Map of clientId -> MemberStatus
 */
export async function calculateAllMemberStatuses(): Promise<Map<string, ClientStatus>> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const mbClient = new MindbodyClient()

    // 1. Get paying members (monthly_rate > 0)
    // Note: Checking all 1000 members causes API rate limits
    const { data: members } = await supabase
        .from('mb_members')
        .select('mb_client_id, first_name, last_name, email, monthly_rate, membership_status')
        .eq('user_id', user.id)
        .gt('monthly_rate', 0)

    if (!members || members.length === 0) {
        console.log('[member-status] No paying members found')
        return new Map()
    }

    const clientIds = members.map(m => m.mb_client_id).filter(Boolean) as string[]
    console.log(`[member-status] Fetching contracts for ${clientIds.length} paying members...`)


    // 2. Fetch contracts for all clients in batches (10 at a time)
    const allContracts = await mbClient.getAllClientContracts(clientIds)
    console.log(`[member-status] Fetched ${allContracts.length} total contracts`)

    // 3. Fetch declined/voided transactions in last 31 days
    // Status can be "Voided", "Approved (Voided)", etc.
    const thirtyOneDaysAgo = new Date()
    thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31)

    const { data: voidedTx } = await supabase
        .from('mb_transactions')
        .select('mb_client_id, status')
        .eq('user_id', user.id)
        .ilike('status', '%void%')
        .gte('transaction_date', thirtyOneDaysAgo.toISOString())

    const declinedClientIds = new Set<string>()
    for (const tx of voidedTx || []) {
        if (tx.mb_client_id) declinedClientIds.add(tx.mb_client_id)
    }
    console.log(`[member-status] Found ${declinedClientIds.size} clients with declined/voided payments`)

    // 4. Group contracts by PayerClientId (this is the client ID field in contracts)
    const contractsByClient = new Map<string, any[]>()
    for (const contract of allContracts) {
        // API returns PayerClientId, not ClientId
        const clientId = (contract.PayerClientId || contract.ClientId)?.toString()
        if (!clientId) continue

        if (!contractsByClient.has(clientId)) {
            contractsByClient.set(clientId, [])
        }
        contractsByClient.get(clientId)!.push(contract)
    }

    // 5. Calculate status for each paying member
    const clientStatuses = new Map<string, ClientStatus>()

    for (const m of members) {
        const clientId = m.mb_client_id
        if (!clientId) continue

        const contracts = contractsByClient.get(clientId) || []
        const status = calculateTrueMemberStatus(contracts, declinedClientIds, clientId)

        clientStatuses.set(clientId, {
            clientId,
            status,
            name: `${m.first_name || ''} ${m.last_name || ''}`.trim(),
            email: m.email,
            monthlyRate: m.monthly_rate || 0
        })
    }

    // Log summary
    const statusCounts = { Active: 0, Suspended: 0, Declined: 0, Inactive: 0 }
    for (const client of clientStatuses.values()) {
        statusCounts[client.status]++
    }
    console.log(`[member-status] Status breakdown: Active=${statusCounts.Active}, Suspended=${statusCounts.Suspended}, Declined=${statusCounts.Declined}, Inactive=${statusCounts.Inactive}`)

    return clientStatuses
}

/**
 * Get member status summary counts
 */
export async function getMemberStatusSummary(): Promise<{
    active: number
    suspended: number
    declined: number
    inactive: number
    total: number
    totalMRR: number
}> {
    const statuses = await calculateAllMemberStatuses()

    let active = 0
    let suspended = 0
    let declined = 0
    let inactive = 0
    let totalMRR = 0

    for (const client of statuses.values()) {
        switch (client.status) {
            case 'Active':
                active++
                totalMRR += client.monthlyRate || 0
                break
            case 'Suspended':
                suspended++
                break
            case 'Declined':
                declined++
                break
            case 'Inactive':
                inactive++
                break
        }
    }

    console.log(`[member-status] Summary: Active=${active}, Suspended=${suspended}, Declined=${declined}, Inactive=${inactive}`)

    return {
        active,
        suspended,
        declined,
        inactive,
        total: statuses.size,
        totalMRR
    }
}

/**
 * Sync member statuses to database (saves to mb_members.membership_status)
 * This makes the dashboard show accurate counts without hitting the API
 */
export async function syncMemberStatusesToDatabase(): Promise<{
    updated: number
    active: number
    suspended: number
    declined: number
    inactive: number
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    console.log('[member-status] Starting status sync to database...')

    // Calculate statuses using Contracts API
    const statuses = await calculateAllMemberStatuses()

    let updated = 0
    let active = 0
    let suspended = 0
    let declined = 0
    let inactive = 0

    // Update each member's status in the database
    for (const [clientId, client] of statuses) {
        const { error } = await supabase
            .from('mb_members')
            .update({ membership_status: client.status })
            .eq('user_id', user.id)
            .eq('mb_client_id', clientId)

        if (!error) {
            updated++
            switch (client.status) {
                case 'Active': active++; break
                case 'Suspended': suspended++; break
                case 'Declined': declined++; break
                case 'Inactive': inactive++; break
            }
        }
    }

    console.log(`[member-status] Updated ${updated} members in database`)
    console.log(`[member-status] Status breakdown: Active=${active}, Suspended=${suspended}, Declined=${declined}, Inactive=${inactive}`)

    return { updated, active, suspended, declined, inactive }
}

/**
 * Debug function to see raw contract API response
 */
export async function debugContractFetch(): Promise<any> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const mbClient = new MindbodyClient()

    // Get a few sample client IDs
    const { data: members } = await supabase
        .from('mb_members')
        .select('mb_client_id, first_name, last_name, monthly_rate')
        .eq('user_id', user.id)
        .gt('monthly_rate', 0)
        .limit(3)

    if (!members || members.length === 0) {
        return { error: 'No members found' }
    }

    const results: any[] = []
    for (const m of members) {
        try {
            const rawResponse = await mbClient.getClientContracts(m.mb_client_id)
            results.push({
                clientId: m.mb_client_id,
                name: `${m.first_name} ${m.last_name}`,
                monthlyRate: m.monthly_rate,
                rawResponse
            })
        } catch (e: any) {
            results.push({
                clientId: m.mb_client_id,
                name: `${m.first_name} ${m.last_name}`,
                error: e.message
            })
        }
    }

    return {
        sampleCount: results.length,
        samples: results
    }
}

/**
 * Debug: Find edge case members to explain discrepancy
 * Members with AutopayStatus = "Active" but TerminationDate set
 */
export async function debugActiveEdgeCases(): Promise<any> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const mbClient = new MindbodyClient()

    // Get ALL members, not just paying ones
    const { data: allMembers } = await supabase
        .from('mb_members')
        .select('mb_client_id, first_name, last_name, monthly_rate')
        .eq('user_id', user.id)

    // Get paying members
    const { data: payingMembers } = await supabase
        .from('mb_members')
        .select('mb_client_id, first_name, last_name, monthly_rate')
        .eq('user_id', user.id)
        .gt('monthly_rate', 0)
        .limit(50)

    if (!payingMembers) return { error: 'No members found' }

    const autopayStatusCounts: Record<string, number> = {}
    const activeWithTermination: any[] = []
    let activeCount = 0

    for (const m of payingMembers) {
        try {
            const response = await mbClient.getClientContracts(m.mb_client_id)
            const contracts = response.Contracts || []

            for (const c of contracts) {
                // Count all AutopayStatus values
                const status = c.AutopayStatus || 'null'
                autopayStatusCounts[status] = (autopayStatusCounts[status] || 0) + 1

                if (c.AutopayStatus === 'Active') {
                    activeCount++
                    if (c.TerminationDate) {
                        activeWithTermination.push({
                            clientId: m.mb_client_id,
                            name: `${m.first_name} ${m.last_name}`,
                            autopayStatus: c.AutopayStatus,
                            terminationDate: c.TerminationDate,
                            contractName: c.ContractName
                        })
                    }
                }
            }
        } catch (e) {
            // Skip errors
        }
    }

    // Count zero monthly_rate members
    const zeroRateCount = (allMembers || []).filter(m => !m.monthly_rate || m.monthly_rate === 0).length
    const payingCount = (allMembers || []).filter(m => m.monthly_rate && m.monthly_rate > 0).length

    // Check a sample of zero-rate members for active contracts
    const zeroRateMembers = (allMembers || [])
        .filter(m => !m.monthly_rate || m.monthly_rate === 0)
        .slice(0, 30)

    let zeroRateWithActiveContract = 0
    const zeroRateActiveExamples: any[] = []

    for (const m of zeroRateMembers) {
        try {
            const response = await mbClient.getClientContracts(m.mb_client_id)
            const contracts = response.Contracts || []

            const hasActive = contracts.some((c: any) => c.AutopayStatus === 'Active' && !c.TerminationDate)
            if (hasActive) {
                zeroRateWithActiveContract++
                zeroRateActiveExamples.push({
                    clientId: m.mb_client_id,
                    name: `${m.first_name} ${m.last_name}`,
                    monthlyRate: m.monthly_rate //should be 0
                })
            }
        } catch (e) {
            // Skip errors
        }
    }

    return {
        totalMembers: allMembers?.length || 0,
        zeroMonthlyRateMembers: zeroRateCount,
        payingMembers: payingCount,
        sampleSize: payingMembers.length,
        allAutopayStatusValues: autopayStatusCounts,
        activeContracts: activeCount,
        activeWithTerminationDate: activeWithTermination.length,
        zeroRateSampleSize: zeroRateMembers.length,
        zeroRateWithActiveContracts: zeroRateWithActiveContract,
        zeroRateActiveExamples,
        insight: zeroRateWithActiveContract > 0
            ? `FOUND IT! ${zeroRateWithActiveContract} members have monthly_rate=0 but active contracts. This explains the gap!`
            : 'The gap may be: (1) different date windows, or (2) Mindbody uses different criteria'
    }
}


