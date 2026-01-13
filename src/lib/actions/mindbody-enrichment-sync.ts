"use server"

import { createClient } from "@/lib/supabase/server"
import { MindbodyClient } from "@/lib/integrations/mindbody/client"
import { calculateMerchantFee, calculateBatchFees } from "@/lib/integrations/mindbody/fee-calculator"

/**
 * Sync transactions from Mindbody with UK merchant fee calculation
 * This populates mb_transactions table
 * Default 60 days to cover at least 2 full months
 */
export async function syncEnrichmentTransactions(daysBack: number = 60): Promise<{
    synced: number
    errors: string[]
    totalFees: number
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { synced: 0, errors: ['Not authenticated'], totalFees: 0 }
    }

    const client = new MindbodyClient()
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysBack)

    const errors: string[] = []
    let synced = 0
    let totalFees = 0

    try {
        // Fetch transactions from Mindbody
        const transactions = await client.getAllTransactions(startDate, endDate)

        // Prepare records with fee calculation
        // Only count fees for successful transactions (Captured/Completed)
        const records = transactions.map((tx: any) => {
            const amount = tx.NetAmount || tx.Amount || 0
            const paymentType = tx.PaymentType || tx.Method || ''
            const entryMethod = tx.EntryMethod || ''
            const status = tx.Status || tx.TransactionStatus || 'Unknown'

            // Only calculate fees for successful transactions
            // Exclude: "Approved (Voided)", "Credit", "Declined"
            const statusLower = status.toLowerCase()
            const isVoided = statusLower.includes('void')
            const isCredit = statusLower.includes('credit') || statusLower.includes('refund')
            const isApproved = statusLower === 'approved' || statusLower === 'captured' || statusLower === 'completed' || statusLower === 'settled'
            const isSuccessful = isApproved && !isVoided && !isCredit

            const feeCalc = isSuccessful
                ? calculateMerchantFee(amount, paymentType, entryMethod)
                : { fee: 0, rate: 0, fixedFee: 0 }

            if (isSuccessful) {
                totalFees += feeCalc.fee
            }

            return {
                user_id: user.id,
                mb_client_id: tx.ClientId?.toString() || null,
                mb_sale_id: tx.SaleId?.toString() || tx.Id?.toString() || '',
                mb_transaction_id: tx.TransactionId?.toString() || tx.Id?.toString() || '',

                // Revenue breakdown (only for successful)
                gross_amount: isSuccessful ? (tx.GrossAmount || tx.Amount || 0) : 0,
                tax_amount: isSuccessful ? (tx.TaxAmount || 0) : 0,
                tip_amount: isSuccessful ? (tx.TipAmount || 0) : 0,
                net_amount: isSuccessful ? amount : 0,

                // Payment details
                payment_type: paymentType,
                entry_method: entryMethod,
                settlement_id: tx.SettlementId?.toString() || null,

                // Fee calculation
                calculated_fee: feeCalc.fee,
                fee_rate: feeCalc.rate,
                fixed_fee: feeCalc.fixedFee,

                // Status
                status: status,
                decline_reason: tx.DeclineReason || null,
                description: tx.Description || tx.ItemName || null,
                item_type: determineItemType(tx),

                // Mindbody API returns TransactionTime for the actual transaction date
                transaction_date: tx.TransactionTime || tx.SaleDateTime || tx.TransactionDate || new Date().toISOString(),
                settlement_date: tx.SettlementDate || null,
                synced_at: new Date().toISOString(),
            }
        })

        // Batch upsert in chunks of 500
        const batchSize = 500
        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize)
            const { error } = await supabase.from('mb_transactions').upsert(batch, {
                onConflict: 'user_id,mb_transaction_id'
            })
            if (error) {
                errors.push(`Batch ${i}: ${error.message}`)
            } else {
                synced += batch.length
            }
        }

    } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Transaction sync failed')
    }

    return { synced, errors, totalFees: Math.round(totalFees * 100) / 100 }
}

/**
 * Sync memberships from existing mb_members data
 * Uses the already-synced member data to populate mb_memberships
 */
export async function syncEnrichmentMemberships(): Promise<{
    synced: number
    errors: string[]
    statusBreakdown: { active: number; suspended: number; terminated: number }
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { synced: 0, errors: ['Not authenticated'], statusBreakdown: { active: 0, suspended: 0, terminated: 0 } }
    }

    const errors: string[] = []
    let synced = 0
    const statusBreakdown = { active: 0, suspended: 0, terminated: 0 }

    try {
        // Fetch ALL members with pagination (Supabase default limit is 1000)
        const allMembers: any[] = []
        let offset = 0
        const fetchBatchSize = 1000

        while (true) {
            const { data: batch, error: fetchError } = await supabase
                .from('mb_members')
                .select('*')
                .eq('user_id', user.id)
                .range(offset, offset + fetchBatchSize - 1)

            if (fetchError) {
                errors.push(fetchError.message)
                break
            }

            if (!batch || batch.length === 0) break

            allMembers.push(...batch)
            if (batch.length < fetchBatchSize) break // Last batch
            offset += fetchBatchSize
        }

        const members = allMembers

        if (members.length === 0) {
            errors.push('No members found. Run main sync first.')
            return { synced: 0, errors, statusBreakdown }
        }

        const now = new Date()
        const thirtyDaysFromNow = new Date()
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

        // Transform members into memberships
        const records = members
            .filter(m => m.membership_name) // Only members with memberships
            .map((m: any) => {
                const status = m.membership_status || 'Active'
                const endDate = m.contract_end_date ? new Date(m.contract_end_date) : null
                const expiringWithin30Days = endDate ? endDate <= thirtyDaysFromNow : false

                // Count statuses
                if (status === 'Active') statusBreakdown.active++
                else if (status === 'Suspended') statusBreakdown.suspended++
                else if (status === 'Terminated' || status === 'Expired') statusBreakdown.terminated++

                return {
                    user_id: user.id,
                    mb_client_id: m.mb_client_id,
                    mb_membership_id: `${m.mb_client_id}-${m.membership_name}`.slice(0, 100),

                    membership_name: m.membership_name || '',
                    program_name: null,
                    status: status === 'Expired' ? 'Terminated' : status,

                    start_date: m.first_purchase_date || null,
                    end_date: m.contract_end_date || null,
                    termination_date: status === 'Terminated' ? new Date().toISOString() : null,

                    autopay_enabled: m.monthly_rate > 0,
                    payment_amount: m.monthly_rate || 0,
                    next_payment_date: m.next_payment_date || null,

                    expiring_soon: expiringWithin30Days,
                    at_risk: expiringWithin30Days || status === 'Suspended' || status === 'Declined',

                    synced_at: new Date().toISOString(),
                }
            })

        // Batch upsert
        const batchSize = 500
        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize)
            const { error } = await supabase.from('mb_memberships').upsert(batch, {
                onConflict: 'user_id,mb_membership_id'
            })
            if (error) {
                errors.push(`Batch ${i}: ${error.message}`)
            } else {
                synced += batch.length
            }
        }

    } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Membership sync failed')
    }

    return { synced, errors, statusBreakdown }
}

/**
 * Aggregate transactions into settlements for bank matching
 * Groups by settlement_id and calculates totals
 */
export async function syncEnrichmentSettlements(): Promise<{
    synced: number
    errors: string[]
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { synced: 0, errors: ['Not authenticated'] }
    }

    const errors: string[] = []
    let synced = 0

    try {
        // Get all transactions grouped by settlement_id
        const { data: transactions, error: fetchError } = await supabase
            .from('mb_transactions')
            .select('*')
            .eq('user_id', user.id)
            .not('settlement_id', 'is', null)
            .order('settlement_date', { ascending: false })

        if (fetchError) {
            errors.push(fetchError.message)
            return { synced: 0, errors }
        }

        // Group by settlement_id
        const settlementMap = new Map<string, any[]>()
        for (const tx of (transactions || [])) {
            const sid = tx.settlement_id
            if (!settlementMap.has(sid)) {
                settlementMap.set(sid, [])
            }
            settlementMap.get(sid)!.push(tx)
        }

        // Create settlement records
        const records = []
        for (const [settlementId, txs] of settlementMap) {
            const firstTx = txs[0]

            const mbGross = txs.reduce((sum, tx) => sum + (tx.gross_amount || 0), 0)
            const mbTax = txs.reduce((sum, tx) => sum + (tx.tax_amount || 0), 0)
            const mbTips = txs.reduce((sum, tx) => sum + (tx.tip_amount || 0), 0)
            const mbFees = txs.reduce((sum, tx) => sum + (tx.calculated_fee || 0), 0)
            const mbNet = mbGross - mbFees

            records.push({
                user_id: user.id,
                settlement_id: settlementId,
                settlement_date: firstTx.settlement_date,

                mb_gross: Math.round(mbGross * 100) / 100,
                mb_tax: Math.round(mbTax * 100) / 100,
                mb_tips: Math.round(mbTips * 100) / 100,
                mb_fees: Math.round(mbFees * 100) / 100,
                mb_net: Math.round(mbNet * 100) / 100,
                transaction_count: txs.length,

                synced_at: new Date().toISOString(),
            })
        }

        // Upsert settlements
        if (records.length > 0) {
            const { error } = await supabase.from('mb_settlements').upsert(records, {
                onConflict: 'user_id,settlement_id'
            })
            if (error) {
                errors.push(error.message)
            } else {
                synced = records.length
            }
        }

    } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Settlement sync failed')
    }

    return { synced, errors }
}

/**
 * Run full enrichment sync
 */
export async function runEnrichmentSync(daysBack: number = 30): Promise<{
    transactions: { synced: number; errors: string[]; totalFees: number }
    memberships: { synced: number; errors: string[]; statusBreakdown: any }
    settlements: { synced: number; errors: string[] }
}> {
    const [transactions, memberships, settlements] = await Promise.all([
        syncEnrichmentTransactions(daysBack),
        syncEnrichmentMemberships(),
        syncEnrichmentSettlements(),
    ])

    return { transactions, memberships, settlements }
}

/**
 * Clear all transactions and re-sync fresh (use when data is corrupted)
 * Default 60 days to cover at least 2 full months
 */
export async function clearAndResyncTransactions(daysBack: number = 60): Promise<{
    deleted: number
    synced: number
    errors: string[]
    totalFees: number
    statusBreakdown?: Record<string, number>
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { deleted: 0, synced: 0, errors: ['Not authenticated'], totalFees: 0 }
    }

    // Count before delete
    const { count: beforeCount } = await supabase
        .from('mb_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

    // Delete all existing transactions for this user
    const { error: deleteError } = await supabase
        .from('mb_transactions')
        .delete()
        .eq('user_id', user.id)

    if (deleteError) {
        return { deleted: 0, synced: 0, errors: [deleteError.message], totalFees: 0 }
    }

    // Now sync fresh
    const result = await syncEnrichmentTransactions(daysBack)

    // Get status breakdown from synced data
    const { data: statusData } = await supabase
        .from('mb_transactions')
        .select('status')
        .eq('user_id', user.id)

    const statusBreakdown: Record<string, number> = {}
    for (const tx of (statusData || [])) {
        const s = tx.status || 'Unknown'
        statusBreakdown[s] = (statusBreakdown[s] || 0) + 1
    }

    return {
        deleted: beforeCount || 0,
        synced: result.synced,
        errors: result.errors,
        totalFees: result.totalFees,
        statusBreakdown
    }
}

// Helper function to determine item type
function determineItemType(tx: any): string {
    const description = (tx.Description || tx.ItemName || '').toLowerCase()

    if (description.includes('membership') || description.includes('unlimited')) {
        return 'Membership'
    }
    if (description.includes('pack') || description.includes('class')) {
        return 'Pack'
    }
    if (description.includes('drop') || description.includes('single')) {
        return 'DropIn'
    }
    return 'Other'
}
