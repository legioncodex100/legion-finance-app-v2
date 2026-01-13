"use client"

import { useState, useCallback, useEffect } from "react"
import {
    findSettlementMatches,
    manualReconcile,
    getUnreconciledSettlements,
    getReconciliationStats,
    type BankDeposit,
    type ReconciliationResult,
} from "@/lib/actions/mindbody-reconciliation"

/**
 * useMindbodyReconciliation - Mechanical Layer Hook
 * 
 * Manages state for T-3 windowing reconciliation.
 * Follows SLS: UI components should use this hook, not call services directly.
 */
export function useMindbodyReconciliation() {
    // State
    const [unreconciledSettlements, setUnreconciledSettlements] = useState<any[]>([])
    const [stats, setStats] = useState<{
        totalReconciled: number
        totalUnreconciled: number
        autoReconciledCount: number
        manualReconciledCount: number
        averageVariance: number
    } | null>(null)

    const [loading, setLoading] = useState(true)
    const [matching, setMatching] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [lastMatch, setLastMatch] = useState<ReconciliationResult | null>(null)

    // Load initial data
    const refresh = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const [settlementsData, statsData] = await Promise.all([
                getUnreconciledSettlements(),
                getReconciliationStats(),
            ])

            setUnreconciledSettlements(settlementsData.settlements)
            setStats(statsData)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load data')
        } finally {
            setLoading(false)
        }
    }, [])

    // Load on mount
    useEffect(() => {
        refresh()
    }, [refresh])

    // Find matches for a bank deposit
    const matchBankDeposit = useCallback(async (bankDeposit: BankDeposit) => {
        setMatching(true)
        setError(null)
        setLastMatch(null)

        try {
            const result = await findSettlementMatches(bankDeposit)
            setLastMatch(result)

            // If auto-reconciled, refresh the list
            if (result.autoReconciled) {
                await refresh()
            }

            return result
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Match failed')
            return null
        } finally {
            setMatching(false)
        }
    }, [refresh])

    // Manually reconcile a settlement
    const reconcileManually = useCallback(async (
        settlementId: string,
        bankTransactionId: string,
        bankAmount: number
    ) => {
        setError(null)

        try {
            const result = await manualReconcile(settlementId, bankTransactionId, bankAmount)

            if (result.success) {
                await refresh()
                return true
            } else {
                setError(result.error || 'Reconciliation failed')
                return false
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Reconciliation failed')
            return false
        }
    }, [refresh])

    return {
        // Data
        unreconciledSettlements,
        stats,
        lastMatch,

        // Status
        loading,
        matching,
        error,

        // Actions
        refresh,
        matchBankDeposit,
        reconcileManually,
    }
}
