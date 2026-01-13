"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    TrendingUp,
    TrendingDown,
    Users,
    AlertTriangle,
    CreditCard,
    RefreshCw,
    Loader2,
    ChevronRight,
    ChevronLeft,
    Clock,
    Calendar
} from "lucide-react"
import Link from "next/link"
import { getMRRSummary, getAtRiskMembers, getPeriodDeclines, getLowCreditMembers, getPeriodMetrics, getUpcomingScheduledPayments } from "@/lib/actions/mindbody-bi"
import { getLastSyncTime } from "@/lib/actions/mindbody-trends"
import { runFullMindbodySync, smartMindbodySync } from "@/lib/actions/mindbody-sync"
import { MBMember, MBDecline, MRRSummary, getChurnRiskColor } from "@/lib/integrations/mindbody/bi-types"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"

// Period metrics type
type PeriodMetrics = {
    revenue_collected: number
    transactions_count: number
    declined_amount: number
    declined_count: number
    active_members: number
    suspended_members: number
    declined_members: number
    previous_period?: {
        revenue_collected: number
        declined_amount: number
    }
}

export default function MindbodyDashboard() {
    const [mrr, setMrr] = React.useState<MRRSummary | null>(null)
    const [periodMetrics, setPeriodMetrics] = React.useState<PeriodMetrics | null>(null)
    const [atRiskMembers, setAtRiskMembers] = React.useState<MBMember[]>([])
    const [declines, setDeclines] = React.useState<{
        clientId: string
        name: string
        email: string
        monthly_rate: number
        declineDate: string
        declineCount: number
    }[]>([])
    const [lowCredit, setLowCredit] = React.useState<MBMember[]>([])
    const [lastSync, setLastSync] = React.useState<string | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [syncing, setSyncing] = React.useState(false)
    const [lastMbSyncDate, setLastMbSyncDate] = React.useState<string | null>(null)
    const [scheduled, setScheduled] = React.useState<{
        thisMonth: { count: number; total: number }
        nextMonth: { count: number; total: number }
    } | null>(null)

    // Load last MB sync date from localStorage on mount
    React.useEffect(() => {
        const saved = localStorage.getItem('lastMindbodySyncDate')
        if (saved) setLastMbSyncDate(saved)
    }, [])

    // Month selector state
    const [selectedDate, setSelectedDate] = React.useState(new Date())
    const [isFullMonth, setIsFullMonth] = React.useState(false)

    // Calculate date range based on selection
    const getDateRange = React.useCallback(() => {
        const year = selectedDate.getFullYear()
        const month = selectedDate.getMonth()
        const today = new Date()

        const startDate = new Date(year, month, 1)
        let endDate: Date

        if (isFullMonth || month < today.getMonth() || year < today.getFullYear()) {
            // Full month view or past month
            endDate = new Date(year, month + 1, 0) // Last day of month
        } else {
            // MTD - up to today
            endDate = today
        }

        return { startDate, endDate }
    }, [selectedDate, isFullMonth])

    const loadData = React.useCallback(async () => {
        setLoading(true)
        try {
            const { startDate, endDate } = getDateRange()

            const [mrrData, periodData, atRisk, declinesData, lowCreditData, syncTime, scheduledData] = await Promise.all([
                getMRRSummary(),
                getPeriodMetrics(startDate, endDate),
                getAtRiskMembers(5),
                getPeriodDeclines(startDate, endDate),
                getLowCreditMembers(),
                getLastSyncTime(),
                getUpcomingScheduledPayments()
            ])
            setMrr(mrrData)
            setPeriodMetrics(periodData)
            setAtRiskMembers(atRisk)
            setDeclines(declinesData)
            setLowCredit(lowCreditData)
            setLastSync(syncTime)
            setScheduled(scheduledData)
        } catch (error) {
            toast.error("Failed to load data")
        } finally {
            setLoading(false)
        }
    }, [getDateRange])

    React.useEffect(() => {
        loadData()
    }, [loadData])

    // Navigation functions
    const goToPreviousMonth = () => {
        setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
    }

    const goToNextMonth = () => {
        const today = new Date()
        const next = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1)
        if (next <= today) {
            setSelectedDate(next)
        }
    }

    const isCurrentMonth = selectedDate.getMonth() === new Date().getMonth() &&
        selectedDate.getFullYear() === new Date().getFullYear()

    // Format month display
    const monthDisplay = selectedDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

    // Calculate percent change
    const calcChange = (current: number, previous: number) => {
        if (previous === 0) return null
        return Math.round(((current - previous) / previous) * 100)
    }

    const revenueChange = periodMetrics?.previous_period
        ? calcChange(periodMetrics.revenue_collected, periodMetrics.previous_period.revenue_collected)
        : null

    // Smart sync (transactions + scheduled updates + last visits)
    const handleSmartSync = async () => {
        setSyncing(true)
        try {
            const result = await smartMindbodySync(lastMbSyncDate || undefined)
            console.log('Smart sync result:', result)
            if (result.success) {
                // Save last sync date
                setLastMbSyncDate(result.lastSyncDate)
                localStorage.setItem('lastMindbodySyncDate', result.lastSyncDate)
                toast.success(
                    `Synced ${result.transactions.synced} transactions, ` +
                    `${result.scheduledUpdated} scheduled payments updated, ` +
                    `${result.lastVisitsUpdated} visit dates refreshed.`
                )
                await loadData()
            } else {
                console.error('Smart sync failed:', result)
                toast.error(result.error || "Sync failed")
            }
        } catch (error) {
            console.error('Smart sync error:', error)
            toast.error(error instanceof Error ? error.message : "Sync failed")
        } finally {
            setSyncing(false)
        }
    }

    // Full sync (members + pricing) - less frequent
    const handleFullSync = async () => {
        setSyncing(true)
        try {
            const result = await runFullMindbodySync()
            console.log('Full sync result:', result)
            if (result.success) {
                toast.success(
                    `Synced ${result.members.synced} members, ${result.pricing.updated} pricing. ` +
                    `${result.members.declines} declines detected.`
                )
                await loadData()
            } else {
                toast.error(result.error || "Sync failed")
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Sync failed")
        } finally {
            setSyncing(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    const totalAtRiskRevenue = (mrr?.at_risk_mrr || 0) +
        atRiskMembers.reduce((sum, m) => sum + (m.monthly_rate || 0), 0)

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Mindbody Intelligence</h1>
                        <p className="text-muted-foreground">Financial insights from your membership data</p>
                        {lastSync && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <Clock className="h-3 w-3" />
                                Last synced: {new Date(lastSync).toLocaleString()}
                            </p>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Link href="/mindbody/demographics">
                            <Button variant="outline">
                                <Users className="h-4 w-4 mr-2" />
                                Demographics
                            </Button>
                        </Link>
                        <Button onClick={handleSmartSync} disabled={syncing} className="gap-2">
                            {syncing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <RefreshCw className="h-4 w-4" />
                            )}
                            {lastMbSyncDate ? `Sync (from ${lastMbSyncDate})` : 'Sync Now'}
                        </Button>
                        <Button onClick={handleFullSync} disabled={syncing} variant="outline" title="Full member sync">
                            <Users className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Month Selector */}
                <div className="flex items-center gap-4 bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={goToPreviousMonth}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-2 min-w-[160px] justify-center">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{monthDisplay}</span>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={goToNextMonth}
                            disabled={isCurrentMonth}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>

                    {isCurrentMonth && (
                        <div className="flex gap-1 text-sm">
                            <Button
                                variant={!isFullMonth ? "secondary" : "ghost"}
                                size="sm"
                                onClick={() => setIsFullMonth(false)}
                            >
                                MTD
                            </Button>
                            <Button
                                variant={isFullMonth ? "secondary" : "ghost"}
                                size="sm"
                                onClick={() => setIsFullMonth(true)}
                            >
                                Full Month
                            </Button>
                        </div>
                    )}

                    <Badge variant="outline" className="ml-auto">
                        {getDateRange().startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - {getDateRange().endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </Badge>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />
                            Revenue Collected
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-600">
                            {formatCurrency(periodMetrics?.revenue_collected || 0)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {periodMetrics?.transactions_count || 0} transactions
                            {revenueChange !== null && (
                                <span className={`ml-2 ${revenueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {revenueChange >= 0 ? '↑' : '↓'} {Math.abs(revenueChange)}% vs prev
                                </span>
                            )}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            Revenue at Risk
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-red-600">
                            {formatCurrency(periodMetrics?.declined_amount || totalAtRiskRevenue)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {periodMetrics?.declined_count || 0} declined, {atRiskMembers.length} high churn risk
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            Credit Pack Members
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">
                            {mrr?.pack_members || 0}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {lowCredit.length} need renewal
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                            <TrendingDown className="h-4 w-4 text-orange-500" />
                            Declined Payments
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-orange-600">
                            {periodMetrics?.declined_members || 0}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {formatCurrency(periodMetrics?.declined_amount || 0)} at risk
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Autopay Forecast Card */}
            {scheduled && (scheduled.thisMonth.count > 0 || scheduled.nextMonth.count > 0) && (
                <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-blue-200 dark:border-blue-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Calendar className="h-5 w-5 text-blue-600" />
                            Autopay Forecast
                        </CardTitle>
                        <CardDescription>Scheduled recurring payments</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <p className="text-sm text-muted-foreground mb-1">This Month</p>
                                <p className="text-2xl font-bold text-blue-600">
                                    {formatCurrency(scheduled.thisMonth.total)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {scheduled.thisMonth.count} payments
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground mb-1">Next Month</p>
                                <p className="text-2xl font-bold text-purple-600">
                                    {formatCurrency(scheduled.nextMonth.total)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {scheduled.nextMonth.count} payments
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Declines & Churn Risk */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Active Declines */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-red-500" />
                                    Declined Payments
                                </CardTitle>
                                <CardDescription>Members with failed payments</CardDescription>
                            </div>
                            <Link href="/mindbody/declines">
                                <Button variant="ghost" size="sm">
                                    View All <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {declines.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">
                                No declined payments in this period 🎉
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {declines.slice(0, 5).map((d) => (
                                    <div key={d.clientId} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                                        <div>
                                            <p className="font-medium">{d.name}</p>
                                            <p className="text-sm text-muted-foreground">{d.email}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-red-600">{formatCurrency(d.monthly_rate)}/mo</p>
                                            <Badge variant="destructive">
                                                {d.declineCount}x declined
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Churn Risk */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Users className="h-5 w-5 text-orange-500" />
                                    High Churn Risk
                                </CardTitle>
                                <CardDescription>Members likely to cancel</CardDescription>
                            </div>
                            <Link href="/mindbody/churn">
                                <Button variant="ghost" size="sm">
                                    View All <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {atRiskMembers.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">
                                No high-risk members 🎉
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {atRiskMembers.map((m) => (
                                    <div key={m.id} className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                                        <div>
                                            <p className="font-medium">{m.first_name} {m.last_name}</p>
                                            <p className="text-sm text-muted-foreground">
                                                Last visit: {m.last_visit_date || 'Never'}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold">{formatCurrency(m.monthly_rate)}/mo</p>
                                            <span className={`text-sm font-bold ${getChurnRiskColor(m.churn_risk)}`}>
                                                Risk: {m.churn_risk}%
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Low Credit Packs */}
            {lowCredit.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5 text-yellow-500" />
                            Credit Packs Running Low
                        </CardTitle>
                        <CardDescription>Members who may need to renew soon</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {lowCredit.slice(0, 6).map((m) => (
                                <div key={m.id} className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                                    <p className="font-medium">{m.first_name} {m.last_name}</p>
                                    <p className="text-sm text-muted-foreground">{m.email}</p>
                                    <div className="mt-2 flex items-center justify-between">
                                        <Badge variant="outline" className="text-yellow-700">
                                            {m.credits_remaining} credits left
                                        </Badge>
                                        {m.credits_expiration && (
                                            <span className="text-xs text-muted-foreground">
                                                Expires: {m.credits_expiration}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
