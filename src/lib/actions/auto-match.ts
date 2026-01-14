"use server"

import { createClient } from "@/lib/supabase/server"

/**
 * Auto-match Mindbody transactions to bank deposits
 * 
 * Strategy:
 * 1. Group Mindbody transactions by transaction_date
 * 2. Find bank deposits within date range
 * 3. Match based on amount proximity (within £5 tolerance for fees)
 * 4. Return suggestions for manual review/confirmation
 */
export async function findPotentialMatches() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const startDate = '2026-01-01'

    // Get all unmatched Mindbody transactions
    const { data: mbTransactions, error: mbError } = await supabase
        .from('mb_transactions')
        .select('id, transaction_date, gross_amount, calculated_fee, is_matched')
        .eq('user_id', user.id)
        .eq('status', 'Approved')
        .gte('transaction_date', startDate)
        .or('is_matched.is.null,is_matched.eq.false')

    if (mbError) {
        console.error('Error fetching MB transactions:', mbError)
        throw mbError
    }

    // Get all potential bank deposits (positive amounts from Mindbody)
    const { data: bankDeposits, error: bankError } = await supabase
        .from('transactions')
        .select('id, transaction_date, amount, description, raw_party')
        .eq('user_id', user.id)
        .gte('transaction_date', startDate)
        .gt('amount', 0)
        .or('raw_party.ilike.%MINDBODY%,description.ilike.%MINDBODY%')

    if (bankError) {
        console.error('Error fetching bank deposits:', bankError)
        throw bankError
    }

    if (!mbTransactions || !bankDeposits) {
        return []
    }

    // Group MB transactions by date
    const mbByDate = new Map<string, {
        transactions: any[],
        gross: number,
        fees: number,
        net: number
    }>()

    for (const tx of mbTransactions) {
        const date = tx.transaction_date.split('T')[0]
        if (!mbByDate.has(date)) {
            mbByDate.set(date, { transactions: [], gross: 0, fees: 0, net: 0 })
        }
        const group = mbByDate.get(date)!
        group.transactions.push(tx)
        group.gross += parseFloat(tx.gross_amount || '0')
        group.fees += parseFloat(tx.calculated_fee || '0')
        group.net = group.gross - group.fees
    }

    // Find potential matches
    const matches: Array<{
        mb_date: string
        mb_transaction_ids: string[]
        mb_gross: number
        mb_fees: number
        mb_net: number
        mb_count: number
        bank_transaction_id: string
        bank_date: string
        bank_amount: number
        bank_description: string
        difference: number
        confidence: 'high' | 'medium' | 'low'
    }> = []

    for (const [mbDate, mbGroup] of mbByDate.entries()) {
        for (const deposit of bankDeposits) {
            const depositDate = deposit.transaction_date.split('T')[0]
            const depositAmount = parseFloat(deposit.amount)

            // Calculate difference
            const difference = Math.abs(mbGroup.net - depositAmount)

            // Date proximity (0-7 days after collection)
            const mbDateObj = new Date(mbDate)
            const depositDateObj = new Date(depositDate)
            const daysDiff = Math.floor((depositDateObj.getTime() - mbDateObj.getTime()) / (1000 * 60 * 60 * 24))

            // Match criteria
            if (daysDiff >= 0 && daysDiff <= 7 && difference < 5) {
                let confidence: 'high' | 'medium' | 'low' = 'low'

                if (difference < 0.50 && daysDiff <= 3) {
                    confidence = 'high'
                } else if (difference < 2 && daysDiff <= 5) {
                    confidence = 'medium'
                }

                matches.push({
                    mb_date: mbDate,
                    mb_transaction_ids: mbGroup.transactions.map(t => t.id),
                    mb_gross: parseFloat(mbGroup.gross.toFixed(2)),
                    mb_fees: parseFloat(mbGroup.fees.toFixed(2)),
                    mb_net: parseFloat(mbGroup.net.toFixed(2)),
                    mb_count: mbGroup.transactions.length,
                    bank_transaction_id: deposit.id,
                    bank_date: depositDate,
                    bank_amount: depositAmount,
                    bank_description: deposit.description,
                    difference: parseFloat(difference.toFixed(2)),
                    confidence
                })
            }
        }
    }

    // Sort by confidence and difference
    matches.sort((a, b) => {
        const confidenceOrder = { high: 0, medium: 1, low: 2 }
        if (confidenceOrder[a.confidence] !== confidenceOrder[b.confidence]) {
            return confidenceOrder[a.confidence] - confidenceOrder[b.confidence]
        }
        return a.difference - b.difference
    })

    return matches
}

/**
 * Apply a match - mark all MB transactions in the group as matched
 */
export async function applyMatch(mbTransactionIds: string[], bankTransactionId: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
        .from('mb_transactions')
        .update({
            is_matched: true,
            matched_transaction_id: bankTransactionId
        })
        .in('id', mbTransactionIds)
        .eq('user_id', user.id)

    if (error) {
        console.error('Error applying match:', error)
        throw error
    }

    return { success: true, matched_count: mbTransactionIds.length }
}

/**
 * Auto-apply all high-confidence matches
 */
export async function autoMatchHighConfidence() {
    const matches = await findPotentialMatches()
    const highConfidence = matches.filter(m => m.confidence === 'high')

    let totalMatched = 0
    const results = []

    for (const match of highConfidence) {
        const result = await applyMatch(match.mb_transaction_ids, match.bank_transaction_id)
        totalMatched += result.matched_count
        results.push({
            mb_date: match.mb_date,
            bank_date: match.bank_date,
            amount: match.mb_net,
            matched_count: result.matched_count
        })
    }

    return {
        success: true,
        total_matches: highConfidence.length,
        total_transactions_matched: totalMatched,
        details: results
    }
}
