"use server"

import { createClient } from "@/lib/supabase/server"

export async function getPendingMatches() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Simple query without nested joins to avoid PostgREST errors
    const { data: matches, error } = await supabase
        .from('pending_matches')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

    if (error) throw error
    if (!matches || matches.length === 0) return []

    // Fetch related data separately
    const txIds = [...new Set(matches.map(m => m.transaction_id))]
    const ruleIds = [...new Set(matches.map(m => m.rule_id).filter(Boolean))]
    const categoryIds = [...new Set(matches.map(m => m.suggested_category_id).filter(Boolean))]

    // Batch transaction fetches in small chunks to avoid HTTP header limits
    const txMap = new Map()
    const batchSize = 50 // Small batches to avoid URL length limits
    for (let i = 0; i < txIds.length; i += batchSize) {
        const batchIds = txIds.slice(i, i + batchSize)
        const { data: txBatch, error: txError } = await supabase
            .from('transactions')
            .select('*, vendors(id, name), staff(id, name)')
            .in('id', batchIds)

        if (!txError && txBatch) {
            txBatch.forEach(t => txMap.set(t.id, t))
        }
    }

    const [rulesResult, categoriesResult] = await Promise.all([
        ruleIds.length > 0 ? supabase.from('reconciliation_rules').select('id, name, description').in('id', ruleIds) : { data: [] },
        categoryIds.length > 0 ? supabase.from('categories').select('id, name, parent_id').in('id', categoryIds) : { data: [] }
    ])

    const ruleMap = new Map(((rulesResult as any).data || []).map((r: any) => [r.id, r]))
    const categoryMap = new Map(((categoriesResult as any).data || []).map((c: any) => [c.id, c]))

    return matches.map(match => ({
        ...match,
        transaction: txMap.get(match.transaction_id) || null,
        rule: ruleMap.get(match.rule_id) || null,
        suggested_category: categoryMap.get(match.suggested_category_id) || null
    }))
}

export async function getPendingCount() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { count, error } = await supabase
        .from('pending_matches')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'pending')

    if (error) throw error
    return count || 0
}

export async function approveMatch(matchId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Get the pending match first
    const { data: match, error: matchError } = await supabase
        .from('pending_matches')
        .select('*')
        .eq('id', matchId)
        .eq('user_id', user.id)
        .single()

    if (matchError || !match) throw new Error("Match not found")

    // Guard: Ensure category exists
    if (!match.suggested_category_id) throw new Error("Cannot approve match: No suggested category found")

    // Build update object - only include staff/vendor if they exist in the match
    const txUpdate: any = {
        category_id: match.suggested_category_id,
        notes: match.suggested_notes || undefined,
        reconciliation_status: 'approved',
        matched_rule_id: match.rule_id,
        reconciled_at: new Date().toISOString(),
        reconciled_by: 'rule',
        confirmed: true
    }

    // Apply suggested staff/vendor if present
    if (match.suggested_staff_id) txUpdate.staff_id = match.suggested_staff_id
    if (match.suggested_vendor_id) txUpdate.vendor_id = match.suggested_vendor_id

    // Update the transaction with suggested category
    const { error: txError } = await supabase
        .from('transactions')
        .update(txUpdate)
        .eq('id', match.transaction_id)
        .eq('user_id', user.id)

    if (txError) throw txError

    // Update the pending match status
    const { error: updateError } = await supabase
        .from('pending_matches')
        .update({
            status: 'approved',
            reviewed_at: new Date().toISOString()
        })
        .eq('id', matchId)

    if (updateError) throw updateError

    return { success: true }
}

export async function approveMatchWithEdit(matchId: string, categoryId: string, notes?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Get the pending match first
    const { data: match, error: matchError } = await supabase
        .from('pending_matches')
        .select('*')
        .eq('id', matchId)
        .eq('user_id', user.id)
        .single()

    if (matchError || !match) throw new Error("Match not found")

    // Update the transaction with user-specified category
    const { error: txError } = await supabase
        .from('transactions')
        .update({
            category_id: categoryId,
            notes: notes || match.suggested_notes || undefined,
            reconciliation_status: 'approved',
            matched_rule_id: match.rule_id,
            reconciled_at: new Date().toISOString(),
            reconciled_by: 'rule',
            confirmed: true
        })
        .eq('id', match.transaction_id)
        .eq('user_id', user.id)

    if (txError) throw txError

    // Update the pending match status
    const { error: updateError } = await supabase
        .from('pending_matches')
        .update({
            status: 'approved',
            reviewed_at: new Date().toISOString()
        })
        .eq('id', matchId)

    if (updateError) throw updateError

    return { success: true }
}

export async function rejectMatch(matchId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Get the pending match first
    const { data: match, error: matchError } = await supabase
        .from('pending_matches')
        .select('transaction_id')
        .eq('id', matchId)
        .eq('user_id', user.id)
        .single()

    if (matchError || !match) throw new Error("Match not found")

    // Update transaction status back to UNRECONCILED (so other rules can match it)
    const { error: txError } = await supabase
        .from('transactions')
        .update({
            reconciliation_status: 'unreconciled'
        })
        .eq('id', match.transaction_id)
        .eq('user_id', user.id)

    if (txError) throw txError

    // Update the pending match status
    const { error: updateError } = await supabase
        .from('pending_matches')
        .update({
            status: 'rejected',
            reviewed_at: new Date().toISOString()
        })
        .eq('id', matchId)

    if (updateError) throw updateError

    return { success: true }
}

export async function bulkApprove(matchIds: string[]) {
    const results = await Promise.all(
        matchIds.map(id => approveMatch(id).catch(e => ({ error: e.message, id })))
    )
    const failed = results.filter((r: any) => r.error)
    return {
        success: failed.length === 0,
        approved: matchIds.length - failed.length,
        failed: failed.length
    }
}

export async function bulkReject(matchIds: string[]) {
    const results = await Promise.all(
        matchIds.map(id => rejectMatch(id).catch(e => ({ error: e.message, id })))
    )
    const failed = results.filter((r: any) => r.error)
    return {
        success: failed.length === 0,
        rejected: matchIds.length - failed.length,
        failed: failed.length
    }
}

// Get all matches for a specific rule (for rule testing/preview)
export async function getMatchesByRule(ruleId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { data: matches, error } = await supabase
        .from('pending_matches')
        .select(`
            *,
            transaction:transactions(id, description, amount, transaction_date, type)
        `)
        .eq('user_id', user.id)
        .eq('rule_id', ruleId)
        .order('created_at', { ascending: false })

    if (error) throw error
    return matches || []
}
