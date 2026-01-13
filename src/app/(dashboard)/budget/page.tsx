'use client'

import * as React from 'react'
import { Check, Eye, Edit3, BarChart3 } from 'lucide-react'
import {
    getBudgetScenarios,
    createBudgetScenario,
    setActiveScenario,
    duplicateScenario,
    deleteScenario,
    BudgetScenario
} from '@/lib/actions/budget'
import { BudgetScenariosTab, BudgetEditorTab, BudgetTrackingTab } from './components'
import type { TabType } from './utils'

export default function BudgetPage() {
    const [activeTab, setActiveTab] = React.useState<TabType>('scenarios')
    const [scenarios, setScenarios] = React.useState<BudgetScenario[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const [selectedScenarioId, setSelectedScenarioId] = React.useState<string | null>(null)

    const year = 2026
    const activeScenario = scenarios.find(s => s.is_active)
    const hasLockedQuarters = activeScenario && (
        activeScenario.q1_locked || activeScenario.q2_locked ||
        activeScenario.q3_locked || activeScenario.q4_locked
    )

    const fetchScenarios = React.useCallback(async () => {
        setIsLoading(true)
        const data = await getBudgetScenarios(year)
        setScenarios(data)
        if (!selectedScenarioId && data.length > 0) {
            setSelectedScenarioId(data.find(s => s.is_active)?.id || data[0].id)
        }
        setIsLoading(false)
    }, [selectedScenarioId])

    React.useEffect(() => { fetchScenarios() }, [fetchScenarios])

    const handleCreateScenario = async (name: string, seedFromPrevious: boolean) => {
        await createBudgetScenario(name, year, seedFromPrevious)
        await fetchScenarios()
    }

    const handleSetActive = async (id: string) => {
        await setActiveScenario(id)
        await fetchScenarios()
    }

    const handleDuplicate = async (id: string) => {
        const scenario = scenarios.find(s => s.id === id)
        if (!scenario) return
        await duplicateScenario(id, `${scenario.name} (Copy)`)
        await fetchScenarios()
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this budget scenario?')) return
        await deleteScenario(id)
        await fetchScenarios()
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-black dark:to-zinc-950 p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight">{year} Budget</h1>
                    <p className="text-muted-foreground">Plan, commit, and track your financial targets</p>
                </div>
                {activeScenario && (
                    <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2 rounded-lg border border-emerald-200 dark:border-emerald-800">
                        <Check className="h-4 w-4 text-emerald-600" />
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">{activeScenario.name}</span>
                    </div>
                )}
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                <button
                    onClick={() => setActiveTab('scenarios')}
                    className={`px-4 py-2 rounded-t-lg font-semibold text-sm transition-colors ${activeTab === 'scenarios'
                        ? 'bg-white dark:bg-zinc-900 border border-b-0 border-zinc-200 dark:border-zinc-800'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    <Eye className="h-4 w-4 inline mr-2" />Scenarios
                </button>
                <button
                    onClick={() => setActiveTab('editor')}
                    disabled={scenarios.length === 0}
                    className={`px-4 py-2 rounded-t-lg font-semibold text-sm transition-colors ${activeTab === 'editor'
                        ? 'bg-white dark:bg-zinc-900 border border-b-0 border-zinc-200 dark:border-zinc-800'
                        : 'text-muted-foreground hover:text-foreground'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    <Edit3 className="h-4 w-4 inline mr-2" />Editor
                </button>
                <button
                    onClick={() => setActiveTab('tracking')}
                    disabled={!hasLockedQuarters}
                    className={`px-4 py-2 rounded-t-lg font-semibold text-sm transition-colors ${activeTab === 'tracking'
                        ? 'bg-white dark:bg-zinc-900 border border-b-0 border-zinc-200 dark:border-zinc-800'
                        : 'text-muted-foreground hover:text-foreground'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    <BarChart3 className="h-4 w-4 inline mr-2" />Tracking
                    {!hasLockedQuarters && <span className="ml-2 text-[10px]">(lock a quarter first)</span>}
                </button>
            </div>

            {/* TAB 1: SCENARIOS */}
            {activeTab === 'scenarios' && (
                <BudgetScenariosTab
                    scenarios={scenarios}
                    year={year}
                    isLoading={isLoading}
                    onCreateScenario={handleCreateScenario}
                    onSetActive={handleSetActive}
                    onDuplicate={handleDuplicate}
                    onDelete={handleDelete}
                />
            )}

            {/* TAB 2: EDITOR */}
            {activeTab === 'editor' && scenarios.length > 0 && (
                <BudgetEditorTab
                    scenarios={scenarios}
                    selectedScenarioId={selectedScenarioId}
                    onScenarioChange={setSelectedScenarioId}
                    year={year}
                    onScenariosRefresh={fetchScenarios}
                />
            )}

            {/* TAB 3: TRACKING */}
            {activeTab === 'tracking' && hasLockedQuarters && activeScenario && (
                <BudgetTrackingTab
                    scenario={activeScenario}
                    year={year}
                />
            )}
        </div>
    )
}
