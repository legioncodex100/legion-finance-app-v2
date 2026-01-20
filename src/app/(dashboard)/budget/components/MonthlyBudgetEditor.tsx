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
        return (
            <span className={`tabular-nums ${variance >= 0 ? 'text-success' : 'text-destructive'}`}>
                {variance >= 0 ? '+' : ''}£{formatCurrency(Math.abs(variance))}
            </span>
        )
    }

    // Unified Row Renderer
    const BudgetRow = ({
        label,
        depth = 0,
        isExpanded,
        onExpand,
        hasChildren,
        isIncome,
        renderCells
    }: {
        label: React.ReactNode,
        depth?: number,
        isExpanded?: boolean,
        onExpand?: () => void,
        hasChildren?: boolean,
        isIncome?: boolean,
        renderCells: () => React.ReactNode
    }) => {
        const paddingLeft = depth === 0 ? 'px-4' : depth === 1 ? 'pl-8' : 'pl-14'
        const bgClass = depth === 0
            ? 'bg-card hover:bg-muted/50'
            : 'hover:bg-muted/30'

        const stickyBg = depth === 0
            ? 'bg-card group-hover:bg-muted/50'
            : 'bg-card group-hover:bg-muted/30'

        // Use inline styles to ensure grid works regardless of Tailwind parsing
        const gridTemplate = selectedMonth === null
            ? '1fr 80px 80px 80px 100px'
            : '1fr 100px 100px 100px'

        const textSize = depth === 0 ? 'text-base' : 'text-sm'

        const content = (
            <>
                <div className={`flex items-center gap-2 font-medium ${textSize} sticky left-0 z-10 ${stickyBg} pr-2 transition-colors`}>
                    {hasChildren ? (
                        isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
                    ) : <span className="w-3.5" />}
                    {label}
                </div>
                {renderCells()}
            </>
        )

        if (onExpand) {
            return (
                <button
                    onClick={onExpand}
                    className={`w-full grid gap-2 ${paddingLeft} py-3 text-left border-b border-border last:border-b-0 transition-colors group ${bgClass} min-w-[600px]`}
                    style={{ gridTemplateColumns: gridTemplate }}
                >
                    {content}
                </button>
            )
        }

        return (
            <div
                className={`grid gap-2 ${paddingLeft} py-2 border-b border-border last:border-b-0 group ${bgClass} min-w-[600px]`}
                style={{ gridTemplateColumns: gridTemplate }}
            >
                {content}
            </div>
        )
    }

    return (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
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
                                ? 'bg-foreground text-background'
                                : 'bg-muted text-muted-foreground hover:text-foreground'
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
            <div className="px-4 py-2 border-b border-border bg-muted/50">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground mr-2">View:</span>
                    <button
                        onClick={() => setSelectedMonth(null)}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${selectedMonth === null
                            ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                    >
                        All Q{selectedQuarter}
                    </button>
                    {([1, 2, 3] as const).map(m => (
                        <button
                            key={m}
                            onClick={() => setSelectedMonth(m)}
                            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${selectedMonth === m
                                ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                        >
                            {monthNames[m - 1]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table Header */}
            <div className="overflow-x-auto">
                <div
                    className="grid gap-2 px-4 py-2 bg-card text-xs font-semibold text-muted-foreground border-b border-border min-w-[600px]"
                    style={{ gridTemplateColumns: selectedMonth === null ? '1fr 80px 80px 80px 100px' : '1fr 100px 100px 100px' }}
                >
                    <div className="sticky left-0 z-10 bg-card">Category</div>
                    {selectedMonth === null ? (
                        <>
                            <div className="text-right">{monthNames[0]}</div>
                            <div className="text-right">{monthNames[1]}</div>
                            <div className="text-right">{monthNames[2]}</div>
                            <div className="text-right">Q{selectedQuarter} Total</div>
                        </>
                    ) : (
                        <>
                            <div className="text-right">Budget</div>
                            <div className="text-right">Actual</div>
                            <div className="text-right pr-4">Variance</div>
                        </>
                    )}
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
                        {editorHierarchy.map(cls => {
                            const isExpanded = expandedClasses.has(cls.id)
                            const isIncome = cls.code === 'REVENUE'

                            return (
                                <div key={cls.id} className="border-b border-border last:border-b-0 min-w-[600px]">
                                    {/* Class Row */}
                                    <BudgetRow
                                        label={cls.name}
                                        depth={0}
                                        isExpanded={isExpanded}
                                        onExpand={() => {
                                            const set = new Set(expandedClasses)
                                            isExpanded ? set.delete(cls.id) : set.add(cls.id)
                                            setExpandedClasses(set)
                                        }}
                                        hasChildren={true}
                                        isIncome={isIncome}
                                        renderCells={() => {
                                            if (selectedMonth === null) {
                                                const totals = getClassTotals(cls.categoryGroups)
                                                return (
                                                    <>
                                                        <div className="text-right text-xs tabular-nums font-semibold">£{formatCurrency(totals.m1Budget)}</div>
                                                        <div className="text-right text-xs tabular-nums font-semibold">£{formatCurrency(totals.m2Budget)}</div>
                                                        <div className="text-right text-xs tabular-nums font-semibold">£{formatCurrency(totals.m3Budget)}</div>
                                                        <div className="text-right text-xs tabular-nums font-bold">£{formatCurrency(totals.qTotal)}</div>
                                                    </>
                                                )
                                            } else {
                                                const totals = getClassMonthTotals(cls.categoryGroups, selectedMonth)
                                                return (
                                                    <>
                                                        <div className="text-right text-xs tabular-nums font-bold">£{formatCurrency(totals.budget)}</div>
                                                        <div className="text-right text-xs tabular-nums font-semibold text-info">£{formatCurrency(totals.actual)}</div>
                                                        <div className="text-right text-xs font-bold pr-4"><VarianceCell variance={totals.variance} isIncome={isIncome} /></div>
                                                    </>
                                                )
                                            }
                                        }}
                                    />

                                    {/* Groups */}
                                    {isExpanded && cls.categoryGroups.map(group => {
                                        const isGroupExpanded = expandedGroups.has(group.id)

                                        return (
                                            <div key={group.id}>
                                                <BudgetRow
                                                    label={group.name}
                                                    depth={1}
                                                    isExpanded={isGroupExpanded}
                                                    onExpand={() => {
                                                        const set = new Set(expandedGroups)
                                                        isGroupExpanded ? set.delete(group.id) : set.add(group.id)
                                                        setExpandedGroups(set)
                                                    }}
                                                    hasChildren={group.subCategories.length > 0}
                                                    renderCells={() => {
                                                        if (selectedMonth === null) {
                                                            const gTotals = getGroupTotals(group.subCategories)
                                                            return (
                                                                <>
                                                                    <div className="text-right text-xs tabular-nums">£{formatCurrency(gTotals.m1Budget)}</div>
                                                                    <div className="text-right text-xs tabular-nums">£{formatCurrency(gTotals.m2Budget)}</div>
                                                                    <div className="text-right text-xs tabular-nums">£{formatCurrency(gTotals.m3Budget)}</div>
                                                                    <div className="text-right text-xs tabular-nums font-semibold">£{formatCurrency(gTotals.qTotal)}</div>
                                                                </>
                                                            )
                                                        } else {
                                                            const gTotals = getGroupMonthTotals(group.subCategories, selectedMonth)
                                                            return (
                                                                <>
                                                                    <div className="text-right text-xs tabular-nums font-semibold">£{formatCurrency(gTotals.budget)}</div>
                                                                    <div className="text-right text-xs tabular-nums text-info">£{formatCurrency(gTotals.actual)}</div>
                                                                    <div className="text-right text-xs font-semibold pr-4"><VarianceCell variance={gTotals.variance} isIncome={isIncome} /></div>
                                                                </>
                                                            )
                                                        }
                                                    }}
                                                />

                                                {/* Subcategories */}
                                                {isGroupExpanded && group.subCategories.map(sub => {
                                                    return (
                                                        <BudgetRow
                                                            key={sub.id}
                                                            label={<span className="text-muted-foreground">{sub.name}</span>}
                                                            depth={2}
                                                            renderCells={() => {
                                                                if (selectedMonth === null) {
                                                                    const vals = getMonthlyValues(sub.id)
                                                                    return (
                                                                        <>
                                                                            <div className="text-right text-xs" onClick={e => e.stopPropagation()}>
                                                                                <EditableBudgetCell categoryId={sub.id} monthInQuarter={1} value={vals.m1Budget} />
                                                                            </div>
                                                                            <div className="text-right text-xs" onClick={e => e.stopPropagation()}>
                                                                                <EditableBudgetCell categoryId={sub.id} monthInQuarter={2} value={vals.m2Budget} />
                                                                            </div>
                                                                            <div className="text-right text-xs" onClick={e => e.stopPropagation()}>
                                                                                <EditableBudgetCell categoryId={sub.id} monthInQuarter={3} value={vals.m3Budget} />
                                                                            </div>
                                                                            <div className="text-right text-xs tabular-nums font-medium">£{formatCurrency(vals.qTotal)}</div>
                                                                        </>
                                                                    )
                                                                } else {
                                                                    const vals = getSingleMonthValues(sub.id, selectedMonth)
                                                                    return (
                                                                        <>
                                                                            <div className="text-right text-xs" onClick={e => e.stopPropagation()}>
                                                                                <EditableBudgetCell categoryId={sub.id} monthInQuarter={selectedMonth} value={vals.budget} />
                                                                            </div>
                                                                            <div className="text-right text-xs tabular-nums text-info">
                                                                                £{formatCurrency(vals.actual)}
                                                                            </div>
                                                                            <div className="text-right text-xs pr-4">
                                                                                <VarianceCell variance={vals.variance} isIncome={isIncome} />
                                                                            </div>
                                                                        </>
                                                                    )
                                                                }
                                                            }}
                                                        />
                                                    )
                                                })}
                                            </div>
                                        )
                                    })}
                                </div>
                            )
                        })}

                        {/* Grand Totals */}
                        {(() => {
                            const revenue = editorHierarchy.find(c => c.code === 'REVENUE')
                            const expenseClasses = editorHierarchy.filter(c => c.code !== 'REVENUE')

                            if (selectedMonth === null) {
                                const revTotals = revenue ? getClassTotals(revenue.categoryGroups) : { m1Budget: 0, m2Budget: 0, m3Budget: 0, qTotal: 0 }
                                const expTotals = expenseClasses.reduce((acc, cls) => {
                                    const t = getClassTotals(cls.categoryGroups)
                                    return { m1Budget: acc.m1Budget + t.m1Budget, m2Budget: acc.m2Budget + t.m2Budget, m3Budget: acc.m3Budget + t.m3Budget, qTotal: acc.qTotal + t.qTotal }
                                }, { m1Budget: 0, m2Budget: 0, m3Budget: 0, qTotal: 0 })

                                const rows = [
                                    { label: 'Total Revenue', ...revTotals },
                                    { label: 'Total Expenses', ...expTotals },
                                    { label: 'Net P&L', m1Budget: revTotals.m1Budget - expTotals.m1Budget, m2Budget: revTotals.m2Budget - expTotals.m2Budget, m3Budget: revTotals.m3Budget - expTotals.m3Budget, qTotal: revTotals.qTotal - expTotals.qTotal, isNet: true }
                                ]

                                return (
                                    <div className="border-t-2 border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800/50 min-w-[600px]">
                                        {rows.map(({ label, m1Budget, m2Budget, m3Budget, qTotal, isNet }) => (
                                            <div key={label} className={`grid gap-2 px-4 py-2 text-sm font-semibold ${isNet ? 'bg-zinc-200 dark:bg-zinc-700/50' : ''}`} style={{ gridTemplateColumns: '1fr 80px 80px 80px 100px' }}>
                                                <div className="sticky left-0 z-10 bg-inherit">{label}</div>
                                                <div className="text-right tabular-nums">£{formatCurrency(m1Budget)}</div>
                                                <div className="text-right tabular-nums">£{formatCurrency(m2Budget)}</div>
                                                <div className="text-right tabular-nums">£{formatCurrency(m3Budget)}</div>
                                                <div className={`text-right tabular-nums font-bold ${isNet ? (qTotal >= 0 ? 'text-emerald-600' : 'text-red-600') : ''}`}>{isNet && qTotal >= 0 ? '+' : ''}£{formatCurrency(qTotal)}</div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            } else {
                                const revTotals = revenue ? getClassMonthTotals(revenue.categoryGroups, selectedMonth) : { budget: 0, actual: 0, variance: 0 }
                                const expTotals = expenseClasses.reduce((acc, cls) => {
                                    const t = getClassMonthTotals(cls.categoryGroups, selectedMonth)
                                    return { budget: acc.budget + t.budget, actual: acc.actual + t.actual, variance: acc.variance + t.variance }
                                }, { budget: 0, actual: 0, variance: 0 })
                                const netBudget = revTotals.budget - expTotals.budget
                                const netActual = revTotals.actual - expTotals.actual

                                const rows = [
                                    { label: 'Total Revenue', budget: revTotals.budget, actual: revTotals.actual, variance: revTotals.actual - revTotals.budget },
                                    { label: 'Total Expenses', budget: expTotals.budget, actual: expTotals.actual, variance: expTotals.budget - expTotals.actual },
                                    { label: 'Net P&L', budget: netBudget, actual: netActual, variance: netActual - netBudget, isNet: true }
                                ]

                                return (
                                    <div className="border-t-2 border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800/50 min-w-[600px]">
                                        {rows.map(({ label, budget, actual, variance, isNet }) => (
                                            <div key={label} className={`grid gap-2 px-4 py-2 text-sm font-semibold ${isNet ? 'bg-zinc-200 dark:bg-zinc-700/50' : ''}`} style={{ gridTemplateColumns: '1fr 100px 100px 100px' }}>
                                                <div className="sticky left-0 z-10 bg-inherit">{label}</div>
                                                <div className="text-right tabular-nums">£{formatCurrency(budget)}</div>
                                                <div className="text-right tabular-nums text-blue-600">£{formatCurrency(actual)}</div>
                                                <div className={`text-right tabular-nums pr-4 ${variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{variance >= 0 ? '+' : ''}£{formatCurrency(variance)}</div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            }
                        })()}
                    </div>
                )}
            </div>
        </div>
    )
}
