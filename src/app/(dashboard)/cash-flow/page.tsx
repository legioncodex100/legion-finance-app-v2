"use client"

import * as React from "react"
import { RefreshCcw, Loader2, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock, BarChart3, Activity, ChevronDown, ChevronRight, Calendar, Save, RotateCcw, ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    analyzeHistoricalPatterns,
    generateForecast,
    getDataFreshness,
    getCurrentBankBalance,
    getPatternInsights,
    getUserSettings,
    setOpeningBalance,
    type ForecastWeek,
    type DataFreshness
} from "@/lib/actions/cash-flow"
import { syncMindbodyScheduledPayments } from "@/lib/actions/mindbody-bi"
import {
    getCalendarData,
    applyScheduleChanges,
    type ScheduledPayable,
    type ScheduledReceivable,
    type DateChange
} from "@/lib/actions/cash-flow-planner"

type TimeframeOption = 4 | 8 | 13 | 26
type TabType = 'forecast' | 'calendar'

export default function CashFlowPage() {
    const [isLoading, setIsLoading] = React.useState(true)
    const [isAnalyzing, setIsAnalyzing] = React.useState(false)
    const [forecast, setForecast] = React.useState<ForecastWeek[]>([])
    const [currentBalance, setCurrentBalance] = React.useState(0)
    const [dataFreshness, setDataFreshness] = React.useState<DataFreshness | null>(null)
    const [timeframe, setTimeframe] = React.useState<TimeframeOption>(13)
    const [insights, setInsights] = React.useState<Awaited<ReturnType<typeof getPatternInsights>> | null>(null)
    const [openingBalance, setOpeningBalanceState] = React.useState(0)
    const [editingBalance, setEditingBalance] = React.useState(false)
    const [balanceInput, setBalanceInput] = React.useState('')
    const [isSavingBalance, setIsSavingBalance] = React.useState(false)
    const [expandedWeeks, setExpandedWeeks] = React.useState<Set<number>>(new Set())

    // Calendar tab state
    const [activeTab, setActiveTab] = React.useState<TabType>('forecast')
    const [calendarMonth, setCalendarMonth] = React.useState(() => {
        const now = new Date()
        return { year: now.getFullYear(), month: now.getMonth() + 1 }
    })
    const [payables, setPayables] = React.useState<ScheduledPayable[]>([])
    const [receivables, setReceivables] = React.useState<ScheduledReceivable[]>([])
    const [pendingChanges, setPendingChanges] = React.useState<Map<string, DateChange>>(new Map())
    const [isLoadingCalendar, setIsLoadingCalendar] = React.useState(false)
    const [isSavingChanges, setIsSavingChanges] = React.useState(false)
    const [draggedItem, setDraggedItem] = React.useState<{ id: string; type: 'payable' | 'receivable' } | null>(null)
    const [isSyncingAutopay, setIsSyncingAutopay] = React.useState(false)

    const toggleWeek = (weekNumber: number) => {
        setExpandedWeeks(prev => {
            const newSet = new Set(prev)
            if (newSet.has(weekNumber)) {
                newSet.delete(weekNumber)
            } else {
                newSet.add(weekNumber)
            }
            return newSet
        })
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-GB', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount)
    }

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
    }

    const loadData = React.useCallback(async () => {
        setIsLoading(true)
        try {
            const [forecastData, balance, freshness, insightsData, settings] = await Promise.all([
                generateForecast(timeframe),
                getCurrentBankBalance(),
                getDataFreshness(),
                getPatternInsights(),
                getUserSettings()
            ])
            console.log('[CashFlow UI] balance received:', balance, 'forecastWeek1:', forecastData[0]?.runningBalance)
            setForecast(forecastData)
            setCurrentBalance(balance)
            setDataFreshness(freshness)
            setInsights(insightsData)
            setOpeningBalanceState(settings.openingBalance)
        } catch (e) {
            console.error('Error loading cash flow data:', e)
        }
        setIsLoading(false)
    }, [timeframe])

    React.useEffect(() => {
        loadData()
    }, [loadData])

    // Calendar data loading
    const loadCalendarData = React.useCallback(async () => {
        setIsLoadingCalendar(true)
        try {
            const data = await getCalendarData(calendarMonth.year, calendarMonth.month)
            setPayables(data.payables)
            setReceivables(data.receivables)
        } catch (e) {
            console.error('Error loading calendar data:', e)
        }
        setIsLoadingCalendar(false)
    }, [calendarMonth])

    React.useEffect(() => {
        if (activeTab === 'calendar') {
            loadCalendarData()
        }
    }, [activeTab, loadCalendarData])

    // Calendar navigation
    const prevMonth = () => {
        setCalendarMonth(prev => {
            if (prev.month === 1) {
                return { year: prev.year - 1, month: 12 }
            }
            return { year: prev.year, month: prev.month - 1 }
        })
    }

    const nextMonth = () => {
        setCalendarMonth(prev => {
            if (prev.month === 12) {
                return { year: prev.year + 1, month: 1 }
            }
            return { year: prev.year, month: prev.month + 1 }
        })
    }

    // Get date with pending changes applied
    const getEffectiveDate = (id: string, originalDate: string) => {
        const change = pendingChanges.get(id)
        return change ? change.newDate : originalDate
    }

    // Handle drop on a calendar day
    const handleDrop = (dayDate: string) => {
        if (!draggedItem) return

        const item = draggedItem.type === 'payable'
            ? payables.find(p => p.id === draggedItem.id)
            : receivables.find(r => r.id === draggedItem.id)

        if (!item) return

        const originalDate = item.dueDate
        const currentEffectiveDate = getEffectiveDate(item.id, originalDate)

        if (currentEffectiveDate !== dayDate) {
            setPendingChanges(prev => {
                const newChanges = new Map(prev)
                newChanges.set(item.id, {
                    id: item.id,
                    originalDate,
                    newDate: dayDate
                })
                return newChanges
            })
        }

        setDraggedItem(null)
    }

    // Discard all pending changes
    const discardChanges = () => {
        setPendingChanges(new Map())
    }

    // Save all pending changes
    const handleSaveChanges = async () => {
        if (pendingChanges.size === 0) return
        setIsSavingChanges(true)
        try {
            const changes = Array.from(pendingChanges.values())
            const result = await applyScheduleChanges(changes)
            if (result.success) {
                alert(`Successfully updated ${result.updated} due dates!`)
                setPendingChanges(new Map())
                await loadCalendarData()
            } else {
                alert(`Updated ${result.updated} items. Errors: ${result.errors.join(', ')}`)
            }
        } catch (e) {
            console.error('Error saving changes:', e)
        }
        setIsSavingChanges(false)
    }

    const handleAnalyzePatterns = async () => {
        setIsAnalyzing(true)
        try {
            const result = await analyzeHistoricalPatterns()
            alert(`Pattern analysis complete! Created ${result.patternsCreated} patterns.`)
            await loadData()
        } catch (e) {
            console.error('Error analyzing patterns:', e)
        }
        setIsAnalyzing(false)
    }

    const handleSyncAutopay = async () => {
        setIsSyncingAutopay(true)
        try {
            const result = await syncMindbodyScheduledPayments()
            alert(`Autopay sync complete! Scheduled: ${result.scheduled}, Updated: ${result.updated}`)
            await loadData()
            if (activeTab === 'calendar') {
                await loadCalendarData()
            }
        } catch (e) {
            console.error('Error syncing autopay:', e)
            alert('Error syncing autopay schedules')
        }
        setIsSyncingAutopay(false)
    }

    const handleSaveOpeningBalance = async () => {
        setIsSavingBalance(true)
        try {
            const amount = parseFloat(balanceInput.replace(/[^0-9.-]/g, '')) || 0
            await setOpeningBalance(amount)
            setOpeningBalanceState(amount)
            setEditingBalance(false)
            await loadData()
        } catch (e) {
            console.error('Error saving opening balance:', e)
        }
        setIsSavingBalance(false)
    }

    // Find the lowest balance week
    const lowestBalanceWeek = forecast.reduce((lowest, week) =>
        week.runningBalance < lowest.runningBalance ? week : lowest
        , forecast[0] || { runningBalance: 0 })

    // Count danger weeks
    const dangerWeeks = forecast.filter(w => w.isDanger).length

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Cash Flow Forecast</h1>
                    <p className="text-muted-foreground">See your projected cash position week by week</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={handleSyncAutopay}
                        disabled={isSyncingAutopay}
                    >
                        {isSyncingAutopay ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Calendar className="h-4 w-4 mr-2" />}
                        Sync Autopay
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleAnalyzePatterns}
                        disabled={isAnalyzing}
                    >
                        {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <BarChart3 className="h-4 w-4 mr-2" />}
                        Analyze Patterns
                    </Button>
                    <Button
                        variant="outline"
                        onClick={loadData}
                        disabled={isLoading}
                    >
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800">
                <button
                    onClick={() => setActiveTab('forecast')}
                    className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors -mb-[1px] ${activeTab === 'forecast'
                        ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                >
                    <BarChart3 className="h-4 w-4 inline mr-2" />
                    Weekly Forecast
                </button>
                <button
                    onClick={() => setActiveTab('calendar')}
                    className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors -mb-[1px] ${activeTab === 'calendar'
                        ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                >
                    <Calendar className="h-4 w-4 inline mr-2" />
                    Payment Calendar
                    {pendingChanges.size > 0 && (
                        <span className="ml-2 text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded-full">
                            {pendingChanges.size}
                        </span>
                    )}
                </button>
            </div>

            {/* FORECAST TAB */}
            {activeTab === 'forecast' && (
                <>
                    {/* Data Freshness Status */}
                    {dataFreshness && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Data Sources</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="flex items-center gap-2">
                                        {dataFreshness.bank.isStale ? (
                                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                                        ) : (
                                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                                        )}
                                        <div>
                                            <p className="text-sm font-medium">Bank Transactions</p>
                                            <p className="text-xs text-muted-foreground">
                                                {dataFreshness.bank.lastImport
                                                    ? `Last: ${formatDate(dataFreshness.bank.lastImport)}`
                                                    : 'No data'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {dataFreshness.patterns.isStale ? (
                                            <Clock className="h-4 w-4 text-amber-500" />
                                        ) : (
                                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                                        )}
                                        <div>
                                            <p className="text-sm font-medium">Pattern Analysis</p>
                                            <p className="text-xs text-muted-foreground">
                                                {dataFreshness.patterns.lastCalculated
                                                    ? `Last: ${formatDate(dataFreshness.patterns.lastCalculated)}`
                                                    : 'Not run yet - click Analyze'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-zinc-400" />
                                        <div>
                                            <p className="text-sm font-medium">Mindbody Scheduled</p>
                                            <p className="text-xs text-muted-foreground">
                                                {dataFreshness.mindbodyScheduled.lastImport
                                                    ? `${dataFreshness.mindbodyScheduled.recordCount} payments`
                                                    : 'Not imported'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-zinc-400" />
                                        <div>
                                            <p className="text-sm font-medium">Failed Payments</p>
                                            <p className="text-xs text-muted-foreground">
                                                {dataFreshness.mindbodyFailed.lastImport
                                                    ? `${dataFreshness.mindbodyFailed.recordCount} failed`
                                                    : 'Not imported'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Opening Balance Setting */}
                    <Card className="border-dashed border-amber-500/50">
                        <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium">Opening Balance</p>
                                    <p className="text-xs text-muted-foreground">
                                        Set your actual bank balance to get accurate forecasts
                                    </p>
                                </div>
                                {editingBalance ? (
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">£</span>
                                        <input
                                            type="text"
                                            value={balanceInput}
                                            onChange={(e) => setBalanceInput(e.target.value)}
                                            placeholder="e.g. 15000"
                                            className="w-32 px-3 py-1 border rounded text-right"
                                            autoFocus
                                        />
                                        <Button
                                            size="sm"
                                            onClick={handleSaveOpeningBalance}
                                            disabled={isSavingBalance}
                                        >
                                            {isSavingBalance ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setEditingBalance(false)}
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-bold">
                                            £{formatCurrency(openingBalance)}
                                        </span>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                setBalanceInput(openingBalance.toString())
                                                setEditingBalance(true)
                                            }}
                                        >
                                            Edit
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Current Balance</p>
                                        <p className="text-2xl font-bold">£{formatCurrency(currentBalance)}</p>
                                    </div>
                                    <Activity className="h-8 w-8 text-emerald-500" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Lowest Point</p>
                                        <p className={`text-2xl font-bold ${lowestBalanceWeek?.isDanger ? 'text-red-500' : ''}`}>
                                            £{formatCurrency(lowestBalanceWeek?.runningBalance || 0)}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Week {lowestBalanceWeek?.weekNumber || '-'}
                                        </p>
                                    </div>
                                    <TrendingDown className={`h-8 w-8 ${lowestBalanceWeek?.isDanger ? 'text-red-500' : 'text-amber-500'}`} />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Danger Weeks</p>
                                        <p className={`text-2xl font-bold ${dangerWeeks > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                            {dangerWeeks}
                                        </p>
                                        <p className="text-xs text-muted-foreground">Below £2,000</p>
                                    </div>
                                    <AlertTriangle className={`h-8 w-8 ${dangerWeeks > 0 ? 'text-red-500' : 'text-emerald-500'}`} />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">End Balance</p>
                                        <p className="text-2xl font-bold">
                                            £{formatCurrency(forecast[forecast.length - 1]?.runningBalance || 0)}
                                        </p>
                                        <p className="text-xs text-muted-foreground">Week {timeframe}</p>
                                    </div>
                                    <TrendingUp className="h-8 w-8 text-blue-500" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Timeframe Selector */}
                    <div className="flex items-center gap-2">
                        {([4, 8, 13, 26] as TimeframeOption[]).map(t => (
                            <button
                                key={t}
                                onClick={() => setTimeframe(t)}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${timeframe === t
                                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                {t} Weeks
                            </button>
                        ))}
                    </div>

                    {/* Forecast Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Weekly Forecast</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : forecast.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <p>No forecast data yet.</p>
                                    <p className="text-sm">Click "Analyze Patterns" to generate a forecast from your historical data.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-zinc-200 dark:border-zinc-800 text-sm text-muted-foreground">
                                                <th className="text-left py-3 px-4">Week</th>
                                                <th className="text-left py-3 px-4">Dates</th>
                                                <th className="text-right py-3 px-4">Inflows</th>
                                                <th className="text-right py-3 px-4">Outflows</th>
                                                <th className="text-right py-3 px-4">Net</th>
                                                <th className="text-right py-3 px-4">Balance</th>
                                                <th className="text-center py-3 px-4">Source</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {forecast.map(week => {
                                                const isExpanded = expandedWeeks.has(week.weekNumber)
                                                const hasDetails = (week.sources?.income?.length || 0) > 0 || (week.sources?.expenses?.length || 0) > 0
                                                return (
                                                    <React.Fragment key={week.weekNumber}>
                                                        <tr
                                                            onClick={() => hasDetails && toggleWeek(week.weekNumber)}
                                                            className={`border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 ${week.isDanger ? 'bg-red-50 dark:bg-red-950/20' : ''} ${hasDetails ? 'cursor-pointer' : ''}`}
                                                        >
                                                            <td className="py-3 px-4 font-medium">
                                                                <div className="flex items-center gap-2">
                                                                    {hasDetails && (
                                                                        isExpanded
                                                                            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                                            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                                    )}
                                                                    W{week.weekNumber}
                                                                </div>
                                                            </td>
                                                            <td className="py-3 px-4 text-sm text-muted-foreground">
                                                                {formatDate(week.weekStart)} - {formatDate(week.weekEnd)}
                                                            </td>
                                                            <td className="py-3 px-4 text-right text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">
                                                                +£{formatCurrency(week.expectedInflows)}
                                                            </td>
                                                            <td className="py-3 px-4 text-right text-sm text-red-600 dark:text-red-400 tabular-nums">
                                                                -£{formatCurrency(week.expectedOutflows)}
                                                            </td>
                                                            <td className={`py-3 px-4 text-right text-sm font-medium tabular-nums ${week.netCashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                                                {week.netCashFlow >= 0 ? '+' : ''}£{formatCurrency(week.netCashFlow)}
                                                            </td>
                                                            <td className={`py-3 px-4 text-right font-bold tabular-nums ${week.isDanger ? 'text-red-600 dark:text-red-400' : ''}`}>
                                                                £{formatCurrency(week.runningBalance)}
                                                                {week.isDanger && <AlertTriangle className="h-4 w-4 inline ml-1 text-red-500" />}
                                                            </td>
                                                            <td className="py-3 px-4 text-center">
                                                                {week.isHistorical ? (
                                                                    <span className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">Pattern</span>
                                                                ) : (
                                                                    <span className="text-xs bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded">Scheduled</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                        {isExpanded && hasDetails && (
                                                            <tr className="bg-zinc-50 dark:bg-zinc-900/50">
                                                                <td colSpan={7} className="py-3 px-4">
                                                                    <div className="grid grid-cols-2 gap-8 ml-6">
                                                                        {/* Inflows */}
                                                                        <div>
                                                                            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-2">INFLOWS</p>
                                                                            {week.sources?.income?.length ? (
                                                                                <ul className="space-y-1">
                                                                                    {week.sources.income.map((s, i) => (
                                                                                        <li key={i} className="flex justify-between text-sm">
                                                                                            <span className="text-muted-foreground">{s.source}</span>
                                                                                            <span className="text-emerald-600 dark:text-emerald-400 tabular-nums">+£{formatCurrency(s.amount)}</span>
                                                                                        </li>
                                                                                    ))}
                                                                                </ul>
                                                                            ) : (
                                                                                <p className="text-xs text-muted-foreground italic">No inflows</p>
                                                                            )}
                                                                        </div>
                                                                        {/* Outflows */}
                                                                        <div>
                                                                            <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2">OUTFLOWS</p>
                                                                            {week.sources?.expenses?.length ? (
                                                                                <ul className="space-y-1">
                                                                                    {week.sources.expenses.map((s, i) => (
                                                                                        <li key={i} className="flex justify-between text-sm">
                                                                                            <span className="text-muted-foreground">{s.source}</span>
                                                                                            <span className="text-red-600 dark:text-red-400 tabular-nums">-£{formatCurrency(s.amount)}</span>
                                                                                        </li>
                                                                                    ))}
                                                                                </ul>
                                                                            ) : (
                                                                                <p className="text-xs text-muted-foreground italic">No outflows</p>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Pattern Insights */}
                    {insights && insights.topIncomeWeeks.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm">Historical Insights</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <p className="text-sm text-muted-foreground mb-2">Average Weekly Income</p>
                                        <p className="text-xl font-bold text-emerald-600">£{formatCurrency(insights.overallStats.avgWeeklyIncome)}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground mb-2">Average Weekly Expenses</p>
                                        <p className="text-xl font-bold text-red-600">£{formatCurrency(insights.overallStats.avgWeeklyExpense)}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground mb-2">Average Weekly Net</p>
                                        <p className={`text-xl font-bold ${insights.overallStats.avgNet >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {insights.overallStats.avgNet >= 0 ? '+' : ''}£{formatCurrency(insights.overallStats.avgNet)}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}

            {/* CALENDAR TAB */}
            {activeTab === 'calendar' && (
                <div className="space-y-4">
                    {/* Calendar Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button onClick={prevMonth} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
                                <ChevronLeft className="h-5 w-5" />
                            </button>
                            <h2 className="text-xl font-bold">
                                {new Date(calendarMonth.year, calendarMonth.month - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                            </h2>
                            <button onClick={nextMonth} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
                                <ChevronRight className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            {pendingChanges.size > 0 && (
                                <>
                                    <span className="text-sm text-amber-600 dark:text-amber-400">
                                        {pendingChanges.size} unsaved change{pendingChanges.size > 1 ? 's' : ''}
                                    </span>
                                    <Button variant="outline" size="sm" onClick={discardChanges}>
                                        <RotateCcw className="h-4 w-4 mr-1" /> Discard
                                    </Button>
                                    <Button size="sm" onClick={handleSaveChanges} disabled={isSavingChanges}>
                                        {isSavingChanges ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                                        Save Changes
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded bg-red-500"></span> Outgoing (Bills/Payables)
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded bg-emerald-500"></span> Incoming (Invoices)
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded border-2 border-dashed border-amber-500"></span> Modified
                        </span>
                    </div>

                    {/* Calendar Grid */}
                    {isLoadingCalendar ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <Card>
                            <CardContent className="p-4">
                                {/* Day Headers */}
                                <div className="grid grid-cols-8 gap-1 mb-2">
                                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Week Total'].map(day => (
                                        <div key={day} className={`text-center text-xs font-semibold py-2 ${day === 'Week Total' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                                            {day}
                                        </div>
                                    ))}
                                </div>

                                {/* Calendar Weeks with Totals */}
                                {(() => {
                                    // Generate weeks matching the forecast table
                                    // Start from the Monday of the week containing the 1st of the month
                                    const firstOfMonth = new Date(calendarMonth.year, calendarMonth.month - 1, 1)
                                    const startDayOfWeek = (firstOfMonth.getDay() + 6) % 7 // Monday = 0
                                    const calendarStart = new Date(firstOfMonth)
                                    calendarStart.setDate(calendarStart.getDate() - startDayOfWeek) // Go back to Monday

                                    // Calculate weeks (usually 5-6 per month view)
                                    const lastOfMonth = new Date(calendarMonth.year, calendarMonth.month, 0)
                                    const endDayOfWeek = (lastOfMonth.getDay() + 6) % 7
                                    const calendarEnd = new Date(lastOfMonth)
                                    calendarEnd.setDate(calendarEnd.getDate() + (6 - endDayOfWeek)) // Extend to Sunday

                                    const weeks: { days: { day: number; month: number; year: number; dateStr: string; isCurrentMonth: boolean }[]; weekDates: string[] }[] = []
                                    const current = new Date(calendarStart)

                                    while (current <= calendarEnd) {
                                        const week: { day: number; month: number; year: number; dateStr: string; isCurrentMonth: boolean }[] = []
                                        const weekDates: string[] = []

                                        for (let i = 0; i < 7; i++) {
                                            const dateStr = current.toISOString().split('T')[0]
                                            week.push({
                                                day: current.getDate(),
                                                month: current.getMonth() + 1,
                                                year: current.getFullYear(),
                                                dateStr,
                                                isCurrentMonth: current.getMonth() + 1 === calendarMonth.month && current.getFullYear() === calendarMonth.year
                                            })
                                            weekDates.push(dateStr)
                                            current.setDate(current.getDate() + 1)
                                        }
                                        weeks.push({ days: week, weekDates })
                                    }

                                    const today = new Date()
                                    today.setHours(0, 0, 0, 0)
                                    const todayStr = today.toISOString().split('T')[0]

                                    // Pre-calculate weekly data with running balance
                                    let runningBalance = currentBalance
                                    const weeklyData = weeks.map((week, weekIndex) => {
                                        const weekPayables = payables.filter(p => week.weekDates.includes(getEffectiveDate(p.id, p.dueDate)) && !p.isPaid)
                                        const weekReceivables = receivables.filter(r => week.weekDates.includes(getEffectiveDate(r.id, r.dueDate)) && !r.isPaid)
                                        const weekOutgoing = weekPayables.reduce((sum, p) => sum + p.amount, 0)
                                        const weekIncoming = weekReceivables.reduce((sum, r) => sum + r.amount, 0)
                                        const weekNet = weekIncoming - weekOutgoing
                                        runningBalance += weekNet
                                        const weekHasFutureDates = week.weekDates.some(d => d >= todayStr)

                                        return {
                                            week,
                                            weekIndex,
                                            weekPayables,
                                            weekOutgoing,
                                            weekIncoming,
                                            weekNet,
                                            balance: runningBalance,
                                            isFuture: weekHasFutureDates || week.weekDates.length === 0
                                        }
                                    })

                                    // Only display future weeks
                                    return weeklyData.filter(w => w.isFuture).map(({ week, weekIndex, weekOutgoing, weekIncoming, weekNet, balance }) => (
                                        <div key={weekIndex} className="grid grid-cols-8 gap-1 mb-1">
                                            {/* 7 Day Cells */}
                                            {week.days.map((dayInfo, dayIndex) => {
                                                const dayPayables = payables.filter(p => getEffectiveDate(p.id, p.dueDate) === dayInfo.dateStr)

                                                return (
                                                    <div
                                                        key={dayInfo.dateStr}
                                                        className={`min-h-[100px] border rounded p-1 transition-colors ${dayInfo.isCurrentMonth
                                                                ? 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                                                                : 'border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30'
                                                            }`}
                                                        onDragOver={(e) => e.preventDefault()}
                                                        onDrop={() => handleDrop(dayInfo.dateStr)}
                                                    >
                                                        <div className={`text-xs font-medium mb-1 ${dayInfo.isCurrentMonth ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>
                                                            {!dayInfo.isCurrentMonth && dayInfo.day === 1 ? `${dayInfo.month === 1 ? 'Jan' : dayInfo.month === 2 ? 'Feb' : dayInfo.month === 3 ? 'Mar' : dayInfo.month === 4 ? 'Apr' : dayInfo.month === 5 ? 'May' : dayInfo.month === 6 ? 'Jun' : dayInfo.month === 7 ? 'Jul' : dayInfo.month === 8 ? 'Aug' : dayInfo.month === 9 ? 'Sep' : dayInfo.month === 10 ? 'Oct' : dayInfo.month === 11 ? 'Nov' : 'Dec'} ` : ''}{dayInfo.day}
                                                        </div>
                                                        <div className="space-y-1">
                                                            {dayPayables.map(p => {
                                                                const hasChange = pendingChanges.has(p.id)
                                                                return (
                                                                    <div
                                                                        key={p.id}
                                                                        draggable
                                                                        onDragStart={() => setDraggedItem({ id: p.id, type: 'payable' })}
                                                                        onDragEnd={() => setDraggedItem(null)}
                                                                        className={`text-[10px] p-1 rounded cursor-move truncate ${p.isPaid
                                                                            ? 'bg-zinc-300 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 line-through'
                                                                            : hasChange
                                                                                ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border border-dashed border-amber-500'
                                                                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                                                            }`}
                                                                        title={`${p.name} - £${p.amount.toFixed(2)}${p.vendorName ? ` (${p.vendorName})` : ''}`}
                                                                    >
                                                                        <span className="font-medium">-£{p.amount.toFixed(0)}</span> {p.name.substring(0, 12)}
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                )
                                            })}

                                            {/* Weekly Summary Column */}
                                            <div className="min-h-[100px] bg-gradient-to-r from-zinc-100 to-zinc-50 dark:from-zinc-800 dark:to-zinc-900 rounded p-2 flex flex-col justify-center">
                                                <div className="text-[10px] text-muted-foreground mb-1">W{weekIndex + 1}</div>
                                                <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
                                                    In: +£{formatCurrency(weekIncoming)}
                                                </div>
                                                <div className="text-[10px] text-red-600 dark:text-red-400">
                                                    Out: -£{formatCurrency(weekOutgoing)}
                                                </div>
                                                <div className={`text-[10px] ${weekNet >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                                                    Net: {weekNet >= 0 ? '+' : ''}£{formatCurrency(weekNet)}
                                                </div>
                                                <div className={`text-xs font-bold mt-1 pt-1 border-t border-zinc-300 dark:border-zinc-700 ${balance >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                                                    £{formatCurrency(balance)}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                })()}
                            </CardContent>
                        </Card>
                    )}

                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-4">
                        <Card>
                            <CardContent className="pt-4">
                                <p className="text-sm text-muted-foreground">Total Outgoing</p>
                                <p className="text-xl font-bold text-red-600">
                                    £{formatCurrency(payables.filter(p => !p.isPaid).reduce((sum, p) => sum + p.amount, 0))}
                                </p>
                                <p className="text-xs text-muted-foreground">{payables.filter(p => !p.isPaid).length} bills</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-4">
                                <p className="text-sm text-muted-foreground">Total Incoming</p>
                                <p className="text-xl font-bold text-emerald-600">
                                    £{formatCurrency(receivables.filter(r => !r.isPaid).reduce((sum, r) => sum + r.amount, 0))}
                                </p>
                                <p className="text-xs text-muted-foreground">{receivables.filter(r => !r.isPaid).length} invoices</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-4">
                                <p className="text-sm text-muted-foreground">Net Cash Flow</p>
                                {(() => {
                                    const incoming = receivables.filter(r => !r.isPaid).reduce((sum, r) => sum + r.amount, 0)
                                    const outgoing = payables.filter(p => !p.isPaid).reduce((sum, p) => sum + p.amount, 0)
                                    const net = incoming - outgoing
                                    return (
                                        <>
                                            <p className={`text-xl font-bold ${net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {net >= 0 ? '+' : ''}£{formatCurrency(net)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">for this month</p>
                                        </>
                                    )
                                })()}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )
            }
        </div >
    )
}
