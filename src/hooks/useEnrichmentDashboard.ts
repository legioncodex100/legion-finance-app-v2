"use client"

import { useState, useCallback, useEffect } from "react"
import {
    getEnrichmentDashboardData,
    type EnrichmentDashboardData,
    type RevenueBreakdown,
    type MembershipSnapshot,
    type RiskMetrics,
} from "@/lib/actions/mindbody-dashboard"

/**
 * useEnrichmentDashboard - Mechanical Layer Hook
 * 
 * Manages state for the Mindbody Enrichment Dashboard.
 * UI components should use this hook, not call services directly.
 */
export function useEnrichmentDashboard(daysBack: number = 30) {
    const [data, setData] = useState<EnrichmentDashboardData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const refresh = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const result = await getEnrichmentDashboardData(daysBack)
            setData(result)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load")
        } finally {
            setLoading(false)
        }
    }, [daysBack])

    useEffect(() => {
        refresh()
    }, [refresh])

    return {
        // Data
        revenue: data?.revenue ?? null,
        memberships: data?.memberships ?? null,
        risks: data?.risks ?? null,
        lastSynced: data?.lastSynced ?? null,

        // Status
        loading,
        error,

        // Actions
        refresh,
    }
}

// Re-export types for convenience
export type { RevenueBreakdown, MembershipSnapshot, RiskMetrics, EnrichmentDashboardData }
