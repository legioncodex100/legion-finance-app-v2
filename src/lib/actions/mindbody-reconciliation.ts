"use server"

import { createClient } from "@/lib/supabase/server"

/**
 * T-3 Windowing Reconciliation Service
 * 
 * When a bank deposit appears on date T, search Mindbody settlements
 * between T-3 and T. Auto-reconcile if variance ≤ £0.05
 */

export interface BankDeposit {
    id: string
    amount: number
    date: string  // YYYY-MM-DD
    description?: string
}

export interface SettlementMatch {
    settlementId: string
    settlementDate: string
    mbNet: number
    bankAmount: number
    variance: number
    withinMargin: boolean
    transactionCount: number
}

export interface ReconciliationResult {
    bankDeposit: BankDeposit
    matches: SettlementMatch[]
    autoReconciled: boolean
    reconciledSettlementId?: string
}

const VARIANCE_MARGIN_GBP = 0.05

/**
 * Find potential settlement matches for a bank deposit
 * Uses T-3 windowing: search 3 days before deposit date
 */
export async function findSettlementMatches(
    bankDeposit: BankDeposit
): Promise<ReconciliationResult> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return {
            bankDeposit,
            matches: [],
            autoReconciled: false
        }
    }

    // Calculate T-3 window
    const depositDate = new Date(bankDeposit.date)
    const windowStart = new Date(depositDate)
    windowStart.setDate(windowStart.getDate() - 3)

    const windowStartStr = windowStart.toISOString().split('T')[0]
    const windowEndStr = depositDate.toISOString().split('T')[0]

    // Find settlements in the window that aren't already reconciled
    const { data: settlements, error } = await supabase
        .from('mb_settlements')
        .select('*')
        .eq('user_id', user.id)
        .eq('reconciled', false)
        .gte('settlement_date', windowStartStr)
        .lte('settlement_date', windowEndStr)
        .order('settlement_date', { ascending: false })

    if (error || !settlements) {
        return { bankDeposit, matches: [], autoReconciled: false }
    }

    // Calculate match scores
    const matches: SettlementMatch[] = settlements.map(s => {
        const variance = Math.abs(s.mb_net - bankDeposit.amount)
        return {
            settlementId: s.settlement_id,
            settlementDate: s.settlement_date,
            mbNet: s.mb_net,
            bankAmount: bankDeposit.amount,
            variance: Math.round(variance * 100) / 100,
            withinMargin: variance <= VARIANCE_MARGIN_GBP,
            transactionCount: s.transaction_count,
        }
    })

    // Sort by variance (best match first)
    matches.sort((a, b) => a.variance - b.variance)

    // Check for auto-reconcile (single perfect match)
    const perfectMatches = matches.filter(m => m.withinMargin)
    let autoReconciled = false
    let reconciledSettlementId: string | undefined

    if (perfectMatches.length === 1) {
        // Auto-reconcile!
        const match = perfectMatches[0]
        const { error: updateError } = await supabase
            .from('mb_settlements')
            .update({
                reconciled: true,
                reconciled_at: new Date().toISOString(),
                bank_transaction_id: bankDeposit.id,
                bank_amount: bankDeposit.amount,
                variance: match.variance,
                auto_reconciled: true,
            })
            .eq('user_id', user.id)
            .eq('settlement_id', match.settlementId)

        if (!updateError) {
            autoReconciled = true
            reconciledSettlementId = match.settlementId
        }
    }

    return {
        bankDeposit,
        matches,
        autoReconciled,
        reconciledSettlementId,
    }
}

/**
 * Manually reconcile a settlement to a bank deposit
 */
export async function manualReconcile(
    settlementId: string,
    bankTransactionId: string,
    bankAmount: number
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Get settlement
    const { data: settlement } = await supabase
        .from('mb_settlements')
        .select('mb_net')
        .eq('user_id', user.id)
        .eq('settlement_id', settlementId)
        .single()

    if (!settlement) {
        return { success: false, error: 'Settlement not found' }
    }

    const variance = Math.abs(settlement.mb_net - bankAmount)

    const { error } = await supabase
        .from('mb_settlements')
        .update({
            reconciled: true,
            reconciled_at: new Date().toISOString(),
            bank_transaction_id: bankTransactionId,
            bank_amount: bankAmount,
            variance: Math.round(variance * 100) / 100,
            auto_reconciled: false,
        })
        .eq('user_id', user.id)
        .eq('settlement_id', settlementId)

    if (error) {
        return { success: false, error: error.message }
    }

    return { success: true }
}

/**
 * Get unreconciled settlements (for UI)
 */
export async function getUnreconciledSettlements(): Promise<{
    settlements: any[]
    total: number
    totalValue: number
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { settlements: [], total: 0, totalValue: 0 }
    }

    const { data, error } = await supabase
        .from('mb_settlements')
        .select('*')
        .eq('user_id', user.id)
        .eq('reconciled', false)
        .order('settlement_date', { ascending: false })

    if (error || !data) {
        return { settlements: [], total: 0, totalValue: 0 }
    }

    const totalValue = data.reduce((sum, s) => sum + (s.mb_net || 0), 0)

    return {
        settlements: data,
        total: data.length,
        totalValue: Math.round(totalValue * 100) / 100,
    }
}

/**
 * Get reconciliation stats
 */
export async function getReconciliationStats(): Promise<{
    totalReconciled: number
    totalUnreconciled: number
    autoReconciledCount: number
    manualReconciledCount: number
    averageVariance: number
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return {
            totalReconciled: 0,
            totalUnreconciled: 0,
            autoReconciledCount: 0,
            manualReconciledCount: 0,
            averageVariance: 0,
        }
    }

    const { data: all } = await supabase
        .from('mb_settlements')
        .select('reconciled, auto_reconciled, variance')
        .eq('user_id', user.id)

    if (!all) {
        return {
            totalReconciled: 0,
            totalUnreconciled: 0,
            autoReconciledCount: 0,
            manualReconciledCount: 0,
            averageVariance: 0,
        }
    }

    const reconciled = all.filter(s => s.reconciled)
    const autoReconciled = reconciled.filter(s => s.auto_reconciled)
    const variances = reconciled.map(s => s.variance || 0)
    const avgVariance = variances.length > 0
        ? variances.reduce((a, b) => a + b, 0) / variances.length
        : 0

    return {
        totalReconciled: reconciled.length,
        totalUnreconciled: all.length - reconciled.length,
        autoReconciledCount: autoReconciled.length,
        manualReconciledCount: reconciled.length - autoReconciled.length,
        averageVariance: Math.round(avgVariance * 100) / 100,
    }
}
