'use client'

import { useState } from 'react'
import { Plus, Check, MoreVertical, Copy, Trash2, Lock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { BudgetScenario } from '@/lib/actions/budget'

interface BudgetScenariosTabProps {
    scenarios: BudgetScenario[]
    year: number
    isLoading: boolean
    onCreateScenario: (name: string, seedFromPrevious: boolean) => Promise<void>
    onSetActive: (id: string) => Promise<void>
    onDuplicate: (id: string) => Promise<void>
    onDelete: (id: string) => Promise<void>
}

export function BudgetScenariosTab({
    scenarios,
    year,
    isLoading,
    onCreateScenario,
    onSetActive,
    onDuplicate,
    onDelete
}: BudgetScenariosTabProps) {
    const [showNewForm, setShowNewForm] = useState(false)
    const [newName, setNewName] = useState('')
    const [seedFromPrevious, setSeedFromPrevious] = useState(true)
    const [isCreating, setIsCreating] = useState(false)

    const handleCreate = async () => {
        setIsCreating(true)
        await onCreateScenario(newName || `Budget ${year}`, seedFromPrevious)
        setShowNewForm(false)
        setNewName('')
        setIsCreating(false)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Budget Scenarios</h2>
                <Button onClick={() => setShowNewForm(true)} className="gap-2">
                    <Plus className="h-4 w-4" /> New Scenario
                </Button>
            </div>

            {/* New Scenario Form */}
            {showNewForm && (
                <Card>
                    <CardHeader>
                        <CardTitle>Create New Budget Scenario</CardTitle>
                        <CardDescription>Start fresh or seed from {year - 1} actuals</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium mb-1 block">Scenario Name</label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    className="w-full h-10 px-3 rounded-lg border border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900"
                                    placeholder={`Budget ${year}`}
                                />
                            </div>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={seedFromPrevious}
                                    onChange={e => setSeedFromPrevious(e.target.checked)}
                                    className="h-5 w-5 rounded border-zinc-300"
                                />
                                <div>
                                    <span className="font-medium">Seed from {year - 1} actuals</span>
                                    <p className="text-xs text-muted-foreground">Copy last year&apos;s transaction totals as starting point</p>
                                </div>
                            </label>
                        </div>
                        <div className="flex gap-2 justify-end pt-2">
                            <Button variant="outline" onClick={() => setShowNewForm(false)}>Cancel</Button>
                            <Button onClick={handleCreate} disabled={isCreating}>
                                {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Create Scenario
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Scenario Cards */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : scenarios.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="text-muted-foreground">No scenarios yet. Create your first budget scenario to get started.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {scenarios.map(scenario => (
                        <Card key={scenario.id} className={`relative ${scenario.is_active ? 'ring-2 ring-emerald-500' : ''}`}>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {scenario.is_active && (
                                            <span className="bg-emerald-500 text-white text-[9px] px-2 py-0.5 rounded font-bold">ACTIVE</span>
                                        )}
                                        <CardTitle className="text-base">{scenario.name}</CardTitle>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
                                                <MoreVertical className="h-4 w-4" />
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            {!scenario.is_active && (
                                                <DropdownMenuItem onClick={() => onSetActive(scenario.id)}>
                                                    <Check className="h-4 w-4 mr-2" /> Set Active
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuItem onClick={() => onDuplicate(scenario.id)}>
                                                <Copy className="h-4 w-4 mr-2" /> Duplicate
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => onDelete(scenario.id)} className="text-rose-600">
                                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex gap-2 mt-2">
                                    {[1, 2, 3, 4].map(q => {
                                        const isLocked = scenario[`q${q}_locked` as keyof BudgetScenario]
                                        return (
                                            <div
                                                key={q}
                                                className={`flex-1 text-center py-1 rounded text-xs font-bold ${isLocked
                                                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                                                    }`}
                                            >
                                                Q{q}
                                                {isLocked && <Lock className="h-2.5 w-2.5 inline ml-1" />}
                                            </div>
                                        )
                                    })}
                                </div>
                                <p className="text-xs text-muted-foreground mt-3 capitalize">
                                    Status: {scenario.status || 'draft'}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
