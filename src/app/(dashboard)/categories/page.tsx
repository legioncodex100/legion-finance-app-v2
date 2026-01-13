"use client"

import * as React from "react"
import { Plus, FolderTree, ChevronRight, ChevronDown, MoreVertical, Edit2, Trash2, Loader2, RefreshCcw, Database, Settings2, AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { deleteCategories, clearConfigurationData, clearAllFinancialData, migrateCategoriesToClasses, getCategoryTransactionCount, migrateTransactionsToCategory } from "@/lib/actions/transactions"
import { CategoryModal } from "@/components/category-modal"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

export default function CategoriesPage() {
    const [categories, setCategories] = React.useState<any[]>([])
    const [rawCategories, setRawCategories] = React.useState<any[]>([])
    const [groupedCategories, setGroupedCategories] = React.useState<any[]>([])
    const [transactionCounts, setTransactionCounts] = React.useState<Record<string, number>>({})
    const [isLoading, setIsLoading] = React.useState(true)
    const [isMigrating, setIsMigrating] = React.useState(false)
    const [needsMigration, setNeedsMigration] = React.useState(false)
    const [isModalOpen, setIsModalOpen] = React.useState(false)
    const [editingCategory, setEditingCategory] = React.useState<any>(null)

    // Delete/Migration Modal State
    const [deleteModalOpen, setDeleteModalOpen] = React.useState(false)
    const [categoryToDelete, setCategoryToDelete] = React.useState<{ id: string, name: string, txCount: number } | null>(null)
    const [migrationTargetId, setMigrationTargetId] = React.useState<string>('')
    const [isDeleting, setIsDeleting] = React.useState(false)

    const supabase = createClient()

    const fetchCategories = React.useCallback(async () => {
        setIsLoading(true)
        const { data, error } = await supabase
            .from('categories')
            .select('*, financial_classes(name)')
            .order('code', { ascending: true })

        if (error) {
            console.error('Fetch categories error:', error);
        }

        if (data) {
            console.log('Fetched categories:', data);
            setRawCategories(data);
            const mainCategories = data.filter(c => !c.parent_id);
            const subCategories = data.filter(c => c.parent_id);

            // 1. Check if migration is needed
            setNeedsMigration(data.some(c => !c.class_id))

            // 2. Build grouped view
            const groups: Record<string, any[]> = {}
            mainCategories.forEach(main => {
                const className = main.financial_classes?.name || "Unclassified"
                if (!groups[className]) groups[className] = []

                groups[className].push({
                    ...main,
                    subs: subCategories.filter(sub => sub.parent_id === main.id)
                })
            })

            // Convert record to sorted array of groups
            const structured = Object.keys(groups).map(name => ({
                name,
                categories: groups[name]
            })).sort((a, b) => {
                // Keep Unclassified at the bottom
                if (a.name === "Unclassified") return 1
                if (b.name === "Unclassified") return -1
                return a.name.localeCompare(b.name)
            })

            setGroupedCategories(structured)
            setCategories(mainCategories)

            // Fetch transaction counts per category
            const { data: txCounts } = await supabase
                .from('transactions')
                .select('category_id')

            if (txCounts) {
                const counts: Record<string, number> = {}
                txCounts.forEach(tx => {
                    if (tx.category_id) {
                        counts[tx.category_id] = (counts[tx.category_id] || 0) + 1
                    }
                })
                setTransactionCounts(counts)
            }
        }
        setIsLoading(false)
    }, [supabase])

    const handleDelete = async (id: string, name: string) => {
        // Check if category has transactions
        const txCount = transactionCounts[id] || 0

        if (txCount > 0) {
            // Show migration modal
            setCategoryToDelete({ id, name, txCount })
            setMigrationTargetId('')
            setDeleteModalOpen(true)
        } else {
            // No transactions, confirm simple delete
            if (!confirm(`Delete "${name}"? This category has no transactions.`)) return
            try {
                await deleteCategories([id])
                fetchCategories()
            } catch (error) {
                alert("Failed to delete category.")
            }
        }
    }

    const handleConfirmDelete = async () => {
        if (!categoryToDelete) return
        setIsDeleting(true)

        try {
            // Migrate transactions if target selected
            if (migrationTargetId) {
                await migrateTransactionsToCategory(categoryToDelete.id, migrationTargetId)
            } else {
                // Set transactions to uncategorized
                await migrateTransactionsToCategory(categoryToDelete.id, null)
            }

            // Now delete the category
            await deleteCategories([categoryToDelete.id])

            setDeleteModalOpen(false)
            setCategoryToDelete(null)
            fetchCategories()
        } catch (error) {
            alert("Failed to delete/migrate category.")
        } finally {
            setIsDeleting(false)
        }
    }

    const handleMigrate = async () => {
        setIsMigrating(true)
        try {
            const result = await migrateCategoriesToClasses()
            if (result.success) {
                alert(`Successfully migrated ${result.count} categories!`)
                fetchCategories()
            }
        } catch (error) {
            console.error(error)
            alert("Migration failed")
        } finally {
            setIsMigrating(false)
        }
    }

    const handleClearConfiguration = async () => {
        if (!confirm("⚠️ RESET CATEGORIES: This will delete ALL Categories and Vendors. Transactions will remain but will become 'Uncategorized'. Proceed?")) return;
        try {
            await clearConfigurationData();
            fetchCategories();
            alert("Chart of accounts reset successfully.");
        } catch (error) {
            alert("Failed to reset categories.");
        }
    }

    const handleClearAll = async () => {
        if (!confirm("⚠️ FACTORY RESET: This will permanently delete EVERYTHING (transactions, categories, invoices, debts, etc.). This cannot be undone. Proceed?")) return;
        try {
            await clearAllFinancialData();
            fetchCategories();
            alert("System wiped successfully. You now have a fresh start.");
        } catch (error) {
            alert("Failed to clear data.");
        }
    }

    React.useEffect(() => {
        fetchCategories()
    }, [fetchCategories])

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Financial Categories</h1>
                    <p className="text-muted-foreground">Define your chart of accounts with categories and subcategories.</p>
                </div>
                <div className="flex gap-3">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="h-10 border-rose-200 text-rose-600 hover:bg-rose-50 gap-2">
                                <RefreshCcw className="h-4 w-4" /> Reset Setup <ChevronDown className="h-3 w-3 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Reset Options</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleClearConfiguration} className="text-orange-600 focus:text-orange-600 gap-2 cursor-pointer">
                                <Settings2 className="h-4 w-4" /> Reset Categories Only
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleClearAll} className="bg-rose-50 text-rose-600 focus:bg-rose-100 focus:text-rose-700 gap-2 font-bold cursor-pointer">
                                <Trash2 className="h-4 w-4" /> Factory Reset
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                        className="h-10 gap-2 bg-black hover:bg-zinc-800 text-white dark:bg-white dark:text-black"
                        onClick={() => {
                            setEditingCategory(null)
                            setIsModalOpen(true)
                        }}
                    >
                        <Plus className="h-4 w-4" /> Add Category
                    </Button>
                </div>
            </div>

            {needsMigration && (
                <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 p-4 shadow-sm border-l-4 border-l-amber-500 overflow-hidden relative group">
                    <div className="flex items-start gap-4">
                        <div className="bg-amber-100 dark:bg-amber-900/40 p-2 rounded-lg">
                            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="flex-1 space-y-1">
                            <h3 className="font-bold text-amber-900 dark:text-amber-100">Legacy Data Detected</h3>
                            <p className="text-sm text-amber-800/80 dark:text-amber-200/60 leading-tight">
                                Some categories are not linked to accounting classes. Link them to unlock granular reporting and correct P&L grouping.
                            </p>
                            <div className="pt-2">
                                <Button
                                    size="sm"
                                    onClick={handleMigrate}
                                    disabled={isMigrating}
                                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold h-8 gap-2 px-4 animate-in slide-in-from-left-4"
                                >
                                    {isMigrating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
                                    {isMigrating ? "Mapping Data..." : "Auto-Migrate to New Classes"}
                                </Button>
                            </div>
                        </div>
                        <div className="absolute right-[-20px] top-[-20px] opacity-[0.03] rotate-12 pointer-events-none group-hover:scale-110 transition-transform">
                            <Database className="h-32 w-32" />
                        </div>
                    </div>
                </Card>
            )}

            {isLoading ? (
                <div className="flex h-[40vh] items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : categories.length === 0 ? (
                <Card className="border-dashed border-2 p-12 text-center bg-slate-50/30 dark:bg-white/5">
                    <div className="flex flex-col items-center gap-4">
                        <div className="h-16 w-16 rounded-full bg-slate-100 dark:bg-zinc-900 flex items-center justify-center">
                            <FolderTree className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">No Categories Defined</h3>
                            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                Start by creating your main financial categories like "Facility", "Revenue", or "Operations".
                            </p>
                        </div>
                        <Button className="mt-2 bg-black text-white dark:bg-white dark:text-black" onClick={() => setIsModalOpen(true)}>Create First Category</Button>
                    </div>
                </Card>
            ) : (
                <div className="space-y-12">
                    {groupedCategories.map((group) => (
                        <div key={group.name} className="space-y-4">
                            <div className="flex items-center gap-4 px-2">
                                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground/60 flex items-center gap-3">
                                    <span className="h-[1px] w-8 bg-muted-foreground/20"></span>
                                    {group.name}
                                    <span className="h-[1px] flex-1 bg-muted-foreground/20 w-32"></span>
                                </h2>
                                <Badge variant="secondary" className="text-[9px] font-black opacity-40">
                                    {group.categories.length} Sections
                                </Badge>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {group.categories.map((category: any) => (
                                    <Card key={category.id} className="shadow-none border border-border bg-card/40 hover:bg-card/60 transition-colors">
                                        <CardHeader className="flex flex-row items-start justify-between p-4 space-y-0 pb-2">
                                            <div className="flex items-center gap-3">
                                                <div className={`h-8 w-8 rounded-lg flex items-center justify-center border ${category.type === 'income' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                                                    <FolderTree className="h-4 w-4" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <CardTitle className="text-sm font-bold truncate pr-2 leading-none">
                                                        {category.code && <span className="text-muted-foreground font-mono mr-2">{category.code}</span>}
                                                        {category.name}
                                                    </CardTitle>
                                                    <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">
                                                        {category.type}
                                                    </CardDescription>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 -mr-2 -mt-2">
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => {
                                                    setEditingCategory({
                                                        parentId: category.id,
                                                        type: category.type,
                                                        class_id: category.class_id
                                                    })
                                                    setIsModalOpen(true)
                                                }}>
                                                    <Plus className="h-3 w-3" />
                                                </Button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                                                            <MoreVertical className="h-3 w-3" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => {
                                                            setEditingCategory(category)
                                                            setIsModalOpen(true)
                                                        }}>
                                                            <Edit2 className="h-3 w-3 mr-2" /> Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => handleDelete(category.id, category.name)} className="text-rose-600 focus:text-rose-600">
                                                            <Trash2 className="h-3 w-3 mr-2" /> Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <div className="divide-y divide-border/40">
                                                {category.subs.length === 0 ? (
                                                    <div className="px-4 py-6 text-center">
                                                        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground/60 hover:text-foreground" onClick={() => {
                                                            // Pre-fill parent ID when adding sub to empty
                                                            setEditingCategory({
                                                                parentId: category.id,
                                                                type: category.type,
                                                                class_id: category.class_id
                                                            })
                                                            setIsModalOpen(true)
                                                        }}>
                                                            <Plus className="h-3 w-3 mr-1.5" />
                                                            Add Subcategory
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    category.subs.map((sub: any) => (
                                                        <div key={sub.id} className="flex items-center justify-between py-2 px-4 hover:bg-muted/50 transition-colors group">
                                                            <div className="flex items-center gap-4">
                                                                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-30 group-hover:opacity-100 transition-opacity" />
                                                                <span className="font-semibold text-sm">
                                                                    {sub.code && <span className="text-muted-foreground font-mono mr-2 text-xs">{sub.code}</span>}
                                                                    {sub.name}
                                                                </span>
                                                                {transactionCounts[sub.id] && (
                                                                    <Badge variant="secondary" className="text-[10px] font-bold ml-2">
                                                                        {transactionCounts[sub.id]} txns
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                                                                    setEditingCategory(sub)
                                                                    setIsModalOpen(true)
                                                                }}><Edit2 className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                                                                <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-rose-500" onClick={() => handleDelete(sub.id, sub.name)}><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <CategoryModal
                category={editingCategory}
                parentCategories={rawCategories}
                isOpen={isModalOpen}
                onOpenChange={setIsModalOpen}
                onUpdate={fetchCategories}
            />

            {/* Delete/Migration Modal */}
            <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-rose-600">
                            <AlertTriangle className="h-5 w-5" />
                            Delete Category
                        </DialogTitle>
                        <DialogDescription>
                            <strong className="text-foreground">"{categoryToDelete?.name}"</strong> has{' '}
                            <strong className="text-rose-600">{categoryToDelete?.txCount} transactions</strong>.
                            Choose what to do with them:
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold">Move transactions to:</label>
                            <select
                                value={migrationTargetId}
                                onChange={(e) => setMigrationTargetId(e.target.value)}
                                className="w-full h-10 rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 text-sm"
                            >
                                <option value="">— Leave Uncategorized —</option>
                                {rawCategories
                                    .filter(c => c.id !== categoryToDelete?.id)
                                    .map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.code ? `${c.code} - ` : ''}{c.name}
                                        </option>
                                    ))
                                }
                            </select>
                        </div>

                        <div className="p-3 bg-slate-50 dark:bg-zinc-900 rounded-lg text-sm">
                            {migrationTargetId ? (
                                <p className="flex items-center gap-2 text-emerald-600">
                                    <ArrowRight className="h-4 w-4" />
                                    {categoryToDelete?.txCount} transactions will be moved to{' '}
                                    <strong>{rawCategories.find(c => c.id === migrationTargetId)?.name}</strong>
                                </p>
                            ) : (
                                <p className="flex items-center gap-2 text-amber-600">
                                    <AlertTriangle className="h-4 w-4" />
                                    {categoryToDelete?.txCount} transactions will become uncategorized
                                </p>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setDeleteModalOpen(false)} disabled={isDeleting}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleConfirmDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Migrating...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete & {migrationTargetId ? 'Move' : 'Uncategorize'}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
