'use client'

import { useState, useCallback, useEffect } from 'react'
import { ChevronDown, ChevronRight, Loader2, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    getBudgetEditorHierarchy,
    getMonthlyBudgetData,
    getLiveActuals,
    updateMonthlyBudget,
    EditorClass,
    MonthlyBudgetRow,
    ActualsByMonth
} from '@/lib/actions/budget'
import { formatCurrency, getQuarterMonthNames } from '../utils'

interface MonthlyBudgetEditorProps {
    scenarioId: string
    year: number
    yearlyConfirmed: boolean
}

export function MonthlyBudgetEditor({ scenarioId, year, yearlyConfirmed }: MonthlyBudgetEditorProps) {
    const [selectedQuarter, setSelectedQuarter] = useState<1 | 2 | 3 | 4>(1)
    const [selectedMonth, setSelectedMonth] = useState<null | 1 | 2 | 3>(null) // null = show all 3 months
    const [editorHierarchy, setEditorHierarchy] = useState<EditorClass[]>([])
    const [monthlyData, setMonthlyData] = useState<MonthlyBudgetRow[]>([])
    const [liveActuals, setLiveActuals] = useState<ActualsByMonth>({})
    const [isLoading, setIsLoading] = useState(true)

    const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set())
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

    const [editingCell, setEditingCell] = useState<string | null>(null)
    const [editValue, setEditValue] = useState('')
    const [saving, setSaving] = useState<string | null>(null)

    const quarterMonths = selectedQuarter === 1 ? [1, 2, 3]
        : selectedQuarter === 2 ? [4, 5, 6]
            : selectedQuarter === 3 ? [7, 8, 9]
                : [10, 11, 12]

    const monthNames = getQuarterMonthNames(selectedQuarter)

    const fetchData = useCallback(async () => {
        setIsLoading(true)
        const qMonths = selectedQuarter === 1 ? [1, 2, 3]
            : selectedQuarter === 2 ? [4, 5, 6]
                : selectedQuarter === 3 ? [7, 8, 9]
                    : [10, 11, 12]
        const [hierarchy, monthly, actuals] = await Promise.all([
            getBudgetEditorHierarchy(scenarioId),
            getMonthlyBudgetData(scenarioId, selectedQuarter),
            getLiveActuals(year, qMonths)
        ])
        const sorted = [...hierarchy].sort((a, b) => a.code === 'REVENUE' ? -1 : b.code === 'REVENUE' ? 1 : 0)
        setEditorHierarchy(sorted)
        setExpandedClasses(new Set(sorted.map(c => c.id)))
        setExpandedGroups(new Set(sorted.flatMap(c => c.categoryGroups.map(g => g.id))))
        setMonthlyData(monthly)
        setLiveActuals(actuals)
        setIsLoading(false)
    }, [scenarioId, selectedQuarter, year])

    useEffect(() => { fetchData() }, [fetchData])

    // Get monthly values for a category
    const getMonthlyValues = (categoryId: string) => {
        const row = monthlyData.find(r => r.categoryId === categoryId)
        const actuals = liveActuals[categoryId] || {}
        return {
            m1Budget: row?.month1Budget || 0,
            m2Budget: row?.month2Budget || 0,
            m3Budget: row?.month3Budget || 0,
            m1Actual: actuals[quarterMonths[0]] || 0,
            m2Actual: actuals[quarterMonths[1]] || 0,
            m3Actual: actuals[quarterMonths[2]] || 0,
            qTotal: row?.qTotal || 0,
            qActual: quarterMonths.reduce((sum, m) => sum + (actuals[m] || 0), 0)
        }
    }

    // Get single month values
    const getSingleMonthValues = (categoryId: string, monthInQuarter: 1 | 2 | 3) => {
        const vals = getMonthlyValues(categoryId)
        const budget = monthInQuarter === 1 ? vals.m1Budget : monthInQuarter === 2 ? vals.m2Budget : vals.m3Budget
        const actual = monthInQuarter === 1 ? vals.m1Actual : monthInQuarter === 2 ? vals.m2Actual : vals.m3Actual
        return { budget, actual, variance: budget - actual }
    }

    // Group totals for single month
    const getGroupMonthTotals = (subs: EditorClass['categoryGroups'][0]['subCategories'], monthInQuarter: 1 | 2 | 3) => {
        return subs.reduce((acc, sub) => {
            const v = getSingleMonthValues(sub.id, monthInQuarter)
            return { budget: acc.budget + v.budget, actual: acc.actual + v.actual, variance: acc.variance + v.variance }
        }, { budget: 0, actual: 0, variance: 0 })
    }

    // Class totals for single month
    const getClassMonthTotals = (groups: EditorClass['categoryGroups'], monthInQuarter: 1 | 2 | 3) => {
        return groups.reduce((acc, g) => {
            const v = getGroupMonthTotals(g.subCategories, monthInQuarter)
            return { budget: acc.budget + v.budget, actual: acc.actual + v.actual, variance: acc.variance + v.variance }
        }, { budget: 0, actual: 0, variance: 0 })
    }

    // Group totals for quarter view
    const getGroupTotals = (subs: EditorClass['categoryGroups'][0]['subCategories']) => {
        return subs.reduce((acc, sub) => {
            const v = getMonthlyValues(sub.id)
            return {
                m1Budget: acc.m1Budget + v.m1Budget, m2Budget: acc.m2Budget + v.m2Budget, m3Budget: acc.m3Budget + v.m3Budget,
                qTotal: acc.qTotal + v.qTotal
            }
        }, { m1Budget: 0, m2Budget: 0, m3Budget: 0, qTotal: 0 })
    }

    // Class totals for quarter view
    const getClassTotals = (groups: EditorClass['categoryGroups']) => {
        return groups.reduce((acc, g) => {
            const v = getGroupTotals(g.subCategories)
            return {
                m1Budget: acc.m1Budget + v.m1Budget, m2Budget: acc.m2Budget + v.m2Budget, m3Budget: acc.m3Budget + v.m3Budget,
                qTotal: acc.qTotal + v.qTotal
            }
        }, { m1Budget: 0, m2Budget: 0, m3Budget: 0, qTotal: 0 })
    }

    // Save monthly budget
    const handleSave = async (categoryId: string, monthInQuarter: 1 | 2 | 3, value: number) => {
        const actualMonth = quarterMonths[monthInQuarter - 1]
        setSaving(`${categoryId}-${monthInQuarter}`)
        await updateMonthlyBudget(scenarioId, categoryId, actualMonth, value)
        await fetchData()
        setSaving(null)
        setEditingCell(null)
    }

    // Editable budget cell - click to edit, no icon
    const EditableBudgetCell = ({ categoryId, monthInQuarter, value }: { categoryId: string, monthInQuarter: 1 | 2 | 3, value: number }) => {
        const cellId = `${categoryId}-m${monthInQuarter}`
        const isSaving = saving === `${categoryId}-${monthInQuarter}`
        const isEditing = editingCell === cellId

        if (isSaving) return <Loader2 className="h-3 w-3 animate-spin inline" />

        if (isEditing) {
            return (
                <input
                    type="number"
                    autoFocus
                    className="w-20 h-6 px-2 text-right text-xs tabular-nums border border-blue-500 rounded bg-white dark:bg-zinc-800 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSave(categoryId, monthInQuarter, parseFloat(editValue) || 0)
                        else if (e.key === 'Escape') setEditingCell(null)
                    }}
                    onBlur={() => handleSave(categoryId, monthInQuarter, parseFloat(editValue) || 0)}
                />
            )
        }

        return (
            <span
                onClick={() => { setEditingCell(cellId); setEditValue(value.toString()) }}
                className="px-1 py-0.5 rounded tabular-nums hover:bg-blue-100 dark:hover:bg-blue-900/30 cursor-pointer"
            >
                £{formatCurrency(value)}
            </span>
        )
    }

    // Variance display with color coding
    const VarianceCell = ({ variance, isIncome }: { variance: number, isIncome: boolean }) => {
        // For expenses: positive variance (under budget) is good
        // For income: positive variance (over target) is good
        const isGood = isIncome ? variance >= 0 : variance >= 0
        return (
            <span className={`tabular-nums ${isGood ? 'text-emerald-600' : 'text-red-600'}`}>
                {variance >= 0 ? '+' : ''}£{formatCurrency(Math.abs(variance))}
            </span>
        )
    }

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <div>
                    <h3 className="font-bold">Q{selectedQuarter} Monthly Budget</h3>
                    <p className="text-xs text-muted-foreground">
                        {yearlyConfirmed ? 'Click budget cells to edit' : 'Confirm yearly budget to enable editing'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
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

            {/* Month Selector Row */}
            <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
                <div className="flex items-center gap-2">
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

            {/* Table Header - changes based on view */}
            {selectedMonth === null ? (
                // Quarter view header
                <div className="grid grid-cols-[1fr_80px_80px_80px_100px] gap-2 px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 text-xs font-semibold text-muted-foreground border-b border-zinc-200 dark:border-zinc-800">
                    <div>Category</div>
                    <div className="text-right">{monthNames[0]}</div>
                    <div className="text-right">{monthNames[1]}</div>
                    <div className="text-right">{monthNames[2]}</div>
                    <div className="text-right">Q{selectedQuarter} Total</div>
                </div>
            ) : (
                // Single month view header
                <div className="grid grid-cols-[1fr_100px_100px_100px] gap-2 px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 text-xs font-semibold text-muted-foreground border-b border-zinc-200 dark:border-zinc-800">
                    <div>Category</div>
                    <div className="text-right">Budget</div>
                    <div className="text-right">Actual</div>
                    <div className="text-right">Variance</div>
                </div>
            )}

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <div className="max-h-[500px] overflow-y-auto">
                    {editorHierarchy.map(cls => {
                        const isExpanded = expandedClasses.has(cls.id)
                        const isIncome = cls.code === 'REVENUE'

                        return (
                            <div key={cls.id} className="border-b border-zinc-200 dark:border-zinc-700 last:border-b-0">
                                {/* Class Row */}
                                {selectedMonth === null ? (
                                    // Quarter view - class row
                                    <button
                                        onClick={() => {
                                            const set = new Set(expandedClasses)
                                            isExpanded ? set.delete(cls.id) : set.add(cls.id)
                                            setExpandedClasses(set)
                                        }}
                                        className={`w-full grid grid-cols-[1fr_80px_80px_80px_100px] gap-2 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/30 ${isIncome ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : ''}`}
                                    >
                                        <div className="flex items-center gap-2 font-bold">
                                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                            {cls.name}
                                        </div>
                                        {(() => {
                                            const totals = getClassTotals(cls.categoryGroups)
                                            return (
                                                <>
                                                    <div className="text-right text-xs tabular-nums font-semibold">£{formatCurrency(totals.m1Budget)}</div>
                                                    <div className="text-right text-xs tabular-nums font-semibold">£{formatCurrency(totals.m2Budget)}</div>
                                                    <div className="text-right text-xs tabular-nums font-semibold">£{formatCurrency(totals.m3Budget)}</div>
                                                    <div className="text-right text-xs tabular-nums font-bold">£{formatCurrency(totals.qTotal)}</div>
                                                </>
                                            )
                                        })()}
                                    </button>
                                ) : (
                                    // Single month view - class row
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
                                        {(() => {
                                            const totals = getClassMonthTotals(cls.categoryGroups, selectedMonth)
                                            return (
                                                <>
                                                    <div className="text-right text-xs tabular-nums font-bold">£{formatCurrency(totals.budget)}</div>
                                                    <div className="text-right text-xs tabular-nums font-semibold text-blue-600">£{formatCurrency(totals.actual)}</div>
                                                    <div className="text-right text-xs font-bold"><VarianceCell variance={totals.variance} isIncome={isIncome} /></div>
                                                </>
                                            )
                                        })()}
                                    </button>
                                )}

                                {/* Groups */}
                                {isExpanded && cls.categoryGroups.map(group => {
                                    const isGroupExpanded = expandedGroups.has(group.id)

                                    return (
                                        <div key={group.id}>
                                            {selectedMonth === null ? (
                                                // Quarter view - group row
                                                <button
                                                    onClick={() => {
                                                        const set = new Set(expandedGroups)
                                                        isGroupExpanded ? set.delete(group.id) : set.add(group.id)
                                                        setExpandedGroups(set)
                                                    }}
                                                    className="w-full grid grid-cols-[1fr_80px_80px_80px_100px] gap-2 px-4 py-2 pl-8 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/30 border-t border-zinc-100 dark:border-zinc-800"
                                                >
                                                    <div className="flex items-center gap-2 font-medium text-sm">
                                                        {group.subCategories.length > 0 ? (
                                                            isGroupExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
                                                        ) : <span className="w-3" />}
                                                        {group.name}
                                                    </div>
                                                    {(() => {
                                                        const gTotals = getGroupTotals(group.subCategories)
                                                        return (
                                                            <>
                                                                <div className="text-right text-xs tabular-nums">£{formatCurrency(gTotals.m1Budget)}</div>
                                                                <div className="text-right text-xs tabular-nums">£{formatCurrency(gTotals.m2Budget)}</div>
                                                                <div className="text-right text-xs tabular-nums">£{formatCurrency(gTotals.m3Budget)}</div>
                                                                <div className="text-right text-xs tabular-nums font-semibold">£{formatCurrency(gTotals.qTotal)}</div>
                                                            </>
                                                        )
                                                    })()}
                                                </button>
                                            ) : (
                                                // Single month view - group row
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
                                                    {(() => {
                                                        const gTotals = getGroupMonthTotals(group.subCategories, selectedMonth)
                                                        return (
                                                            <>
                                                                <div className="text-right text-xs tabular-nums font-semibold">£{formatCurrency(gTotals.budget)}</div>
                                                                <div className="text-right text-xs tabular-nums text-blue-600">£{formatCurrency(gTotals.actual)}</div>
                                                                <div className="text-right text-xs font-semibold"><VarianceCell variance={gTotals.variance} isIncome={isIncome} /></div>
                                                            </>
                                                        )
                                                    })()}
                                                </button>
                                            )}

                                            {/* Subcategories */}
                                            {isGroupExpanded && group.subCategories.map(sub => {
                                                if (selectedMonth === null) {
                                                    // Quarter view
                                                    const vals = getMonthlyValues(sub.id)
                                                    return (
                                                        <div
                                                            key={sub.id}
                                                            className="grid grid-cols-[1fr_80px_80px_80px_100px] gap-2 px-4 py-2 pl-14 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800"
                                                        >
                                                            <div className="text-sm text-muted-foreground">{sub.name}</div>
                                                            <div className="text-right text-xs" onClick={e => e.stopPropagation()}>
                                                                <EditableBudgetCell categoryId={sub.id} monthInQuarter={1} value={vals.m1Budget} />
                                                            </div>
                                                            <div className="text-right text-xs" onClick={e => e.stopPropagation()}>
                                                                <EditableBudgetCell categoryId={sub.id} monthInQuarter={2} value={vals.m2Budget} />
                                                            </div>
                                                            <div className="text-right text-xs" onClick={e => e.stopPropagation()}>
                                                                <EditableBudgetCell categoryId={sub.id} monthInQuarter={3} value={vals.m3Budget} />
                                                            </div>
                                                            <div className="text-right text-xs tabular-nums font-medium">
                                                                £{formatCurrency(vals.qTotal)}
                                                            </div>
                                                        </div>
                                                    )
                                                } else {
                                                    // Single month view
                                                    const vals = getSingleMonthValues(sub.id, selectedMonth)
                                                    return (
                                                        <div
                                                            key={sub.id}
                                                            className="grid grid-cols-[1fr_100px_100px_100px] gap-2 px-4 py-2 pl-14 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800"
                                                        >
                                                            <div className="text-sm text-muted-foreground">{sub.name}</div>
                                                            <div className="text-right text-xs" onClick={e => e.stopPropagation()}>
                                                                <EditableBudgetCell categoryId={sub.id} monthInQuarter={selectedMonth} value={vals.budget} />
                                                            </div>
                                                            <div className="text-right text-xs tabular-nums text-blue-600">
                                                                £{formatCurrency(vals.actual)}
                                                            </div>
                                                            <div className="text-right text-xs">
                                                                <VarianceCell variance={vals.variance} isIncome={isIncome} />
                                                            </div>
                                                        </div>
                                                    )
                                                }
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
    )
}
