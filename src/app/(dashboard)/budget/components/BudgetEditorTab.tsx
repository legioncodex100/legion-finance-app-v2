'use client'

import { useState, useCallback, useEffect } from 'react'
import { Lock, Loader2, RefreshCcw, Check, Edit3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    getBudgetEditorHierarchy,
    confirmYearlyBudget,
    updateMonthlyBudget,
    renameScenario,
    lockQuarter,
    unlockQuarter,
    getMonthlyBudgetData,
    getLiveActuals,
    BudgetScenario,
    EditorClass,
    MonthlyBudgetRow,
    ActualsByMonth
} from '@/lib/actions/budget'
import { QuarterLockGrid } from './QuarterLockGrid'
import { ScenarioNotesEditor } from './ScenarioNotesEditor'
import { CategoryHierarchyTable } from './CategoryHierarchyTable'
import { MonthlyBudgetEditor } from './MonthlyBudgetEditor'

interface BudgetEditorTabProps {
    scenarios: BudgetScenario[]
    selectedScenarioId: string | null
    onScenarioChange: (id: string) => void
    year: number
    onScenariosRefresh: () => Promise<void>
}

type EditorSubTab = 'yearly' | 'monthly'

export function BudgetEditorTab({
    scenarios,
    selectedScenarioId,
    onScenarioChange,
    year,
    onScenariosRefresh
}: BudgetEditorTabProps) {
    const selectedScenario = scenarios.find(s => s.id === selectedScenarioId) || scenarios[0]

    // Editor state
    const [editorSubTab, setEditorSubTab] = useState<EditorSubTab>('yearly')
    const [selectedQuarter, setSelectedQuarter] = useState<1 | 2 | 3 | 4>(1)
    const [editorHierarchy, setEditorHierarchy] = useState<EditorClass[]>([])
    const [isLoadingEditor, setIsLoadingEditor] = useState(false)

    // Monthly data
    const [monthlyData, setMonthlyData] = useState<MonthlyBudgetRow[]>([])
    const [liveActuals, setLiveActuals] = useState<ActualsByMonth>({})
    const [isLoadingMonthly, setIsLoadingMonthly] = useState(false)

    // Expand/collapse state
    const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set())
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

    // Inline editing state
    const [editingCellId, setEditingCellId] = useState<string | null>(null)
    const [editValue, setEditValue] = useState('')
    const [savingBudget, setSavingBudget] = useState<string | null>(null)

    // Scenario name editing
    const [editingName, setEditingName] = useState(false)
    const [nameValue, setNameValue] = useState('')

    // Check quarter lock status
    const hasAnyLockedQuarter = selectedScenario && (
        selectedScenario.q1_locked || selectedScenario.q2_locked ||
        selectedScenario.q3_locked || selectedScenario.q4_locked
    )

    const getQuarterLock = (q: 1 | 2 | 3 | 4) => {
        if (!selectedScenario) return false
        return selectedScenario[`q${q}_locked` as keyof BudgetScenario] as boolean
    }

    // Fetch editor data
    const fetchEditorData = useCallback(async () => {
        if (!selectedScenario) return
        setIsLoadingEditor(true)
        const data = await getBudgetEditorHierarchy(selectedScenario.id)
        const sorted = [...data].sort((a, b) => {
            if (a.code === 'REVENUE') return -1
            if (b.code === 'REVENUE') return 1
            return 0
        })
        setEditorHierarchy(sorted)
        setExpandedClasses(new Set(sorted.map(c => c.id)))
        setExpandedGroups(new Set(sorted.flatMap(c => c.categoryGroups.map(g => g.id))))
        setIsLoadingEditor(false)
    }, [selectedScenario])

    // Fetch monthly data
    const fetchMonthlyData = useCallback(async () => {
        if (!selectedScenario) return
        setIsLoadingMonthly(true)
        const quarterMonths = selectedQuarter === 1 ? [1, 2, 3]
            : selectedQuarter === 2 ? [4, 5, 6]
                : selectedQuarter === 3 ? [7, 8, 9]
                    : [10, 11, 12]
        const [data, actuals] = await Promise.all([
            getMonthlyBudgetData(selectedScenario.id, selectedQuarter),
            getLiveActuals(year, quarterMonths)
        ])
        setMonthlyData(data)
        setLiveActuals(actuals)
        setIsLoadingMonthly(false)
    }, [selectedScenario, selectedQuarter, year])

    useEffect(() => {
        if (editorSubTab === 'yearly') {
            fetchEditorData()
        } else {
            fetchMonthlyData()
        }
    }, [editorSubTab, fetchEditorData, fetchMonthlyData])

    // Handle budget save
    const handleBudgetSave = async (categoryId: string, yearlyAmount: number) => {
        if (!selectedScenario || hasAnyLockedQuarter) return
        setSavingBudget(categoryId)

        const monthlyBase = Math.floor((yearlyAmount / 12) * 100) / 100
        const remainder = Math.round((yearlyAmount - (monthlyBase * 11)) * 100) / 100

        for (let month = 1; month <= 11; month++) {
            await updateMonthlyBudget(selectedScenario.id, categoryId, month, monthlyBase)
        }
        await updateMonthlyBudget(selectedScenario.id, categoryId, 12, remainder)

        await fetchEditorData()
        setSavingBudget(null)
        setEditingCellId(null)
    }

    // Quarter handlers
    const handleLockQuarter = async (q: 1 | 2 | 3 | 4) => {
        if (!selectedScenario) return
        await lockQuarter(selectedScenario.id, q)
        await onScenariosRefresh()
    }

    const handleUnlockQuarter = async (q: 1 | 2 | 3 | 4) => {
        if (!selectedScenario) return
        if (!confirm(`Unlock Q${q}? This allows budget edits but removes actuals tracking.`)) return
        await unlockQuarter(selectedScenario.id, q)
        await onScenariosRefresh()
    }

    // Toggle functions
    const toggleClass = (classId: string) => {
        const newExpanded = new Set(expandedClasses)
        if (newExpanded.has(classId)) newExpanded.delete(classId)
        else newExpanded.add(classId)
        setExpandedClasses(newExpanded)
    }

    const toggleGroup = (groupId: string) => {
        const newExpanded = new Set(expandedGroups)
        if (newExpanded.has(groupId)) newExpanded.delete(groupId)
        else newExpanded.add(groupId)
        setExpandedGroups(newExpanded)
    }

    if (!selectedScenario) {
        return <div className="p-8 text-center text-muted-foreground">No scenario selected.</div>
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-6">
                        <div>
                            <h2 className="text-lg font-bold">Budget Editor</h2>
                            <p className="text-xs text-muted-foreground">Plan your {year} budget</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Scenario:</span>
                            {editingName ? (
                                <div className="flex items-center gap-1">
                                    <input
                                        type="text"
                                        autoFocus
                                        value={nameValue}
                                        onChange={e => setNameValue(e.target.value)}
                                        onKeyDown={async e => {
                                            if (e.key === 'Enter') {
                                                await renameScenario(selectedScenario.id, nameValue)
                                                await onScenariosRefresh()
                                                setEditingName(false)
                                            } else if (e.key === 'Escape') {
                                                setEditingName(false)
                                            }
                                        }}
                                        className="h-9 px-3 rounded-lg border border-emerald-500 dark:bg-zinc-800 font-semibold text-sm w-48"
                                    />
                                    <button
                                        onClick={async () => {
                                            await renameScenario(selectedScenario.id, nameValue)
                                            await onScenariosRefresh()
                                            setEditingName(false)
                                        }}
                                        className="p-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white"
                                    >
                                        <Check className="h-4 w-4" />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <select
                                        value={selectedScenario?.id || ''}
                                        onChange={e => onScenarioChange(e.target.value)}
                                        className="h-9 px-3 pr-8 rounded-lg border border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 font-semibold text-sm"
                                    >
                                        {scenarios.map(s => (
                                            <option key={s.id} value={s.id}>
                                                {s.name} {s.is_active ? '✓' : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => { setNameValue(selectedScenario?.name || ''); setEditingName(true) }}
                                        className="p-2 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-muted-foreground hover:text-foreground"
                                    >
                                        <Edit3 className="h-4 w-4" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => editorSubTab === 'yearly' ? fetchEditorData() : fetchMonthlyData()}>
                        <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
                    </Button>
                </div>

                {/* Notes Section */}
                <ScenarioNotesEditor
                    scenarioId={selectedScenario.id}
                    scenarioName={selectedScenario.name}
                    notes={selectedScenario.notes}
                    year={year}
                    editorHierarchy={editorHierarchy}
                    onRefresh={onScenariosRefresh}
                />

                {/* Sub-tab toggles */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setEditorSubTab('yearly')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${editorSubTab === 'yearly'
                            ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        📅 Yearly
                    </button>
                    <button
                        onClick={() => setEditorSubTab('monthly')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${editorSubTab === 'monthly'
                            ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        📆 Monthly
                    </button>
                    {!selectedScenario?.yearly_confirmed && editorSubTab === 'monthly' && (
                        <span className="text-xs text-amber-600 ml-2">(View only - confirm yearly budget first)</span>
                    )}
                    {hasAnyLockedQuarter && (
                        <span className="ml-auto flex items-center gap-1 text-xs text-amber-600">
                            <Lock className="h-3 w-3" /> Yearly budget is locked
                        </span>
                    )}
                </div>
            </div>

            {/* YEARLY VIEW */}
            {editorSubTab === 'yearly' && (
                <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="font-bold">Annual Budget Planning</h3>
                            <p className="text-xs text-muted-foreground">Set your {year} targets. 2025 data is shown as reference.</p>
                        </div>
                        {!selectedScenario?.yearly_confirmed && !hasAnyLockedQuarter && (
                            <Button
                                onClick={async () => { await confirmYearlyBudget(selectedScenario.id); onScenariosRefresh() }}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Check className="h-4 w-4 mr-2" /> Confirm Yearly & Unlock Monthly
                            </Button>
                        )}
                        {selectedScenario?.yearly_confirmed && !hasAnyLockedQuarter && (
                            <span className="text-xs text-emerald-600 flex items-center gap-1">
                                <Check className="h-4 w-4" /> Yearly confirmed
                            </span>
                        )}
                    </div>

                    {/* Quarter Lock Grid */}
                    <QuarterLockGrid
                        getQuarterLock={getQuarterLock}
                        onLockQuarter={handleLockQuarter}
                        onUnlockQuarter={handleUnlockQuarter}
                    />

                    {/* Category Hierarchy Table */}
                    <CategoryHierarchyTable
                        editorHierarchy={editorHierarchy}
                        isLoading={isLoadingEditor}
                        expandedClasses={expandedClasses}
                        expandedGroups={expandedGroups}
                        onToggleClass={toggleClass}
                        onToggleGroup={toggleGroup}
                        hasAnyLockedQuarter={!!hasAnyLockedQuarter}
                        editingCellId={editingCellId}
                        editValue={editValue}
                        savingBudget={savingBudget}
                        onEditCell={(id, val) => { setEditingCellId(id); setEditValue(val) }}
                        onEditValueChange={setEditValue}
                        onSaveBudget={handleBudgetSave}
                        onCancelEdit={() => setEditingCellId(null)}
                        onRefresh={fetchEditorData}
                    />
                </div>
            )}

            {/* MONTHLY VIEW */}
            {editorSubTab === 'monthly' && (
                <MonthlyBudgetEditor
                    scenarioId={selectedScenario.id}
                    year={year}
                    yearlyConfirmed={!!selectedScenario.yearly_confirmed}
                />
            )}
        </div>
    )
}
