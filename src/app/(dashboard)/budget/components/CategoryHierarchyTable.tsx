'use client'

import { ChevronDown, ChevronRight, Loader2, RefreshCcw, Check, Edit3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EditorClass } from '@/lib/actions/budget'
import { formatCurrency } from '../utils'

interface CategoryHierarchyTableProps {
    editorHierarchy: EditorClass[]
    isLoading: boolean
    expandedClasses: Set<string>
    expandedGroups: Set<string>
    onToggleClass: (id: string) => void
    onToggleGroup: (id: string) => void
    hasAnyLockedQuarter: boolean
    editingCellId: string | null
    editValue: string
    savingBudget: string | null
    onEditCell: (id: string, value: string) => void
    onEditValueChange: (value: string) => void
    onSaveBudget: (categoryId: string, amount: number) => void
    onCancelEdit: () => void
    onRefresh: () => void
}

export function CategoryHierarchyTable({
    editorHierarchy,
    isLoading,
    expandedClasses,
    expandedGroups,
    onToggleClass,
    onToggleGroup,
    hasAnyLockedQuarter,
    editingCellId,
    editValue,
    savingBudget,
    onEditCell,
    onEditValueChange,
    onSaveBudget,
    onCancelEdit,
    onRefresh
}: CategoryHierarchyTableProps) {
    return (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border flex justify-between items-center">
                <div>
                    <h3 className="font-bold">Categories with Budget vs Reference</h3>
                    <p className="text-xs text-muted-foreground">Click to expand and view subcategories</p>
                </div>
                <Button size="sm" variant="outline" onClick={onRefresh} disabled={isLoading}>
                    <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    <span className="ml-2">Refresh</span>
                </Button>
            </div>

            {/* Table Header */}
            <div className="overflow-x-auto">
                <div
                    className="grid gap-3 px-4 py-2 bg-card text-xs font-semibold text-muted-foreground border-b border-border min-w-[600px]"
                    style={{ gridTemplateColumns: '1fr 130px 130px 100px' }}
                >
                    <div className="sticky left-0 z-10 bg-card">Category</div>
                    <div className="text-right">Ref (2025)</div>
                    <div className="text-right">Budget</div>
                    <div className="text-right">Change</div>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : editorHierarchy.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                        No budget data. Create a scenario or seed from previous year.
                    </div>
                ) : (
                    <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
                        {editorHierarchy.map(cls => {
                            const isClassExpanded = expandedClasses.has(cls.id)
                            const isIncome = cls.code === 'REVENUE'

                            return (
                                <div key={cls.id} className="border-b border-zinc-200 dark:border-zinc-800 last:border-b-0 min-w-[600px]">
                                    {/* Class Row */}
                                    <button
                                        onClick={() => onToggleClass(cls.id)}
                                        className="w-full grid gap-3 px-4 py-3 text-left bg-card hover:bg-muted/50 transition-colors border-b border-border group"
                                        style={{ gridTemplateColumns: '1fr 130px 130px 100px' }}
                                    >
                                        <div className="flex items-center gap-2 font-bold sticky left-0 z-10 bg-card group-hover:bg-muted/50 pr-4 transition-colors">
                                            {isClassExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                            {cls.name}
                                            <span className="text-xs text-muted-foreground font-normal">({cls.categoryGroups.length})</span>
                                        </div>
                                        <div className="text-right tabular-nums text-muted-foreground">£{formatCurrency(cls.totalReference)}</div>
                                        <div className="text-right font-semibold tabular-nums">£{formatCurrency(cls.totalBudget)}</div>
                                        <div className={`text-right font-semibold tabular-nums ${(isIncome ? cls.totalChange >= 0 : cls.totalChange <= 0) ? 'text-success' : 'text-destructive'}`}>
                                            {cls.totalChange >= 0 ? '+' : ''}£{formatCurrency(Math.abs(cls.totalChange))}
                                        </div>
                                    </button>

                                    {/* Groups */}
                                    {isClassExpanded && cls.categoryGroups.map(group => {
                                        const isGroupExpanded = expandedGroups.has(group.id)

                                        return (
                                            <div key={group.id}>
                                                <button
                                                    onClick={() => onToggleGroup(group.id)}
                                                    className="w-full grid gap-3 px-4 py-2 pl-8 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/30 border-t border-zinc-100 dark:border-zinc-800 group"
                                                    style={{ gridTemplateColumns: '1fr 130px 130px 100px' }}
                                                >
                                                    <div className="flex items-center gap-2 font-medium text-sm sticky left-0 z-10 bg-card group-hover:bg-muted/30 pr-4 transition-colors">
                                                        {group.subCategories.length > 0 ? (
                                                            isGroupExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
                                                        ) : <span className="w-3" />}
                                                        {group.name}
                                                        {group.subCategories.length > 0 && (
                                                            <span className="text-[10px] text-muted-foreground">({group.subCategories.length})</span>
                                                        )}
                                                    </div>
                                                    <div className="text-right text-sm text-muted-foreground tabular-nums">£{formatCurrency(group.totalReference)}</div>
                                                    <div className="text-right text-sm tabular-nums">£{formatCurrency(group.totalBudget)}</div>
                                                    <div className={`text-right text-xs font-semibold tabular-nums ${(isIncome ? group.totalChange >= 0 : group.totalChange <= 0) ? 'text-success' : 'text-destructive'}`}>
                                                        {group.totalChange >= 0 ? '+' : ''}£{formatCurrency(Math.abs(group.totalChange))}
                                                    </div>
                                                </button>

                                                {/* Subcategories */}
                                                {isGroupExpanded && group.subCategories.length > 0 && (
                                                    <div className="bg-zinc-50/50 dark:bg-zinc-950/30">
                                                        {group.subCategories.map(sub => (
                                                            <div
                                                                key={sub.id}
                                                                className="grid gap-3 px-4 py-2 pl-14 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 group"
                                                                style={{ gridTemplateColumns: '1fr 130px 130px 100px' }}
                                                            >
                                                                <div className="flex items-center gap-2 text-sm text-muted-foreground sticky left-0 z-10 bg-muted/30 group-hover:bg-muted/50 pr-4 transition-colors">
                                                                    {sub.name}
                                                                </div>
                                                                <div className="text-right text-sm text-muted-foreground tabular-nums">£{formatCurrency(sub.reference)}</div>
                                                                <div className="text-right relative pr-6" onClick={e => e.stopPropagation()}>
                                                                    {savingBudget === sub.id ? (
                                                                        <Loader2 className="h-4 w-4 animate-spin absolute right-0 top-1/2 -translate-y-1/2" />
                                                                    ) : editingCellId === sub.id ? (
                                                                        <div className="flex items-center justify-end gap-1">
                                                                            <input
                                                                                type="number"
                                                                                autoFocus
                                                                                className="w-20 h-6 px-2 text-right text-sm tabular-nums border border-emerald-500 rounded bg-white dark:bg-zinc-800"
                                                                                value={editValue}
                                                                                onChange={(e) => onEditValueChange(e.target.value)}
                                                                                onKeyDown={(e) => {
                                                                                    if (e.key === 'Enter') {
                                                                                        onSaveBudget(sub.id, parseFloat(editValue) || 0)
                                                                                    } else if (e.key === 'Escape') {
                                                                                        onCancelEdit()
                                                                                    }
                                                                                }}
                                                                            />
                                                                            <button
                                                                                onClick={() => onSaveBudget(sub.id, parseFloat(editValue) || 0)}
                                                                                className="p-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white"
                                                                            >
                                                                                <Check className="h-3 w-3" />
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <>
                                                                            <span className="tabular-nums text-sm">£{formatCurrency(sub.budget)}</span>
                                                                            {!hasAnyLockedQuarter && (
                                                                                <button
                                                                                    onClick={() => onEditCell(sub.id, sub.budget.toString())}
                                                                                    className="absolute right-0 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-muted-foreground hover:text-foreground"
                                                                                >
                                                                                    <Edit3 className="h-3 w-3" />
                                                                                </button>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                </div>
                                                                <div className={`text-right text-xs font-medium tabular-nums ${(isIncome ? sub.change >= 0 : sub.change <= 0) ? 'text-success' : 'text-destructive'}`}>
                                                                    {sub.change >= 0 ? '+' : ''}£{formatCurrency(Math.abs(sub.change))}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
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
