"use server"

import { createClient } from "@/lib/supabase/server"

export interface DuplicateGroup {
    transaction_date: string
    amount: string
    description: string
    raw_party: string | null
    source: string | null
    count: number
    transaction_ids: string[]
    keep_id: string
    delete_ids: string[]
}

export interface DuplicateCheckResult {
    success: boolean
    duplicateGroups: DuplicateGroup[]
    totalDuplicateRows: number
    totalGroups: number
    error?: string
}

export interface DuplicateCleanupResult {
    success: boolean
    deletedCount: number
    deletedIds: string[]
    error?: string
}

/**
 * Check for duplicate transactions in the database
 * Duplicates are identified by matching: transaction_date, amount, description, raw_party, source
 * For each group, we identify which transaction to KEEP (highest enrichment score)
 */
export async function checkForDuplicates(): Promise<DuplicateCheckResult> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    try {
        // Use raw SQL for complex duplicate detection with enrichment scoring
        const { data, error } = await supabase.rpc('check_duplicate_transactions')

        if (error) {
            // If RPC doesn't exist, fall back to client-side detection
            return await checkForDuplicatesFallback(supabase, user.id)
        }

        const groups = data as DuplicateGroup[]
        const totalDuplicateRows = groups.reduce((sum, g) => sum + g.delete_ids.length, 0)

        return {
            success: true,
            duplicateGroups: groups,
            totalDuplicateRows,
            totalGroups: groups.length
        }
    } catch (error) {
        return await checkForDuplicatesFallback(supabase, user.id)
    }
}

/**
 * Fallback duplicate detection using client-side logic
 */
async function checkForDuplicatesFallback(supabase: any, userId: string): Promise<DuplicateCheckResult> {
    try {
        // Fetch all manual transactions (external_id is null)
        const { data: transactions, error } = await supabase
            .from('transactions')
            .select('id, transaction_date, amount, description, raw_party, source, category_id, vendor_id, staff_id, linked_payable_id, bill_id, debt_id, confirmed, reconciliation_status, created_at')
            .eq('user_id', userId)
            .is('external_id', null)
            .order('transaction_date', { ascending: false })

        if (error) throw error

        // Group by key fields
        const groups = new Map<string, typeof transactions>()

        for (const tx of transactions || []) {
            const key = `${tx.transaction_date}|${tx.amount}|${tx.description}|${tx.raw_party || ''}|${tx.source || ''}`
            if (!groups.has(key)) {
                groups.set(key, [])
            }
            groups.get(key)!.push(tx)
        }

        // Filter to only groups with duplicates and calculate enrichment scores
        const duplicateGroups: DuplicateGroup[] = []

        for (const [key, txs] of groups) {
            if (txs.length <= 1) continue

            // Calculate enrichment score for each transaction
            const scored = txs.map((tx: any) => ({
                ...tx,
                score: calculateEnrichmentScore(tx)
            }))

            // Sort by score (highest first), then by created_at (oldest first)
            scored.sort((a: any, b: any) => {
                if (b.score !== a.score) return b.score - a.score
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            })

            const keepId = scored[0].id
            const deleteIds = scored.slice(1).map((tx: any) => tx.id)

            const [date, amount, description, rawParty, source] = key.split('|')

            duplicateGroups.push({
                transaction_date: date,
                amount,
                description,
                raw_party: rawParty || null,
                source: source || null,
                count: txs.length,
                transaction_ids: scored.map((tx: any) => tx.id),
                keep_id: keepId,
                delete_ids: deleteIds
            })
        }

        // Sort by count (most duplicates first)
        duplicateGroups.sort((a, b) => b.count - a.count)

        const totalDuplicateRows = duplicateGroups.reduce((sum, g) => sum + g.delete_ids.length, 0)

        return {
            success: true,
            duplicateGroups,
            totalDuplicateRows,
            totalGroups: duplicateGroups.length
        }
    } catch (error) {
        return {
            success: false,
            duplicateGroups: [],
            totalDuplicateRows: 0,
            totalGroups: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

/**
 * Calculate enrichment score for a transaction
 * Higher score = more valuable/enriched = should be kept
 */
function calculateEnrichmentScore(tx: any): number {
    let score = 0

    if (tx.category_id) score += 1
    if (tx.vendor_id) score += 1
    if (tx.staff_id) score += 1
    if (tx.linked_payable_id) score += 2
    if (tx.bill_id) score += 2
    if (tx.debt_id) score += 2
    if (tx.confirmed === true) score += 3
    if (tx.reconciliation_status === 'reconciled') score += 3

    return score
}

/**
 * Clean up duplicate transactions by deleting extras
 * Keeps the most enriched version of each duplicate group
 */
export async function cleanupDuplicates(idsToDelete?: string[]): Promise<DuplicateCleanupResult> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    try {
        let deleteIds: string[] = []

        if (idsToDelete && idsToDelete.length > 0) {
            // Use provided IDs
            deleteIds = idsToDelete
        } else {
            // Get all duplicate IDs from check
            const checkResult = await checkForDuplicates()
            if (!checkResult.success) {
                return {
                    success: false,
                    deletedCount: 0,
                    deletedIds: [],
                    error: checkResult.error
                }
            }
            deleteIds = checkResult.duplicateGroups.flatMap(g => g.delete_ids)
        }

        if (deleteIds.length === 0) {
            return {
                success: true,
                deletedCount: 0,
                deletedIds: [],
            }
        }

        // Check for linked payable_transactions before deletion
        const { data: linkedPayables } = await supabase
            .from('payable_transactions')
            .select('transaction_id')
            .in('transaction_id', deleteIds)

        if (linkedPayables && linkedPayables.length > 0) {
            // Remove linked transactions from delete list
            const linkedIds = new Set(linkedPayables.map((p: any) => p.transaction_id))
            deleteIds = deleteIds.filter(id => !linkedIds.has(id))
        }

        // Delete the duplicates
        const { data: deleted, error } = await supabase
            .from('transactions')
            .delete()
            .in('id', deleteIds)
            .eq('user_id', user.id)
            .select('id')

        if (error) throw error

        return {
            success: true,
            deletedCount: deleted?.length || 0,
            deletedIds: deleted?.map((d: any) => d.id) || []
        }
    } catch (error) {
        return {
            success: false,
            deletedCount: 0,
            deletedIds: [],
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

/**
 * Check for Starling sync duplicates (by external_id)
 */
export async function checkForExternalIdDuplicates(): Promise<{
    success: boolean
    count: number
    duplicates: Array<{ external_id: string; count: number; ids: string[] }>
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    try {
        const { data: transactions } = await supabase
            .from('transactions')
            .select('id, external_id')
            .eq('user_id', user.id)
            .not('external_id', 'is', null)

        // Group by external_id
        const groups = new Map<string, string[]>()
        for (const tx of transactions || []) {
            if (!groups.has(tx.external_id)) {
                groups.set(tx.external_id, [])
            }
            groups.get(tx.external_id)!.push(tx.id)
        }

        const duplicates = Array.from(groups.entries())
            .filter(([_, ids]) => ids.length > 1)
            .map(([external_id, ids]) => ({
                external_id,
                count: ids.length,
                ids
            }))

        return {
            success: true,
            count: duplicates.length,
            duplicates
        }
    } catch (error) {
        return {
            success: false,
            count: 0,
            duplicates: []
        }
    }
}

/**
 * Check for import_hash duplicates (re-imports)
 */
export async function checkForImportHashDuplicates(): Promise<{
    success: boolean
    count: number
    duplicates: Array<{ import_hash: string; count: number; ids: string[] }>
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    try {
        const { data: transactions } = await supabase
            .from('transactions')
            .select('id, import_hash')
            .eq('user_id', user.id)
            .not('import_hash', 'is', null)

        // Group by import_hash
        const groups = new Map<string, string[]>()
        for (const tx of transactions || []) {
            if (!groups.has(tx.import_hash)) {
                groups.set(tx.import_hash, [])
            }
            groups.get(tx.import_hash)!.push(tx.id)
        }

        const duplicates = Array.from(groups.entries())
            .filter(([_, ids]) => ids.length > 1)
            .map(([import_hash, ids]) => ({
                import_hash,
                count: ids.length,
                ids
            }))

        return {
            success: true,
            count: duplicates.length,
            duplicates
        }
    } catch (error) {
        return {
            success: false,
            count: 0,
            duplicates: []
        }
    }
}
