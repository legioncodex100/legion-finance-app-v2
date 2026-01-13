"use client"

import * as React from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
    Check,
    X,
    Pencil,
    Loader2,
    Zap,
    AlertCircle,
    ArrowRight
} from "lucide-react"
import {
    getPendingMatches,
    approveMatch,
    rejectMatch,
    approveMatchWithEdit,
    bulkApprove,
    bulkReject
} from "@/lib/actions/pending-matches"

interface ApprovalQueueProps {
    initialMatches: any[]
    categories: any[]
    onUpdate?: () => void
}

export function ApprovalQueue({ initialMatches, categories, onUpdate }: ApprovalQueueProps) {
    const [matches, setMatches] = React.useState<any[]>(initialMatches)
    const [loading, setLoading] = React.useState(false)
    const [processing, setProcessing] = React.useState<string | null>(null)
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
    const [editModal, setEditModal] = React.useState<{ open: boolean, match: any | null }>({ open: false, match: null })
    const [editCategoryId, setEditCategoryId] = React.useState<string>("")
    const [hideReconciled, setHideReconciled] = React.useState(true) // Hide already reconciled by default

    // Sync state when props change (via router.refresh())
    React.useEffect(() => {
        setMatches(initialMatches)
    }, [initialMatches])

    const loadMatches = React.useCallback(async () => {
        setLoading(true)
        try {
            const data = await getPendingMatches()
            setMatches(data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => { loadMatches() }, [loadMatches])

    const handleApprove = async (matchId: string) => {
        setProcessing(matchId)
        try {
            await approveMatch(matchId)
            setMatches(prev => prev.filter(m => m.id !== matchId))
            onUpdate?.()
        } catch (e: any) {
            console.error(e)
            alert(`Failed to approve: ${e.message || e}`)
        } finally {
            setProcessing(null)
        }
    }

    const handleReject = async (matchId: string) => {
        setProcessing(matchId)
        try {
            await rejectMatch(matchId)
            setMatches(prev => prev.filter(m => m.id !== matchId))
            onUpdate?.()
        } catch (e) {
            console.error(e)
        } finally {
            setProcessing(null)
        }
    }

    const handleEditApprove = async () => {
        if (!editModal.match) return
        setProcessing(editModal.match.id)
        try {
            await approveMatchWithEdit(editModal.match.id, editCategoryId)
            setMatches(prev => prev.filter(m => m.id !== editModal.match.id))
            setEditModal({ open: false, match: null })
            onUpdate?.()
        } catch (e) {
            console.error(e)
        } finally {
            setProcessing(null)
        }
    }

    const handleBulkApprove = async () => {
        if (selectedIds.size === 0) return
        setProcessing('bulk')
        try {
            const result = await bulkApprove(Array.from(selectedIds))
            if (result.approved > 0) {
                alert(`✅ Approved ${result.approved} transactions${result.failed > 0 ? ` (${result.failed} failed)` : ''}`)
            } else if (result.failed > 0) {
                alert(`❌ Failed to approve ${result.failed} transactions. Check console for details.`)
            }
            setMatches(prev => prev.filter(m => !selectedIds.has(m.id)))
            setSelectedIds(new Set())
            onUpdate?.()
        } catch (e: any) {
            console.error(e)
            alert(`Bulk approve error: ${e.message || e}`)
        } finally {
            setProcessing(null)
        }
    }

    const handleBulkReject = async () => {
        if (selectedIds.size === 0) return
        setProcessing('bulk')
        try {
            await bulkReject(Array.from(selectedIds))
            setMatches(prev => prev.filter(m => !selectedIds.has(m.id)))
            setSelectedIds(new Set())
            onUpdate?.()
        } catch (e) {
            console.error(e)
        } finally {
            setProcessing(null)
        }
    }

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleSelectAll = () => {
        if (selectedIds.size === matches.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(matches.map(m => m.id)))
        }
    }

    const toggleSelectGroup = (matchIds: string[]) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            const allSelected = matchIds.every(id => next.has(id))
            if (allSelected) {
                matchIds.forEach(id => next.delete(id))
            } else {
                matchIds.forEach(id => next.add(id))
            }
            return next
        })
    }

    const groupedMatches = React.useMemo(() => {
        // Filter matches based on hideReconciled setting
        const filteredMatches = hideReconciled
            ? matches.filter(m => !m.was_already_reconciled && !m.transaction?.confirmed)
            : matches;

        const groups: Record<string, { rule: any, matches: any[] }> = {};
        filteredMatches.forEach(match => {
            const ruleId = match.rule?.id || 'manual';
            if (!groups[ruleId]) {
                groups[ruleId] = {
                    rule: match.rule || { name: 'Manual Match', description: 'Matched without a specific rule' },
                    matches: []
                };
            }
            groups[ruleId].matches.push(match);
        });
        return Object.values(groups).sort((a, b) => b.matches.length - a.matches.length);
    }, [matches, hideReconciled]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
        )
    }

    if (matches.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4 mb-4">
                    <Check className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-lg font-bold">All Caught Up!</h3>
                <p className="text-muted-foreground text-sm mt-1">
                    No pending rule matches to review.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Bulk Actions Bar */}
            {selectedIds.size > 0 && (
                <div className="sticky top-0 z-10 flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-950/90 backdrop-blur-md rounded-lg border border-indigo-200 dark:border-indigo-900 shadow-md mb-4">
                    <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                        {selectedIds.size} selected
                    </span>
                    <div className="flex-1" />
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleBulkReject}
                        disabled={processing === 'bulk'}
                        className="border-red-300 text-red-600 hover:bg-red-50"
                    >
                        <X className="h-4 w-4 mr-1" /> Reject All
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleBulkApprove}
                        disabled={processing === 'bulk'}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        {processing === 'bulk' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                        Approve All
                    </Button>
                </div>
            )}

            {/* Filter Toggle */}
            <div className="flex items-center gap-2 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={hideReconciled}
                        onChange={(e) => setHideReconciled(e.target.checked)}
                        className="rounded border-slate-300 dark:border-zinc-700"
                    />
                    <span className="text-sm text-muted-foreground">Hide already reconciled</span>
                </label>
                {hideReconciled && matches.filter(m => m.was_already_reconciled || m.transaction?.confirmed).length > 0 && (
                    <span className="text-xs text-amber-600 dark:text-amber-400">
                        ({matches.filter(m => m.was_already_reconciled || m.transaction?.confirmed).length} hidden)
                    </span>
                )}
            </div>

            {/* Grouped Match List */}
            <div className="space-y-8">
                {groupedMatches.map((group) => {
                    const groupIds = group.matches.map(m => m.id);
                    const isGroupSelected = groupIds.every(id => selectedIds.has(id));
                    const totalAmount = group.matches.reduce((sum, m) => sum + Math.abs(parseFloat(m.transaction?.amount)), 0);

                    return (
                        <div key={group.rule.id || 'manual'} className="space-y-4">
                            {/* Group Header */}
                            <div className="flex items-center justify-between px-4 py-2 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                                <div className="flex items-center gap-4">
                                    <input
                                        type="checkbox"
                                        checked={isGroupSelected}
                                        onChange={() => toggleSelectGroup(groupIds)}
                                        className="rounded cursor-pointer h-4 w-4 border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1 bg-indigo-100 dark:bg-indigo-900/50 rounded-md">
                                                <Zap className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                            </div>
                                            <h3 className="font-black text-sm uppercase tracking-tight text-indigo-900 dark:text-indigo-100">
                                                {group.rule.name}
                                            </h3>
                                        </div>
                                        <p className="text-[10px] text-indigo-600/60 dark:text-indigo-400/60 font-medium">
                                            {group.matches.length} matches • Total £{totalAmount.toFixed(2)}
                                        </p>
                                    </div>
                                </div>

                                {/* Quick Actions for Group */}
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={async () => {
                                            if (!confirm(`Reject all ${group.matches.length} matches in this group? Transactions will return to unreconciled.`)) return
                                            setProcessing('bulk')
                                            try {
                                                await bulkReject(groupIds)
                                                setMatches(prev => prev.filter(m => !groupIds.includes(m.id)))
                                                onUpdate?.()
                                            } catch (e) {
                                                console.error(e)
                                            } finally {
                                                setProcessing(null)
                                            }
                                        }}
                                        disabled={processing === 'bulk'}
                                        className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                    >
                                        {processing === 'bulk' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <X className="h-3 w-3 mr-1" />}
                                        Reject All
                                    </Button>
                                </div>
                            </div>

                            {/* Column Header (Only if matches exist) */}
                            <div className="grid grid-cols-12 gap-4 px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                                <div className="col-span-1"></div>
                                <div className="col-span-1">Date</div>
                                <div className="col-span-4">Transaction Details</div>
                                <div className="col-span-4">Suggested Accounting</div>
                                <div className="col-span-2 text-right">Actions</div>
                            </div>

                            <div className="space-y-2 px-2">
                                {group.matches.map((match) => (
                                    <div
                                        key={match.id}
                                        className={`grid grid-cols-12 gap-4 items-center p-4 rounded-xl border transition-all ${selectedIds.has(match.id)
                                            ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800'
                                            : 'bg-white dark:bg-zinc-950 border-slate-100 dark:border-zinc-900 hover:border-slate-200 dark:hover:border-zinc-800'
                                            }`}
                                    >
                                        <div className="col-span-1 flex items-center justify-center">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(match.id)}
                                                onChange={() => toggleSelect(match.id)}
                                                className="rounded cursor-pointer h-4 w-4"
                                            />
                                        </div>

                                        <div className="col-span-1 text-[11px] text-muted-foreground font-bold tabular-nums">
                                            {match.transaction?.transaction_date
                                                ? new Date(match.transaction.transaction_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })
                                                : '—'
                                            }
                                        </div>

                                        <div className="col-span-4 min-w-0">
                                            <p className="font-black text-sm truncate uppercase tracking-tight" title={match.transaction?.description}>
                                                {match.transaction?.description || 'Unknown'}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <p className="text-[10px] text-muted-foreground/70 font-bold truncate">
                                                    {match.transaction?.staff?.name || match.transaction?.vendors?.name || match.transaction?.raw_party || 'Unknown'}
                                                </p>
                                                {(match.was_already_reconciled || match.transaction?.confirmed) && (
                                                    <span className="text-[9px] px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded font-black">
                                                        ALREADY RECONCILED
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="col-span-4">
                                            <div className="flex flex-col gap-0.5">
                                                {match.suggested_category?.parent && (
                                                    <span className="text-[9px] uppercase font-black text-indigo-600/40 dark:text-indigo-400/30 pl-5 tracking-widest">
                                                        {match.suggested_category.parent.name}
                                                    </span>
                                                )}
                                                <div className="flex items-center gap-2 text-sm">
                                                    <ArrowRight className="h-3 w-3 text-emerald-500 shrink-0" />
                                                    <span className="font-black truncate text-emerald-700 dark:text-emerald-400 tracking-tight">
                                                        {match.suggested_category?.name || 'No category'}
                                                    </span>
                                                </div>
                                                <span className={`font-black text-xs tabular-nums pl-5 ${parseFloat(match.transaction?.amount) < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                    {parseFloat(match.transaction?.amount) < 0 ? '-' : '+'}£{Math.abs(parseFloat(match.transaction?.amount)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="col-span-2 flex items-center justify-end gap-1.5">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={() => {
                                                    setEditModal({ open: true, match })
                                                    setEditCategoryId(match.suggested_category_id || '')
                                                }}
                                                disabled={processing === match.id}
                                                className="h-8 w-8 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 text-indigo-600"
                                                title="Edit & Approve"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={() => handleReject(match.id)}
                                                disabled={processing === match.id}
                                                className="h-8 w-8 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                                title="Reject"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="icon"
                                                onClick={() => handleApprove(match.id)}
                                                disabled={processing === match.id}
                                                className="h-8 w-8 bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm border-none"
                                                title="Approve"
                                            >
                                                {processing === match.id
                                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    : <Check className="h-3.5 w-3.5" />
                                                }
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Edit Modal */}
            <Dialog open={editModal.open} onOpenChange={(open) => setEditModal({ open, match: open ? editModal.match : null })}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Pencil className="h-5 w-5" />
                            Edit Before Approving
                        </DialogTitle>
                        <DialogDescription>
                            Change the category before approving this rule match.
                        </DialogDescription>
                    </DialogHeader>

                    {editModal.match && (
                        <div className="space-y-4 py-4">
                            <div className="p-3 bg-slate-50 dark:bg-zinc-900 rounded-lg">
                                <p className="text-sm font-bold">{editModal.match.transaction?.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    £{Math.abs(parseFloat(editModal.match.transaction?.amount)).toFixed(2)} • {editModal.match.transaction?.vendors?.name}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Category
                                </label>
                                <select
                                    value={editCategoryId}
                                    onChange={(e) => setEditCategoryId(e.target.value)}
                                    className="h-11 w-full rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">— Select Category —</option>
                                    {categories
                                        .filter(c => !c.parent_id)
                                        .map(parent => (
                                            <optgroup key={parent.id} label={parent.name}>
                                                <option value={parent.id}>{parent.name} (Main)</option>
                                                {categories
                                                    .filter(c => c.parent_id === parent.id)
                                                    .map(sub => (
                                                        <option key={sub.id} value={sub.id}>{sub.name}</option>
                                                    ))
                                                }
                                            </optgroup>
                                        ))
                                    }
                                </select>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditModal({ open: false, match: null })}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleEditApprove}
                            disabled={!editCategoryId || processing === editModal.match?.id}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {processing === editModal.match?.id && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Approve with Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
