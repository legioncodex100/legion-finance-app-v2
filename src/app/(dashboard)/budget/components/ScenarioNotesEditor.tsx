'use client'

import { useState } from 'react'
import { Check, Edit3, Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { updateScenarioNotes, cleanupBudgetNotes, EditorClass } from '@/lib/actions/budget'

interface ScenarioNotesEditorProps {
    scenarioId: string
    scenarioName: string
    notes: string | null
    year: number
    editorHierarchy: EditorClass[]
    onRefresh: () => Promise<void>
}

export function ScenarioNotesEditor({
    scenarioId,
    scenarioName,
    notes,
    year,
    editorHierarchy,
    onRefresh
}: ScenarioNotesEditorProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [notesValue, setNotesValue] = useState(notes || '')
    const [isCleaningNotes, setIsCleaningNotes] = useState(false)

    const handleSave = async () => {
        await updateScenarioNotes(scenarioId, notesValue || null)
        await onRefresh()
        setIsEditing(false)
    }

    const handleAICleanup = async () => {
        if (!notesValue.trim()) return
        setIsCleaningNotes(true)

        const incomeClass = editorHierarchy.find(c => c.code === 'REVENUE')
        const expenseClasses = editorHierarchy.filter(c => c.code !== 'REVENUE')

        const result = await cleanupBudgetNotes(notesValue, {
            scenarioName,
            year,
            totalBudgetIncome: incomeClass?.totalBudget || 0,
            totalBudgetExpenses: expenseClasses.reduce((s, c) => s + c.totalBudget, 0),
            netBudget: (incomeClass?.totalBudget || 0) - expenseClasses.reduce((s, c) => s + c.totalBudget, 0),
            totalReferenceIncome: incomeClass?.totalReference || 0,
            totalReferenceExpenses: expenseClasses.reduce((s, c) => s + c.totalReference, 0)
        })

        if (result.success) {
            setNotesValue(result.cleanedNotes)
        }
        setIsCleaningNotes(false)
    }

    return (
        <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
            {isEditing ? (
                <div className="space-y-2">
                    <textarea
                        value={notesValue}
                        onChange={e => setNotesValue(e.target.value)}
                        placeholder="Add context about this scenario..."
                        className="w-full p-2 text-sm rounded border border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-900 min-h-[80px]"
                        autoFocus
                    />
                    <div className="flex gap-2">
                        <Button size="sm" onClick={handleSave}>
                            <Check className="h-3 w-3 mr-1" /> Save
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={!notesValue.trim() || isCleaningNotes}
                            onClick={handleAICleanup}
                            title="AI cleanup"
                        >
                            {isCleaningNotes ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                            <span className="ml-1">AI Cleanup</span>
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                            Cancel
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 text-sm text-amber-800 dark:text-amber-200">
                        {notes ? (
                            <p>{notes}</p>
                        ) : (
                            <p className="text-muted-foreground italic">No notes. Click edit to add context.</p>
                        )}
                    </div>
                    <button
                        onClick={() => {
                            setNotesValue(notes || '')
                            setIsEditing(true)
                        }}
                        className="p-1 rounded hover:bg-amber-200 dark:hover:bg-amber-800 text-amber-600 dark:text-amber-400"
                    >
                        <Edit3 className="h-4 w-4" />
                    </button>
                </div>
            )}
        </div>
    )
}
