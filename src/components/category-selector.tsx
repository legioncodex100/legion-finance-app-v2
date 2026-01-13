"use client"

import * as React from "react"
import { Search, Plus, Check, ChevronRight, Loader2, Minus, PlusCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { updateTransactionDetails, quickCreateCategory } from "@/lib/actions/transactions"

interface Category {
    id: string
    name: string
    type: 'income' | 'expense'
    parent_id?: string
    parent?: { name: string }
}

interface CategorySelectorProps {
    transactionId: string
    amount: number
    currentCategoryId?: string | null
    aiSuggestion?: string | null
    confirmed?: boolean
    categories: any[]
    onUpdate: () => void
}

export function CategorySelector({
    transactionId,
    amount,
    currentCategoryId,
    aiSuggestion,
    confirmed,
    categories,
    onUpdate
}: CategorySelectorProps) {
    const [isOpen, setIsOpen] = React.useState(false)
    const [search, setSearch] = React.useState("")
    const [isCreating, setIsCreating] = React.useState(false)
    const containerRef = React.useRef<HTMLDivElement>(null)

    const isIncome = amount > 0
    const type = isIncome ? 'income' : 'expense'

    // Filter categories by type and search
    // Group them by parent - show ALL categories, not just those with subs
    const filteredCategories = React.useMemo(() => {
        const matchingType = categories.filter(c => c.type === type)
        const parents = matchingType.filter(c => !c.parent_id)
        const lowSearch = search.toLowerCase()

        return parents.map(p => ({
            ...p,
            subs: matchingType.filter(c => c.parent_id === p.id)
                .filter(c => !search || c.name.toLowerCase().includes(lowSearch))
        })).filter(p =>
            !search ||
            p.name.toLowerCase().includes(lowSearch) ||
            p.subs.length > 0
        )
    }, [categories, search, type])

    const currentCategory = categories.find(c => c.id === currentCategoryId)
    const currentCategoryName = currentCategory
        ? `${currentCategory.parent?.name || ''} ${currentCategory.parent ? '>' : ''} ${currentCategory.name}`.trim()
        : null

    const handleSelect = async (categoryId: string) => {
        try {
            await updateTransactionDetails(transactionId, { categoryId })
            setIsOpen(false)
            onUpdate()
        } catch (error) {
            console.error(error)
        }
    }

    const handleQuickCreate = async () => {
        if (!search) return
        setIsCreating(true)
        try {
            // Find or create a parent if needed? Let's keep it simple: create under "OTHER" or similar if no parent selected
            // For now, let's just create a top-level category or ask for parent.
            // Simplified: create as sub of first matching group or top level
            const defaultParent = categories.find(c => !c.parent_id && c.type === type)
            const newCat = await quickCreateCategory(search, type, defaultParent?.id)
            await updateTransactionDetails(transactionId, { categoryId: newCat.id })
            setSearch("")
            setIsOpen(false)
            onUpdate()
        } catch (error) {
            console.error(error)
        } finally {
            setIsCreating(false)
        }
    }

    // Close on click outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex flex-col items-start w-full text-left transition-all group",
                    isOpen ? "opacity-100" : ""
                )}
            >
                {confirmed && currentCategoryName ? (
                    <span className="text-[11px] font-bold text-primary truncate max-w-[200px] bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded border border-slate-200 dark:border-zinc-700">
                        {currentCategoryName}
                    </span>
                ) : (
                    <div className="flex flex-col">
                        <span className="text-[11px] font-medium text-muted-foreground/50 italic group-hover:text-primary transition-colors">
                            {aiSuggestion || "Select Category..."}
                        </span>
                        {!confirmed && (
                            <span className="text-[9px] uppercase font-black tracking-widest text-indigo-500/60 mt-0.5">
                                AI Suggestion
                            </span>
                        )}
                    </div>
                )}
            </button>

            {isOpen && (
                <div className="absolute z-50 top-full left-0 mt-2 w-64 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                    <div className="p-3 border-b border-slate-100 dark:border-zinc-900 flex items-center gap-2">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <input
                            autoFocus
                            placeholder="Search or add category..."
                            className="bg-transparent border-none outline-none text-sm w-full"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="max-h-64 overflow-y-auto p-2">
                        {filteredCategories.length === 0 && !search && (
                            <div className="p-4 text-center text-xs text-muted-foreground italic">
                                No categories.
                            </div>
                        )}

                        {filteredCategories.map((p) => (
                            <div key={p.id} className="mb-2 last:mb-0">
                                <button
                                    onClick={() => handleSelect(p.id)}
                                    className={cn(
                                        "w-full text-left px-2 py-1.5 text-[10px] uppercase font-black tracking-widest flex items-center justify-between rounded-md transition-colors",
                                        currentCategoryId === p.id
                                            ? "bg-slate-100 dark:bg-zinc-800 text-primary"
                                            : "text-muted-foreground/60 hover:bg-slate-50 dark:hover:bg-zinc-900 hover:text-primary"
                                    )}
                                >
                                    {p.name}
                                    {currentCategoryId === p.id && <Check className="h-3 w-3" />}
                                </button>
                                <div className="mt-1 space-y-1">
                                    {p.subs.length === 0 ? (
                                        <div className="px-4 py-1 text-[10px] text-muted-foreground/40 italic">
                                            (No subcategories)
                                        </div>
                                    ) : (
                                        p.subs.map((sub: any) => (
                                            <button
                                                key={sub.id}
                                                onClick={() => handleSelect(sub.id)}
                                                className={cn(
                                                    "w-full text-left px-4 py-2 text-sm rounded-lg flex items-center justify-between transition-colors",
                                                    currentCategoryId === sub.id
                                                        ? "bg-slate-100 dark:bg-zinc-800 text-primary font-bold"
                                                        : "hover:bg-slate-50 dark:hover:bg-zinc-900 text-muted-foreground hover:text-primary"
                                                )}
                                            >
                                                {sub.name}
                                                {currentCategoryId === sub.id && <Check className="h-3.5 w-3.5" />}
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        ))}

                        {search && (
                            <button
                                onClick={handleQuickCreate}
                                disabled={isCreating}
                                className="w-full mt-2 flex items-center gap-2 p-2 px-3 text-sm font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg transition-colors border border-dashed border-indigo-200 dark:border-indigo-900/50"
                            >
                                {isCreating ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <PlusCircle className="h-4 w-4" />
                                )}
                                Add "{search}" to {isIncome ? 'Income' : 'Expenses'}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
