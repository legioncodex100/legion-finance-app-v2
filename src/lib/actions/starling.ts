"use server"

import { createClient } from "@/lib/supabase/server"
import { createStarlingClient, StarlingClient, StarlingTransaction } from "@/lib/starling/client"

export interface SyncResult {
    success: boolean
    synced: number
    skipped: number
    errors: string[]
    balance?: {
        cleared: number
        available: number
    }
    preview?: Array<{
        date: string
        party: string
        amount: number
        type: 'income' | 'expense'
        status: string
    }>
}

/**
 * Sync transactions from Starling Bank
 * @param fromDate - Start date (ISO string, optional - defaults to 30 days ago)
 * @param toDate - End date (ISO string, optional - defaults to today)
 * @param dryRun - If true, just test API without inserting to database
 */
export async function syncStarlingTransactions(fromDate?: string, toDate?: string, dryRun: boolean = false): Promise<SyncResult> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const errors: string[] = []
    const preview: SyncResult['preview'] = []
    let synced = 0
    let skipped = 0

    try {
        // Create Starling client
        const starling = createStarlingClient()

        // Get primary account
        const account = await starling.getPrimaryAccount()
        if (!account) {
            return { success: false, synced: 0, skipped: 0, errors: ['No Starling account found'] }
        }

        // Calculate date range
        const to = toDate ? new Date(toDate) : new Date()
        const from = fromDate ? new Date(fromDate) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)

        console.log(`[STARLING] Fetching transactions from ${from.toISOString()} to ${to.toISOString()}`)


        // Fetch main account transactions
        const mainTransactions = await starling.getTransactions(
            account.accountUid,
            account.defaultCategory,
            from.toISOString(),
            to.toISOString()
        )

        console.log(`[STARLING] Main account returned ${mainTransactions?.length || 0} transactions`)

        // Fetch transactions from all pots (savings goals)
        let potTransactions: StarlingTransaction[] = []
        try {
            const goalsResponse = await starling.getSavingsGoals(account.accountUid) as any
            const savingsGoals = goalsResponse?.savingsGoalList || goalsResponse?.savingsGoals || []
            console.log(`[STARLING] Found ${savingsGoals.length} savings goals/pots`)

            for (const goal of savingsGoals) {
                try {
                    const potTxns = await starling.getPotTransactions(
                        account.accountUid,
                        goal.savingsGoalUid,
                        from.toISOString(),
                        to.toISOString()
                    )
                    console.log(`[STARLING] Pot "${goal.name}" returned ${potTxns?.length || 0} transactions`)
                    // Tag pot transactions with the pot name
                    potTransactions = potTransactions.concat(potTxns || [])
                } catch (e) {
                    console.log(`[STARLING] Could not fetch pot "${goal.name}" transactions:`, e)
                }
            }
        } catch (e) {
            console.log('[STARLING] Could not fetch savings goals:', e)
        }

        // Combine all transactions
        const transactions = [...(mainTransactions || []), ...potTransactions]
        console.log(`[STARLING] Total combined: ${transactions.length} (main: ${mainTransactions?.length || 0}, pots: ${potTransactions.length})`)

        // Log unique statuses to understand what we're getting
        const statusCounts: Record<string, number> = {}
        for (const tx of transactions || []) {
            statusCounts[tx.status] = (statusCounts[tx.status] || 0) + 1
        }
        console.log(`[STARLING] Status breakdown:`, JSON.stringify(statusCounts))

        if (transactions?.length > 0) {
            console.log(`[STARLING] First transaction sample:`, JSON.stringify(transactions[0]))
        }

        // Get total balance (including savings pots)
        const totalBalance = await starling.getTotalBalance(account.accountUid)

        // Filter: only SETTLED, exclude all internal transfers (pot-to-main moves)
        // Note: Payments FROM pots to external vendors appear in pot category feeds, not main feed
        const validTransactions = transactions.filter(tx => {
            const isValid = tx.status === 'SETTLED' && tx.source !== 'INTERNAL_TRANSFER'
            if (!isValid) {
                console.log(`[STARLING] Filtered out: ${tx.counterPartyName} - status=${tx.status}, source=${tx.source}`)
            }
            return isValid
        })
        console.log(`[STARLING] ${transactions.length} total, ${validTransactions.length} valid after filters`)

        // Get all existing external_ids in one query (batch deduplication)
        const externalIds = validTransactions.map(tx => tx.feedItemUid)
        const { data: existingTx } = await supabase
            .from('transactions')
            .select('external_id')
            .in('external_id', externalIds)

        const existingIds = new Set(existingTx?.map(t => t.external_id) || [])
        console.log(`[STARLING] ${existingIds.size} already in database`)

        // Prepare transactions for insert
        const toInsert: any[] = []

        for (const tx of validTransactions) {
            // Skip if already exists
            if (existingIds.has(tx.feedItemUid)) {
                skipped++
                continue
            }

            // Validate amount
            if (!tx.amount || typeof tx.amount.minorUnits !== 'number') {
                errors.push(`Invalid amount: ${tx.feedItemUid}`)
                continue
            }

            const amountMajor = StarlingClient.toMajorUnits(tx.amount.minorUnits)
            const isIncome = tx.direction === 'IN'
            const finalAmount = isIncome ? Math.abs(amountMajor) : -Math.abs(amountMajor)

            // Dry run - collect preview
            if (dryRun) {
                preview!.push({
                    date: tx.transactionTime.split('T')[0],
                    party: tx.counterPartyName || 'Unknown',
                    amount: finalAmount,
                    type: isIncome ? 'income' : 'expense',
                    status: `${tx.source} | ${tx.spendingCategory || 'Uncategorized'}`
                })
                synced++
                continue
            }

            // Add to batch
            toInsert.push({
                user_id: user.id,
                transaction_date: tx.transactionTime.split('T')[0],
                description: tx.reference || tx.counterPartyName || 'Starling Transaction',
                raw_party: tx.counterPartyName || 'Unknown',
                amount: finalAmount,
                type: isIncome ? 'income' : 'expense',
                external_id: tx.feedItemUid,
                source: 'starling',
                import_hash: `starling-${tx.feedItemUid}`,
                notes: null,
                confirmed: false,
                reconciliation_status: 'unreconciled',
                ai_suggested: 'UNIDENTIFIED',
                bank_category: tx.spendingCategory || null,
            })
        }

        // Batch insert all new transactions
        if (!dryRun && toInsert.length > 0) {
            console.log(`[STARLING] Batch inserting ${toInsert.length} transactions...`)
            const { error: insertError, data: inserted } = await supabase
                .from('transactions')
                .insert(toInsert)
                .select('id')

            if (insertError) {
                errors.push(`Batch insert failed: ${insertError.message}`)
            } else {
                synced = inserted?.length || toInsert.length
                console.log(`[STARLING] Successfully inserted ${synced} transactions`)
            }
        }

        return {
            success: true,
            synced,
            skipped,
            errors,
            balance: {
                cleared: totalBalance,
                available: totalBalance,
            },
            preview: dryRun ? preview : undefined
        }
    } catch (error) {
        return {
            success: false,
            synced,
            skipped,
            errors: [error instanceof Error ? error.message : 'Unknown error']
        }
    }
}

/**
 * Get current Starling account balance
 */
export async function getStarlingBalance(): Promise<{ cleared: number; available: number } | null> {
    try {
        const starling = createStarlingClient()
        const account = await starling.getPrimaryAccount()

        if (!account) return null

        const balance = await starling.getBalance(account.accountUid)

        return {
            cleared: StarlingClient.toMajorUnits(balance.clearedBalance.minorUnits),
            available: StarlingClient.toMajorUnits(balance.availableToSpend.minorUnits),
        }
    } catch {
        return null
    }
}

/**
 * Check if Starling integration is configured
 */
export async function isStarlingConfigured(): Promise<boolean> {
    return !!process.env.STARLING_ACCESS_TOKEN
}
