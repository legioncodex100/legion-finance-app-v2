"use client"

import * as React from "react"
import { Activity, Loader2, ChevronRight, ChevronDown, X, Store, Users, Package, Plus } from "lucide-react"

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

export default function ReportsPage() {
    const [report, setReport] = React.useState({
        income: [] as any[],
        expenses: [] as any[],
        totalIncome: 0,
        totalExpenses: 0,
        netIncome: 0,
        margin: 0
    })
    const [isLoading, setIsLoading] = React.useState(true)
    const supabase = createClient()

    // Drilldown modal state
    const [drilldownCategory, setDrilldownCategory] = React.useState<{ name: string, id: string | null, parentName: string | null } | null>(null)
    const [drilldownTransactions, setDrilldownTransactions] = React.useState<any[]>([])
    const [drilldownLoading, setDrilldownLoading] = React.useState(false)

    // Inline editing state
    const [expandedTxId, setExpandedTxId] = React.useState<string | null>(null)
    const [editingTxId, setEditingTxId] = React.useState<string | null>(null)
    const [categorySearch, setCategorySearch] = React.useState("")
    const [allCategories, setAllCategories] = React.useState<any[]>([])
    const [vendors, setVendors] = React.useState<any[]>([])
    const [staff, setStaff] = React.useState<any[]>([])

    // Asset creation state
    const [creatingAssetForTxId, setCreatingAssetForTxId] = React.useState<string | null>(null)
    const [newAssetName, setNewAssetName] = React.useState('')
    const [newAssetType, setNewAssetType] = React.useState<'fixed' | 'current'>('fixed')
    const [newAssetCategory, setNewAssetCategory] = React.useState('')
    const [linkedAssetTxIds, setLinkedAssetTxIds] = React.useState<Set<string>>(new Set())

    React.useEffect(() => {
        async function fetchReportData() {
            setIsLoading(true)

            // Fetch all categories first to build parent lookup
            const { data: fetchedCategories, error: catError } = await supabase
                .from('categories')
                .select('id, name, parent_id')

            console.log('Categories fetched:', fetchedCategories?.length, catError)
            console.log('Parent categories:', fetchedCategories?.filter(c => !c.parent_id).map(c => c.name))

            // Save categories for reconciliation modal
            if (fetchedCategories) {
                setAllCategories(fetchedCategories)
            }

            // Build category and parent lookup maps
            const categoryMap = new Map<string, { id: string, name: string, parent_id: string | null }>()
            fetchedCategories?.forEach(c => categoryMap.set(c.id, { id: c.id, name: c.name, parent_id: c.parent_id }))

            // Build parent name lookup
            const getParentName = (categoryId: string): string | null => {
                const cat = categoryMap.get(categoryId)
                if (!cat?.parent_id) return null
                return categoryMap.get(cat.parent_id)?.name || null
            }

            // Fetch ALL transactions with pagination (Supabase limits to 1000 per query)
            let allTransactions: any[] = []
            let page = 0
            const pageSize = 1000
            let hasMore = true

            while (hasMore) {
                const { data: batch, error: txError } = await supabase
                    .from('transactions')
                    .select('amount, type, confirmed, category_id')
                    .eq('confirmed', true)
                    .range(page * pageSize, (page + 1) * pageSize - 1)

                if (txError) {
                    console.error('Error fetching transactions:', txError)
                    break
                }

                if (batch && batch.length > 0) {
                    allTransactions = [...allTransactions, ...batch]
                    page++
                    hasMore = batch.length === pageSize
                } else {
                    hasMore = false
                }
            }

            console.log('Total transactions fetched:', allTransactions.length)
            const transactions = allTransactions

            if (transactions) {
                type GroupedCategory = {
                    total: number
                    children: Map<string, number>
                }
                const incomeGroups = new Map<string, GroupedCategory>()
                const expenseGroups = new Map<string, GroupedCategory>()
                let totalIncome = 0
                let totalExpenses = 0

                transactions.forEach(t => {
                    const amount = parseFloat(t.amount)
                    const cat = t.category_id ? categoryMap.get(t.category_id) : null

                    // Determine parent and child names
                    const parentName = cat ? getParentName(t.category_id!) : null
                    const categoryName = cat?.name || 'Uncategorized'

                    // If has parent, group under parent. Otherwise it's a top-level category
                    const groupName = parentName || categoryName
                    const childName = parentName ? categoryName : null

                    const groups = t.type === 'income' ? incomeGroups : expenseGroups
                    const absAmount = Math.abs(amount)

                    if (!groups.has(groupName)) {
                        groups.set(groupName, { total: 0, children: new Map() })
                    }
                    const group = groups.get(groupName)!
                    group.total += absAmount

                    if (childName) {
                        group.children.set(childName, (group.children.get(childName) || 0) + absAmount)
                    }

                    if (t.type === 'income') {
                        totalIncome += amount
                    } else {
                        totalExpenses += absAmount
                    }
                })

                // Convert to sorted arrays
                const formatGroups = (groups: Map<string, GroupedCategory>) => {
                    return Array.from(groups.entries())
                        .map(([label, data]) => ({
                            label,
                            value: data.total,
                            children: Array.from(data.children.entries())
                                .map(([name, val]) => ({ label: name, value: val }))
                                .sort((a, b) => b.value - a.value)
                        }))
                        .sort((a, b) => b.value - a.value)
                }

                setReport({
                    income: formatGroups(incomeGroups),
                    expenses: formatGroups(expenseGroups),
                    totalIncome,
                    totalExpenses,
                    netIncome: totalIncome - totalExpenses,
                    margin: totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0
                })
            }
            setIsLoading(false)
        }
        fetchReportData()
    }, [supabase])

    // Handle category drilldown click
    const handleCategoryDrilldown = async (categoryName: string, parentName: string | null = null) => {
        setDrilldownLoading(true)
        setDrilldownCategory({ name: categoryName, id: null, parentName })
        setDrilldownTransactions([])
        setExpandedTxId(null)

        // Find the category ID by name (and parent if it's a subcategory)
        let targetCategoryId: string | null = null
        if (parentName) {
            // It's a subcategory - find parent first
            const parent = allCategories.find(c => c.name === parentName && !c.parent_id)
            if (parent) {
                const child = allCategories.find(c => c.name === categoryName && c.parent_id === parent.id)
                targetCategoryId = child?.id || null
            }
        } else {
            // It's a parent category - get all subcategory IDs too
            const parent = allCategories.find(c => c.name === categoryName && !c.parent_id)
            targetCategoryId = parent?.id || null
        }

        if (!targetCategoryId) {
            setDrilldownLoading(false)
            return
        }

        // Fetch transactions for this category (and its children if it's a parent)
        let categoryIds = [targetCategoryId]
        if (!parentName) {
            // Include all children of this parent category
            const childIds = allCategories.filter(c => c.parent_id === targetCategoryId).map(c => c.id)
            categoryIds = [...categoryIds, ...childIds]
        }

        // Fetch transactions, vendors, and staff in parallel
        const [txResult, vendorResult, staffResult] = await Promise.all([
            supabase
                .from('transactions')
                .select('*, vendors(id, name), staff(id, name), categories(id, name)')
                .in('category_id', categoryIds)
                .order('transaction_date', { ascending: false })
                .limit(100),
            supabase.from('vendors').select('id, name').order('name'),
            supabase.from('staff').select('id, name').order('name')
        ])

        if (!txResult.error && txResult.data) {
            setDrilldownTransactions(txResult.data)
            // Check which transactions already have linked assets
            const txIds = txResult.data.map(tx => tx.id)
            const { data: existingAssets } = await supabase
                .from('assets')
                .select('linked_transaction_id')
                .in('linked_transaction_id', txIds)
            if (existingAssets) {
                setLinkedAssetTxIds(new Set(existingAssets.map(a => a.linked_transaction_id).filter(Boolean)))
            }
        }
        if (!vendorResult.error && vendorResult.data) {
            setVendors(vendorResult.data)
        }
        if (!staffResult.error && staffResult.data) {
            setStaff(staffResult.data)
        }
        setDrilldownLoading(false)
    }

    // Update a transaction's category inline
    const updateTransactionCategory = async (txId: string, newCategoryId: string) => {
        const { error } = await supabase
            .from('transactions')
            .update({ category_id: newCategoryId, confirmed: true })
            .eq('id', txId)

        if (!error) {
            // Update local state to reflect change
            setDrilldownTransactions(prev => prev.map(tx =>
                tx.id === txId
                    ? { ...tx, category_id: newCategoryId, categories: allCategories.find(c => c.id === newCategoryId) }
                    : tx
            ))
        }
        setEditingTxId(null)
        setCategorySearch("")
    }

    // Update vendor, staff, or notes
    const updateTransactionField = async (txId: string, field: 'vendor_id' | 'staff_id' | 'notes', value: string | null) => {
        const { error } = await supabase
            .from('transactions')
            .update({ [field]: value })
            .eq('id', txId)

        if (!error) {
            setDrilldownTransactions(prev => prev.map(tx => {
                if (tx.id !== txId) return tx
                const updated = { ...tx, [field]: value }
                if (field === 'vendor_id') {
                    updated.vendors = vendors.find(v => v.id === value) || null
                }
                if (field === 'staff_id') {
                    updated.staff = staff.find(s => s.id === value) || null
                }
                return updated
            }))
        }
    }

    if (isLoading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Financial Reports</h1>
                    <p className="text-muted-foreground">Detailed Profit & Loss and business performance analytics.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="h-10">All Time</Button>
                    <Button variant="outline" className="h-10">Download PDF</Button>
                </div>
            </div>

            <Card className="shadow-lg border-slate-200 dark:border-zinc-800">
                <CardHeader className="bg-slate-50/50 dark:bg-zinc-950/50 border-b border-slate-100 dark:border-zinc-900 px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-xl">Profit & Loss Statement</CardTitle>
                            <CardDescription>Live view based on your AI-categorized transactions.</CardDescription>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Net Margin</span>
                            <Badge className={`${report.margin >= 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400'} border-none font-bold text-sm px-3 py-0.5`}>
                                {report.margin.toFixed(1)}%
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8">
                    <div className="space-y-12">
                        {/* Revenue Section */}
                        <div>
                            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-zinc-900">
                                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-500">Income</h3>
                                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-500">Value (GBP)</span>
                            </div>
                            <div className="space-y-1">
                                {report.income.length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic">No income records available.</p>
                                ) : (
                                    report.income.map((group, i) => (
                                        <div key={i} className="mb-3">
                                            {/* Parent Category - Clickable */}
                                            <div
                                                onClick={() => handleCategoryDrilldown(group.label)}
                                                className="flex justify-between items-center py-2 px-2 -mx-2 rounded-lg cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors group"
                                            >
                                                <span className="text-sm font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-2">
                                                    {group.label}
                                                    <ChevronRight className="h-4 w-4 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </span>
                                                <span className="font-bold tabular-nums">£{group.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            {/* Subcategories - Clickable */}
                                            {group.children && group.children.length > 0 && (
                                                <div className="ml-4 mt-1 space-y-1 border-l-2 border-emerald-100 dark:border-emerald-900/50 pl-3">
                                                    {group.children.map((child: any, j: number) => (
                                                        <div
                                                            key={j}
                                                            onClick={() => handleCategoryDrilldown(child.label, group.label)}
                                                            className="flex justify-between items-center py-1 px-2 -mx-2 rounded cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors group"
                                                        >
                                                            <span className="text-xs text-slate-500 dark:text-zinc-500 font-medium group-hover:text-slate-700 dark:group-hover:text-zinc-300 transition-colors flex items-center gap-1">
                                                                {child.label}
                                                                <ChevronRight className="h-3 w-3 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            </span>
                                                            <span className="text-xs font-bold tabular-nums text-slate-400 dark:text-zinc-500">£{child.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                                <div className="flex justify-between items-center pt-4 mt-2 border-t border-slate-50 dark:border-zinc-900">
                                    <span className="font-bold text-black dark:text-white">Total Operating Income</span>
                                    <span className="text-lg font-black tabular-nums text-emerald-600">£{report.totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>

                        {/* Expenses Section */}
                        <div>
                            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-zinc-900">
                                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-rose-600 dark:text-rose-500">Operating Expenses</h3>
                                <span className="text-sm font-bold text-rose-600 dark:text-rose-500">Value (GBP)</span>
                            </div>
                            <div className="space-y-1">
                                {report.expenses.length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic">No expense records available.</p>
                                ) : (
                                    report.expenses.map((group, i) => (
                                        <div key={i} className="mb-3">
                                            {/* Parent Category - Clickable */}
                                            <div
                                                onClick={() => handleCategoryDrilldown(group.label)}
                                                className="flex justify-between items-center py-2 px-2 -mx-2 rounded-lg cursor-pointer hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors group"
                                            >
                                                <span className="text-sm font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-2">
                                                    {group.label}
                                                    <ChevronRight className="h-4 w-4 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </span>
                                                <span className="font-bold tabular-nums">£{group.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            {/* Subcategories - Clickable */}
                                            {group.children && group.children.length > 0 && (
                                                <div className="ml-4 mt-1 space-y-1 border-l-2 border-rose-100 dark:border-rose-900/50 pl-3">
                                                    {group.children.map((child: any, j: number) => (
                                                        <div
                                                            key={j}
                                                            onClick={() => handleCategoryDrilldown(child.label, group.label)}
                                                            className="flex justify-between items-center py-1 px-2 -mx-2 rounded cursor-pointer hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors group"
                                                        >
                                                            <span className="text-xs text-slate-500 dark:text-zinc-500 font-medium group-hover:text-slate-700 dark:group-hover:text-zinc-300 transition-colors flex items-center gap-1">
                                                                {child.label}
                                                                <ChevronRight className="h-3 w-3 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            </span>
                                                            <span className="text-xs font-bold tabular-nums text-slate-400 dark:text-zinc-500">£{child.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                                <div className="flex justify-between items-center pt-4 mt-2 border-t border-slate-50 dark:border-zinc-900">
                                    <span className="font-bold text-black dark:text-white">Total Operating Expenses</span>
                                    <span className="text-lg font-black tabular-nums text-rose-600">£{report.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>

                        {/* Net Result */}
                        <div className={`p-6 rounded-2xl flex items-center justify-between shadow-xl ${report.netIncome >= 0 ? 'bg-black dark:bg-white text-white dark:text-black' : 'bg-rose-600 text-white'}`}>
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-xl bg-white/10 dark:bg-black/10 flex items-center justify-center">
                                    <Activity className="h-6 w-6" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg mb-0.5">Net Operational Income</h4>
                                    <p className="text-[10px] uppercase font-bold opacity-60 tracking-widest">Post-Expense Cash Position</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-3xl font-black tabular-nums">£{report.netIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Category Drilldown Modal */}
            {drilldownCategory && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDrilldownCategory(null)}>
                    <div
                        className="bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-slate-200 dark:border-zinc-800"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-zinc-900">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-black">
                                        {drilldownCategory.parentName && (
                                            <span className="text-muted-foreground font-medium">{drilldownCategory.parentName} → </span>
                                        )}
                                        {drilldownCategory.name}
                                    </h2>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {drilldownTransactions.length} transaction{drilldownTransactions.length !== 1 ? 's' : ''} in this category
                                    </p>
                                </div>
                                <button
                                    onClick={() => setDrilldownCategory(null)}
                                    className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-900 rounded-lg transition-colors"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        {/* Transactions List */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {drilldownLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : drilldownTransactions.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <p className="text-sm">No transactions found in this category.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {drilldownTransactions.map((tx) => (
                                        <div key={tx.id} className="bg-slate-50 dark:bg-zinc-900/50 rounded-lg overflow-hidden">
                                            {/* Accordion Header */}
                                            <div
                                                onClick={() => setExpandedTxId(expandedTxId === tx.id ? null : tx.id)}
                                                className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${expandedTxId === tx.id
                                                    ? 'bg-indigo-100 dark:bg-indigo-950/50'
                                                    : 'hover:bg-slate-300 dark:hover:bg-zinc-600'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedTxId === tx.id ? 'rotate-0' : '-rotate-90'}`} />
                                                    <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                                                        {new Date(tx.transaction_date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: '2-digit' })}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <span className="font-medium truncate block">{tx.raw_party || tx.description || 'Unknown'}</span>
                                                        {tx.description && tx.description !== tx.raw_party && (
                                                            <span className="text-[10px] text-muted-foreground truncate block">{tx.description}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 ml-2">
                                                    <span className="text-xs font-medium text-muted-foreground bg-slate-200 dark:bg-zinc-800 px-2 py-0.5 rounded truncate max-w-[100px]">
                                                        {tx.categories?.name || 'Uncategorized'}
                                                    </span>
                                                    <span className={`font-bold tabular-nums whitespace-nowrap ${tx.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                        {tx.amount < 0 ? '-' : '+'}£{Math.abs(tx.amount).toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Accordion Content */}
                                            {expandedTxId === tx.id && (
                                                <div className="p-4 pt-0 space-y-4 border-t border-slate-200 dark:border-zinc-800">
                                                    {/* Category */}
                                                    <div className="pt-4">
                                                        <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground block mb-1">Category</label>
                                                        {editingTxId === tx.id ? (
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    autoFocus
                                                                    value={categorySearch}
                                                                    onChange={(e) => setCategorySearch(e.target.value)}
                                                                    onBlur={() => setTimeout(() => { setEditingTxId(null); setCategorySearch("") }, 200)}
                                                                    placeholder="Search categories..."
                                                                    className="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 outline-none focus:ring-2 ring-indigo-500/30"
                                                                />
                                                                <div className="absolute top-full left-0 mt-1 w-full max-h-48 overflow-y-auto bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-lg z-50">
                                                                    {allCategories.filter(c => !c.parent_id).filter(parent => {
                                                                        const s = categorySearch.toLowerCase()
                                                                        if (!s) return true
                                                                        return parent.name.toLowerCase().includes(s) || allCategories.some(ch => ch.parent_id === parent.id && ch.name.toLowerCase().includes(s))
                                                                    }).slice(0, 20).map(parent => (
                                                                        <div key={parent.id}>
                                                                            <div className="px-3 py-1 text-[10px] font-bold uppercase text-muted-foreground bg-slate-50 dark:bg-zinc-900/50 sticky top-0">{parent.name}</div>
                                                                            {allCategories.filter(c => c.parent_id === parent.id).filter(c => !categorySearch || c.name.toLowerCase().includes(categorySearch.toLowerCase()) || parent.name.toLowerCase().includes(categorySearch.toLowerCase())).map(child => (
                                                                                <div key={child.id} onMouseDown={() => updateTransactionCategory(tx.id, child.id)} className={`px-4 py-2 text-sm cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-950/30 ${tx.category_id === child.id ? 'bg-indigo-100 dark:bg-indigo-900/30 font-bold' : ''}`}>{child.name}</div>
                                                                            ))}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <button onClick={() => setEditingTxId(tx.id)} className="w-full text-left px-3 py-2 text-sm bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg hover:border-indigo-300 transition-colors">
                                                                {tx.categories?.name || <span className="text-muted-foreground">Select category...</span>}
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Vendor & Staff Row */}
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground flex items-center gap-1 mb-1">
                                                                <Store className="h-3 w-3" /> Vendor
                                                            </label>
                                                            <select
                                                                value={tx.vendor_id || ''}
                                                                onChange={(e) => updateTransactionField(tx.id, 'vendor_id', e.target.value || null)}
                                                                className="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 outline-none"
                                                            >
                                                                <option value="">No vendor</option>
                                                                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground flex items-center gap-1 mb-1">
                                                                <Users className="h-3 w-3" /> Staff
                                                            </label>
                                                            <select
                                                                value={tx.staff_id || ''}
                                                                onChange={(e) => updateTransactionField(tx.id, 'staff_id', e.target.value || null)}
                                                                className="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 outline-none"
                                                            >
                                                                <option value="">No staff</option>
                                                                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                            </select>
                                                        </div>
                                                    </div>

                                                    {/* Notes */}
                                                    <div>
                                                        <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground block mb-1">Notes</label>
                                                        <textarea
                                                            value={tx.notes || ''}
                                                            onChange={(e) => updateTransactionField(tx.id, 'notes', e.target.value || null)}
                                                            placeholder="Add a note..."
                                                            rows={2}
                                                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 outline-none resize-none"
                                                        />
                                                    </div>

                                                    {/* Register as Asset (expense transactions only) */}
                                                    {tx.amount < 0 && (
                                                        <div>
                                                            {linkedAssetTxIds.has(tx.id) ? (
                                                                <div className="w-full h-9 px-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 text-sm font-bold flex items-center justify-center gap-2">
                                                                    <Package className="h-4 w-4" /> Already Registered as Asset
                                                                </div>
                                                            ) : creatingAssetForTxId !== tx.id ? (
                                                                <button
                                                                    onClick={() => {
                                                                        setCreatingAssetForTxId(tx.id)
                                                                        setNewAssetName(tx.description || '')
                                                                    }}
                                                                    className="w-full h-9 px-3 rounded-lg border border-dashed border-sky-300 dark:border-sky-700 text-sky-600 dark:text-sky-400 text-sm font-bold flex items-center justify-center gap-2 hover:bg-sky-50 dark:hover:bg-sky-950/20 transition-colors"
                                                                >
                                                                    <Package className="h-4 w-4" /> Register as Asset
                                                                </button>
                                                            ) : (
                                                                <div className="p-3 rounded-lg bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800 space-y-3">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-[10px] font-bold uppercase text-sky-700 dark:text-sky-400">New Asset from £{Math.abs(tx.amount).toFixed(2)}</span>
                                                                        <button onClick={() => setCreatingAssetForTxId(null)} className="text-sky-600"><X className="h-4 w-4" /></button>
                                                                    </div>
                                                                    <input
                                                                        type="text"
                                                                        value={newAssetName}
                                                                        onChange={(e) => setNewAssetName(e.target.value)}
                                                                        placeholder="Asset name"
                                                                        className="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
                                                                    />
                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        <select value={newAssetType} onChange={(e) => setNewAssetType(e.target.value as any)} className="h-9 px-2 text-sm rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                                                                            <option value="fixed">Fixed</option>
                                                                            <option value="current">Current</option>
                                                                        </select>
                                                                        <select value={newAssetCategory} onChange={(e) => setNewAssetCategory(e.target.value)} className="h-9 px-2 text-sm rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                                                                            <option value="">Category</option>
                                                                            <option value="equipment">Equipment</option>
                                                                            <option value="technology">Technology</option>
                                                                            <option value="furniture">Furniture</option>
                                                                        </select>
                                                                    </div>
                                                                    <button
                                                                        disabled={!newAssetName}
                                                                        onClick={async () => {
                                                                            const { data: { user } } = await supabase.auth.getUser()
                                                                            if (user && newAssetName) {
                                                                                await supabase.from('assets').insert({
                                                                                    user_id: user.id,
                                                                                    name: newAssetName,
                                                                                    asset_type: newAssetType,
                                                                                    category: newAssetCategory || null,
                                                                                    purchase_date: tx.transaction_date,
                                                                                    purchase_price: Math.abs(tx.amount),
                                                                                    linked_transaction_id: tx.id,
                                                                                    status: 'active'
                                                                                })
                                                                                setCreatingAssetForTxId(null)
                                                                                setNewAssetName('')
                                                                            }
                                                                        }}
                                                                        className="w-full h-9 rounded-lg bg-sky-600 text-white font-bold text-sm hover:bg-sky-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                                                    >
                                                                        <Plus className="h-4 w-4" /> Create Asset
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
