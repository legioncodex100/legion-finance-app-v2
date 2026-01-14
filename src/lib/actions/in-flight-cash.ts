"use server"

import { createClient } from "@/lib/supabase/server"

/**
 * Get in-flight cash - money collected from Mindbody but not yet deposited in bank
 * 
 * Simple approach: Total Collected - Total Deposited = In-Flight
 * No need for complex transaction-level matching!
 */
export async function getInFlightCash() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const startDate = '2026-01-01'

    try {
        // Get total Mindbody collections
        const { data: collections, error: mbError } = await supabase
            .from('mb_transactions')
            .select('gross_amount, calculated_fee')
            .eq('user_id', user.id)
            .eq('status', 'Approved')
            .gte('transaction_date', startDate)

        if (mbError) {
            if (mbError.code === '42703') {
                console.warn('In-flight cash columns not yet created.')
                return { grossCollected: 0, feesCollected: 0, netCollected: 0, totalDeposited: 0, inFlight: 0 }
            }
            throw mbError
        }

        // Get total bank deposits from Mindbody
        const { data: deposits, error: bankError } = await supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', user.id)
            .gte('transaction_date', startDate)
            .gt('amount', 0)
            .or('raw_party.ilike.%MINDBODY%,description.ilike.%MINDBODY%')

        if (bankError) {
            throw bankError
        }

        if (!collections || collections.length === 0) {
            return { grossCollected: 0, feesCollected: 0, netCollected: 0, totalDeposited: 0, inFlight: 0 }
        }

        // Calculate totals
        const grossCollected = collections.reduce((sum, tx) =>
            sum + parseFloat(tx.gross_amount || '0'), 0
        )
        const feesCollected = collections.reduce((sum, tx) =>
            sum + parseFloat(tx.calculated_fee || '0'), 0
        )
        const netCollected = grossCollected - feesCollected

        const totalDeposited = (deposits || []).reduce((sum, tx) =>
            sum + parseFloat(tx.amount || '0'), 0
        )

        const inFlight = netCollected - totalDeposited

        return {
            grossCollected: parseFloat(grossCollected.toFixed(2)),
            feesCollected: parseFloat(feesCollected.toFixed(2)),
            netCollected: parseFloat(netCollected.toFixed(2)),
            totalDeposited: parseFloat(totalDeposited.toFixed(2)),
            inFlight: parseFloat(Math.max(0, inFlight).toFixed(2)) // Don't show negative
        }
    } catch (err: any) {
        console.error('In-flight cash error:', err)
        return { grossCollected: 0, feesCollected: 0, netCollected: 0, totalDeposited: 0, inFlight: 0 }
    }
}
