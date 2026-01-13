'use client'

import { useState, useCallback, useEffect } from 'react'
import { ChevronDown, ChevronRight, Loader2, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    getBudgetEditorHierarchy,
    getMonthlyBudgetData,
    getLiveActuals,
    BudgetScenario,
    EditorClass,
    MonthlyBudgetRow,
    ActualsByMonth
} from '@/lib/actions/budget'
import { formatCurrency, getQuarterMonthNames } from '../utils'

interface BudgetTrackingTabProps {
    scenario: BudgetScenario
    year: number
}

export function BudgetTrackingTab({ scenario, year }: BudgetTrackingTabProps) {
    const [selectedQuarter, setSelectedQuarter] = useState<1 | 2 | 3 | 4>(1)
    const [selectedMonth, setSelectedMonth] = useState<null | 1 | 2 | 3>(null)
    const [editorHierarchy, setEditorHierarchy] = useState<EditorClass[]>([])
    const [monthlyData, setMonthlyData] = useState<MonthlyBudgetRow[]>([])
    const [liveActuals, setLiveActuals] = useState<ActualsByMonth>({})
    const [isLoading, setIsLoading] = useState(true)

    // Expand/collapse state
    const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set())
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

    const quarterMonths = selectedQuarter === 1 ? [1, 2, 3]
        : selectedQuarter === 2 ? [4, 5, 6]
            : selectedQuarter === 3 ? [7, 8, 9]
                : [10, 11, 12]

    const monthNames = getQuarterMonthNames(selectedQuarter)

    // Fetch data
    const fetchData = useCallback(async () => {
        setIsLoading(true)
        const [hierarchy, monthly, actuals] = await Promise.all([
            getBudgetEditorHierarchy(scenario.id),
            getMonthlyBudgetData(scenario.id, selectedQuarter),
            getLiveActuals(year, quarterMonths)
        ])

        const sorted = [...hierarchy].sort((a, b) => a.code === 'REVENUE' ? -1 : b.code === 'REVENUE' ? 1 : 0)
        setEditorHierarchy(sorted)
        setExpandedClasses(new Set(sorted.map(c => c.id)))
        setExpandedGroups(new Set(sorted.flatMap(c => c.categoryGroups.map(g => g.id))))
        setMonthlyData(monthly)
        setLiveActuals(actuals)
        setIsLoading(false)
    }, [scenario.id, selectedQuarter, quarterMonths, year])

    useEffect(() => { fetchData() }, [fetchData])

    // Helper: Get values for a category
    const getCategoryValues = (categoryId: string) => {
        const row = monthlyData.find(r => r.categoryId === categoryId)
        const actuals = liveActuals[categoryId] || {}

        let budget: number, actual: number
        if (selectedMonth === null) {
            budget = row?.qTotal || 0
            actual = quarterMonths.reduce((sum, m) => sum + (actuals[m] || 0), 0)
        } else {
            const monthBudgets = [row?.month1Budget || 0, row?.month2Budget || 0, row?.month3Budget || 0]
            budget = monthBudgets[selectedMonth - 1]
            actual = actuals[quarterMonths[selectedMonth - 1]] || 0
        }

        return { budget, actual, remaining: budget - actual }
    }

    // Helper: Calculate group totals
    const getGroupTotals = (subCategories: EditorClass['categoryGroups'][0]['subCategories']) => {
        return subCategories.reduce((acc, sub) => {
            const vals = getCategoryValues(sub.id)
            return { budget: acc.budget + vals.budget, actual: acc.actual + vals.actual, remaining: acc.remaining + vals.remaining }
        }, { budget: 0, actual: 0, remaining: 0 })
    }

    // Helper: Calculate class totals
    const getClassTotals = (groups: EditorClass['categoryGroups']) => {
        return groups.reduce((acc, group) => {
            const vals = getGroupTotals(group.subCategories)
            return { budget: acc.budget + vals.budget, actual: acc.actual + vals.actual, remaining: acc.remaining + vals.remaining }
        }, { budget: 0, actual: 0, remaining: 0 })
    }

    // Grand totals for P&L summary
    const grandTotals = editorHierarchy.reduce((acc, cls) => {
        const vals = getClassTotals(cls.categoryGroups)
        if (cls.code === 'REVENUE') {
            return { ...acc, income: vals.budget, incomeActual: vals.actual }
        } else {
            return { ...acc, expenses: acc.expenses + vals.budget, expensesActual: acc.expensesActual + vals.actual }
        }
    }, { income: 0, incomeActual: 0, expenses: 0, expensesActual: 0 })

    return (
        <div className="space-y-6">
            {/* Header & Quarter Selector */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-bold">Budget vs Actual Tracking</h2>
                        <p className="text-xs text-muted-foreground">Monitor {scenario.name} performance for {year}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {([1, 2, 3, 4] as const).map(q => (
                            <button
                                key={q}
                                onClick={() => { setSelectedQuarter(q); setSelectedMonth(null) }}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${selectedQuarter === q
                                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                Q{q}
                            </button>
                        ))}
                        <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
                            <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>

                {/* Month Selector */}
                <div className="flex items-center gap-2 py-2 px-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                    <span className="text-xs text-muted-foreground mr-2">View:</span>
                    <button
                        onClick={() => setSelectedMonth(null)}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${selectedMonth === null
                            ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-muted-foreground hover:text-foreground'}`}
                    >
                        All Q{selectedQuarter}
                    </button>
                    {([1, 2, 3] as const).map(m => (
                        <button
                            key={m}
                            onClick={() => setSelectedMonth(m)}
                            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${selectedMonth === m
                                ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-muted-foreground hover:text-foreground'}`}
                        >
                            {monthNames[m - 1]}
                        </button>
                    ))}
                </div>
            </div>

            {/* P&L Summary */}
            <div className="px-4 py-3 bg-gradient-to-r from-zinc-100 to-zinc-50 dark:from-zinc-800 dark:to-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                        {selectedMonth ? monthNames[selectedMonth - 1] : `Q${selectedQuarter}`} Summary
                    </span>
                    <div className="flex items-center gap-6 text-sm">
                        <div>
                            <span className="text-muted-foreground mr-2">Income:</span>
                            <span className="font-bold tabular-nums text-emerald-600">
                                £{formatCurrency(grandTotals.incomeActual)}
                                <span className="text-xs ml-1 opacity-70">/ £{formatCurrency(grandTotals.income)}</span>
                            </span>
                        </div>
                        <div>
                            <span className="text-muted-foreground mr-2">Expenses:</span>
                            <span className="font-bold tabular-nums text-red-600">
                                £{formatCurrency(grandTotals.expensesActual)}
                                <span className="text-xs ml-1 opacity-70">/ £{formatCurrency(grandTotals.expenses)}</span>
                            </span>
                        </div>
                        <div>
                            <span className="text-muted-foreground mr-2">Net:</span>
                            <span className={`font-bold tabular-nums ${(grandTotals.incomeActual - grandTotals.expensesActual) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                £{formatCurrency(grandTotals.incomeActual - grandTotals.expensesActual)}
                                <span className="text-xs ml-1 opacity-70">/ £{formatCurrency(grandTotals.income - grandTotals.expenses)}</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tracking Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[1fr_100px_100px_100px] gap-2 px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 text-xs font-semibold text-muted-foreground border-b border-zinc-200 dark:border-zinc-800">
                    <div>Category</div>
                    <div className="text-right">Budget</div>
                    <div className="text-right">Actual</div>
                    <div className="text-right">Remaining</div>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="max-h-[500px] overflow-y-auto">
                        {editorHierarchy.map(cls => {
                            const isExpanded = expandedClasses.has(cls.id)
                            const classTotals = getClassTotals(cls.categoryGroups)
                            const isIncome = cls.code === 'REVENUE'

                            return (
                                <div key={cls.id} className="border-b border-zinc-200 dark:border-zinc-700 last:border-b-0">
                                    {/* Class Row */}
                                    <button
                                        onClick={() => {
                                            const set = new Set(expandedClasses)
                                            isExpanded ? set.delete(cls.id) : set.add(cls.id)
                                            setExpandedClasses(set)
                                        }}
                                        className={`w-full grid grid-cols-[1fr_100px_100px_100px] gap-2 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/30 ${isIncome ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : ''}`}
                                    >
                                        <div className="flex items-center gap-2 font-bold">
                                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                            {cls.name}
                                        </div>
                                        <div className="text-right text-xs tabular-nums font-bold">£{formatCurrency(classTotals.budget)}</div>
                                        <div className="text-right text-xs tabular-nums font-semibold text-blue-600">£{formatCurrency(classTotals.actual)}</div>
                                        <div className={`text-right text-xs tabular-nums font-bold ${classTotals.remaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                            £{formatCurrency(classTotals.remaining)}
                                            <span className="ml-1 opacity-70">({classTotals.budget > 0 ? Math.round((classTotals.remaining / classTotals.budget) * 100) : 0}%)</span>
                                        </div>
                                    </button>

                                    {/* Groups */}
                                    {isExpanded && cls.categoryGroups.map(group => {
                                        const isGroupExpanded = expandedGroups.has(group.id)
                                        const groupTotals = getGroupTotals(group.subCategories)

                                        return (
                                            <div key={group.id}>
                                                <button
                                                    onClick={() => {
                                                        const set = new Set(expandedGroups)
                                                        isGroupExpanded ? set.delete(group.id) : set.add(group.id)
                                                        setExpandedGroups(set)
                                                    }}
                                                    className="w-full grid grid-cols-[1fr_100px_100px_100px] gap-2 px-4 py-2 pl-8 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/30 border-t border-zinc-100 dark:border-zinc-800"
                                                >
                                                    <div className="flex items-center gap-2 font-medium text-sm">
                                                        {group.subCategories.length > 0 ? (
                                                            isGroupExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
                                                        ) : <span className="w-3" />}
                                                        {group.name}
                                                    </div>
                                                    <div className="text-right text-xs tabular-nums font-semibold">£{formatCurrency(groupTotals.budget)}</div>
                                                    <div className="text-right text-xs tabular-nums text-blue-600">£{formatCurrency(groupTotals.actual)}</div>
                                                    <div className={`text-right text-xs tabular-nums font-semibold ${groupTotals.remaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                        £{formatCurrency(groupTotals.remaining)}
                                                    </div>
                                                </button>

                                                {/* Subcategories */}
                                                {isGroupExpanded && group.subCategories.map(sub => {
                                                    const vals = getCategoryValues(sub.id)
                                                    return (
                                                        <div
                                                            key={sub.id}
                                                            className="grid grid-cols-[1fr_100px_100px_100px] gap-2 px-4 py-2 pl-14 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800"
                                                        >
                                                            <div className="text-sm text-muted-foreground">{sub.name}</div>
                                                            <div className="text-right text-xs tabular-nums">£{formatCurrency(vals.budget)}</div>
                                                            <div className="text-right text-xs tabular-nums text-blue-600">£{formatCurrency(vals.actual)}</div>
                                                            <div className={`text-right text-xs tabular-nums ${vals.remaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                                £{formatCurrency(vals.remaining)}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )
                                    })}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
