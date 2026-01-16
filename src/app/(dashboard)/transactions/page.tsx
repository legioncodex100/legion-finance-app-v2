"use client"

import * as React from "react"
import { Plus, Search, Filter, ArrowUpRight, ArrowDownRight, Upload, Loader2, CheckCircle2, AlertCircle, Trash2, MessageSquare, ChevronDown, Database, Settings2, RefreshCcw, ArrowUpDown, ArrowUp, ArrowDown, Receipt, X, FileText, Banknote } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { StatCard } from "@/components/dashboard/stat-card"
import { Badge } from "@/components/ui/badge"
import { parseStarlingCSV } from "@/lib/transactions-parser"
import { importTransactions, deleteTransactions, uncategorizeTransactions, bulkReconcileTransactions, clearLedgerData, clearConfigurationData, clearAllFinancialData, getOpeningBalance, setOpeningBalance, getSummaryStats, linkTransactionToPayable, unlinkTransactionFromPayable, getPayablesForLinking } from "@/lib/actions/transactions"
import { createClient } from "@/lib/supabase/client"
import { CategorySelector } from "@/components/category-selector"
import { ReconciliationModal } from "@/components/reconciliation-modal"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { syncStarlingTransactions, getStarlingBalance } from "@/lib/actions/starling"

export default function TransactionsPage() {
    const [items, setItems] = React.useState<any[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const [isImporting, setIsImporting] = React.useState(false)
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
    const [categories, setCategories] = React.useState<any[]>([])

    // Filters - default to current month/year
    const [filterStatus, setFilterStatus] = React.useState<'all' | 'reconciled' | 'pending'>('all')
    const [filterMonth, setFilterMonth] = React.useState<string>((new Date().getMonth() + 1).toString())
    const [filterYear, setFilterYear] = React.useState<string>(new Date().getFullYear().toString())
    const [searchQuery, setSearchQuery] = React.useState("")
    const [debouncedSearch, setDebouncedSearch] = React.useState("")
    const [reconcileTx, setReconcileTx] = React.useState<any>(null)
    const [isReconcileModalOpen, setIsReconcileModalOpen] = React.useState(false)
    const [isBulkReconcileModalOpen, setIsBulkReconcileModalOpen] = React.useState(false)
    const [bulkCategoryId, setBulkCategoryId] = React.useState<string>("")
    const [bulkCategorySearch, setBulkCategorySearch] = React.useState("")
    const [bulkCategoryDropdownOpen, setBulkCategoryDropdownOpen] = React.useState(false)
    const [openingBalance, setOpeningBalanceState] = React.useState<number>(0)

    // Invoice linking
    const [invoices, setInvoices] = React.useState<any[]>([])
    const [linkingTx, setLinkingTx] = React.useState<any>(null)
    const [isInvoiceLinkModalOpen, setIsInvoiceLinkModalOpen] = React.useState(false)
    const [selectedInvoiceId, setSelectedInvoiceId] = React.useState<string>("")
    const [linkAmount, setLinkAmount] = React.useState<string>("")

    // Payable linking (unified - replaces bills/invoices)
    const [payables, setPayables] = React.useState<any[]>([])
    const [linkingPayableTx, setLinkingPayableTx] = React.useState<any>(null)
    const [isPayableLinkModalOpen, setIsPayableLinkModalOpen] = React.useState(false)
    const [selectedPayableId, setSelectedPayableId] = React.useState<string>("")
    const [payableSearch, setPayableSearch] = React.useState<string>("")

    // Pagination
    const [currentPage, setCurrentPage] = React.useState(1)
    const [totalCount, setTotalCount] = React.useState(0)
    const PAGE_SIZE = 50

    // Summary stats (fetched separately to include ALL transactions)
    const [summaryStats, setSummaryStats] = React.useState({ income: 0, expense: 0, net: 0 })
    const [reconciledCount, setReconciledCount] = React.useState(0)
    const [pendingCount, setPendingCount] = React.useState(0)

    // Add transaction modal
    const [isAddTxModalOpen, setIsAddTxModalOpen] = React.useState(false)
    const [newTxDate, setNewTxDate] = React.useState(new Date().toISOString().split('T')[0])
    const [newTxDescription, setNewTxDescription] = React.useState('')
    const [newTxAmount, setNewTxAmount] = React.useState('')
    const [newTxType, setNewTxType] = React.useState<'income' | 'expense'>('expense')
    const [newTxCategoryId, setNewTxCategoryId] = React.useState('')
    const [newTxPayeeType, setNewTxPayeeType] = React.useState<'vendor' | 'staff'>('vendor')
    const [newTxVendorId, setNewTxVendorId] = React.useState('')
    const [newTxStaffId, setNewTxStaffId] = React.useState('')
    const [newTxNotes, setNewTxNotes] = React.useState('')
    const [isAddingTx, setIsAddingTx] = React.useState(false)
    const [vendors, setVendors] = React.useState<any[]>([])
    const [staff, setStaff] = React.useState<any[]>([])

    // Sorting
    const [sortColumn, setSortColumn] = React.useState<'date' | 'amount' | 'party' | 'status'>('date')
    const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('desc')

    // Bank sync
    const [isSyncingBank, setIsSyncingBank] = React.useState(false)
    const [lastBankBalance, setLastBankBalance] = React.useState<number | null>(null)
    const [syncModalOpen, setSyncModalOpen] = React.useState(false)
    const [syncFromDate, setSyncFromDate] = React.useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    const [syncToDate, setSyncToDate] = React.useState(new Date().toISOString().split('T')[0])
    const [lastSyncDate, setLastSyncDate] = React.useState<string | null>(null)

    // Load bank balance and last sync date from localStorage after mount
    React.useEffect(() => {
        const savedBalance = localStorage.getItem('lastBankBalance')
        if (savedBalance) {
            setLastBankBalance(parseFloat(savedBalance))
        }
        const savedSyncDate = localStorage.getItem('lastSyncDate')
        if (savedSyncDate) {
            setLastSyncDate(savedSyncDate)
            // Smart default: start from last sync date
            setSyncFromDate(savedSyncDate)
        }
    }, [])

    // Persist bank balance to localStorage when it changes
    React.useEffect(() => {
        if (lastBankBalance !== null) {
            localStorage.setItem('lastBankBalance', lastBankBalance.toString())
        }
    }, [lastBankBalance])

    // Debounce search input and reset to page 1
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery)
            setCurrentPage(1)  // Reset to page 1 when search changes
        }, 300)
        return () => clearTimeout(timer)
    }, [searchQuery])

    const supabase = createClient()

    // Fetch summary stats using server action (respects month/year filters)
    const fetchSummaryStats = React.useCallback(async () => {
        try {
            // Parse filter values (convert 'all' to undefined)
            const month = filterMonth !== 'all' ? parseInt(filterMonth) : undefined
            const year = filterYear !== 'all' ? parseInt(filterYear) : undefined

            const stats = await getSummaryStats(month, year)
            setSummaryStats({ income: stats.income, expense: stats.expense, net: stats.net })
            // Only set totalCount when NOT searching (search sets its own filtered count)
            if (!debouncedSearch) {
                setTotalCount(stats.count)
            }
        } catch (e) {
            console.error("Failed to fetch summary stats:", e)
        }
    }, [debouncedSearch, filterMonth, filterYear])


    const fetchTransactions = React.useCallback(async () => {
        setIsLoading(true)

        let query = supabase
            .from('transactions')
            .select('*, vendors(name), staff(name, role), payables:linked_payable_id(id, name, amount, next_due)')

        // Apply Sorting
        if (sortColumn === 'date') {
            query = query.order('transaction_date', { ascending: sortDirection === 'asc' })
        } else if (sortColumn === 'amount') {
            query = query.order('amount', { ascending: sortDirection === 'asc' })
        } else if (sortColumn === 'status') {
            query = query.order('confirmed', { ascending: sortDirection === 'asc' })
        } else {
            // Default fallback
            query = query.order('transaction_date', { ascending: false })
        }

        // Apply Status Filter
        if (filterStatus === 'reconciled') {
            query = query.eq('confirmed', true)
        } else if (filterStatus === 'pending') {
            query = query.eq('confirmed', false)
        }

        // Apply Date Filters
        if (filterYear !== 'all') {
            const startYear = `${filterYear}-01-01`
            const endYear = `${filterYear}-12-31`

            if (filterMonth !== 'all') {
                const monthStr = filterMonth.padStart(2, '0')
                const startMonth = `${filterYear}-${monthStr}-01`
                const endMonth = new Date(parseInt(filterYear), parseInt(filterMonth), 0).toISOString().split('T')[0]
                query = query.gte('transaction_date', startMonth).lte('transaction_date', endMonth)
            } else {
                query = query.gte('transaction_date', startYear).lte('transaction_date', endYear)
            }
        }

        // If searching, use server-side filtering to search across ALL transactions
        if (debouncedSearch) {
            // Use textSearch for full-text search across columns
            const searchTerm = debouncedSearch.trim()

            // Supabase or filter with ilike - search description and raw_party (bank party name)
            query = query.or(`description.ilike.*${searchTerm}*,raw_party.ilike.*${searchTerm}*`)

            const { data, error } = await query.limit(200)

            if (error) console.error('Search error:', error)

            if (data) {
                setItems(data)
                setTotalCount(data.length)
            }
        } else {
            // Normal pagination when not searching
            const from = (currentPage - 1) * PAGE_SIZE
            const to = from + PAGE_SIZE - 1

            // Get count first
            let countQuery = supabase
                .from('transactions')
                .select('id', { count: 'exact', head: true })

            if (filterStatus === 'reconciled') {
                countQuery = countQuery.eq('confirmed', true)
            } else if (filterStatus === 'pending') {
                countQuery = countQuery.eq('confirmed', false)
            }
            if (filterYear !== 'all') {
                const startYear = `${filterYear}-01-01`
                const endYear = `${filterYear}-12-31`
                if (filterMonth !== 'all') {
                    const monthStr = filterMonth.padStart(2, '0')
                    const startMonth = `${filterYear}-${monthStr}-01`
                    const endMonth = new Date(parseInt(filterYear), parseInt(filterMonth), 0).toISOString().split('T')[0]
                    countQuery = countQuery.gte('transaction_date', startMonth).lte('transaction_date', endMonth)
                } else {
                    countQuery = countQuery.gte('transaction_date', startYear).lte('transaction_date', endYear)
                }
            }

            const { count } = await countQuery
            if (count !== null) setTotalCount(count)

            // Apply pagination
            query = query.range(from, to)

            const { data, error } = await query

            if (data) {
                setItems(data)
            }
        }
        setIsLoading(false)
    }, [supabase, filterStatus, filterMonth, filterYear, debouncedSearch, currentPage, sortColumn, sortDirection])


    const fetchCategories = React.useCallback(async () => {
        const { data } = await supabase
            .from('categories')
            .select('*, parent:parent_id(name), financial_classes(name)')
        if (data) setCategories(data)
    }, [supabase])

    const fetchVendors = React.useCallback(async () => {
        const { data } = await supabase.from('vendors').select('id, name').order('name')
        if (data) setVendors(data)
    }, [supabase])

    const fetchStaff = React.useCallback(async () => {
        const { data } = await supabase.from('staff').select('id, name').order('name')
        if (data) setStaff(data)
    }, [supabase])

    const fetchOpeningBalanceData = React.useCallback(async () => {
        try {
            const balance = await getOpeningBalance()
            setOpeningBalanceState(balance)
        } catch (e) { console.error(e) }
    }, [])

    const fetchReconciliationCounts = React.useCallback(async () => {
        try {
            const [reconciledResult, pendingResult] = await Promise.all([
                supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('confirmed', true),
                supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('confirmed', false)
            ])
            setReconciledCount(reconciledResult.count || 0)
            setPendingCount(pendingResult.count || 0)
        } catch (e) { console.error(e) }
    }, [supabase])

    // Fetch pending invoices for linking
    const fetchInvoices = React.useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase
            .from('invoices')
            .select('*, staff(name)')
            .eq('user_id', user.id)
            .in('status', ['pending', 'review'])
            .order('created_at', { ascending: false })
        setInvoices(data || [])
    }, [supabase])

    // Fetch payables for linking
    const fetchPayables = React.useCallback(async () => {
        try {
            const data = await getPayablesForLinking()
            setPayables(data)
        } catch (e) { console.error(e) }
    }, [])

    // Link transaction to payable
    const handleLinkToPayable = async () => {
        if (!linkingPayableTx || !selectedPayableId) return
        try {
            const result = await linkTransactionToPayable(linkingPayableTx.id, selectedPayableId)
            if (result.success) {
                setIsPayableLinkModalOpen(false)
                setLinkingPayableTx(null)
                setSelectedPayableId("")
                fetchPayables()
                fetchTransactions()
                alert('Transaction linked to payable! Payable marked as paid.')
            } else {
                alert('Failed to link: ' + result.error)
            }
        } catch (e) {
            alert('Failed to link transaction to payable')
        }
    }

    // Link transaction to invoice
    const handleLinkToInvoice = async () => {
        if (!linkingTx || !selectedInvoiceId || !linkAmount) return
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const amount = parseFloat(linkAmount)
        const { error } = await supabase.from('invoice_payments').insert({
            invoice_id: selectedInvoiceId,
            transaction_id: linkingTx.id,
            amount: amount,
            user_id: user.id
        })

        if (error) {
            alert('Failed to link: ' + error.message)
            return
        }

        // Check if invoice is fully paid and update status
        const { data: payments } = await supabase
            .from('invoice_payments')
            .select('amount')
            .eq('invoice_id', selectedInvoiceId)

        const selectedInvoice = invoices.find(i => i.id === selectedInvoiceId)
        const totalPaid = (payments || []).reduce((sum, p) => sum + p.amount, 0)

        if (selectedInvoice && totalPaid >= selectedInvoice.amount) {
            await supabase.from('invoices').update({
                status: 'paid',
                paid_at: new Date().toISOString().split('T')[0]
            }).eq('id', selectedInvoiceId)
        }

        setIsInvoiceLinkModalOpen(false)
        setLinkingTx(null)
        setSelectedInvoiceId("")
        setLinkAmount("")
        fetchInvoices()
        alert('Transaction linked to invoice!')
    }

    React.useEffect(() => {
        fetchTransactions()
        fetchCategories()
        fetchVendors()
        fetchStaff()
        fetchOpeningBalanceData()
        fetchSummaryStats()
        fetchReconciliationCounts()
        fetchInvoices()
        fetchPayables()
    }, [fetchTransactions, fetchCategories, fetchVendors, fetchStaff, fetchOpeningBalanceData, fetchSummaryStats, fetchReconciliationCounts, fetchInvoices, fetchPayables])


    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsImporting(true)
        try {
            const parsedData = await parseStarlingCSV(file)
            console.log(`[CLIENT] Parsed ${parsedData.length} transactions from CSV`)
            alert(`Parsed ${parsedData.length} transactions from CSV. Importing...`)
            const result = await importTransactions(parsedData)
            alert(result.message)
            fetchTransactions() // Refresh list
        } catch (error) {
            console.error("Import failed:", error)
            alert("Import failed. Check console for details.")
        } finally {
            setIsImporting(false)
            e.target.value = ""
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this transaction?")) return;
        try {
            await deleteTransactions([id]);
            setSelectedIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            fetchTransactions();
        } catch (error) {
            alert("Failed to delete transaction.");
        }
    }

    const handleBulkDelete = async () => {
        const count = selectedIds.size;
        if (!confirm(`Are you sure you want to delete ${count} selected transactions?`)) return;
        try {
            await deleteTransactions(Array.from(selectedIds));
            setSelectedIds(new Set());
            fetchTransactions();
        } catch (error) {
            alert("Failed to delete transactions.");
        }
    }

    const handleBulkUncategorize = async () => {
        const count = selectedIds.size;
        if (!confirm(`Are you sure you want to reset categories for ${count} transactions?`)) return;
        try {
            await uncategorizeTransactions(Array.from(selectedIds));
            setSelectedIds(new Set());
            fetchTransactions();
            fetchCategories();
        } catch (error) {
            alert("Failed to uncategorize transactions.");
        }
    }

    // Opens the bulk reconcile modal
    const handleBulkReconcile = () => {
        setBulkCategoryId("")
        setIsBulkReconcileModalOpen(true)
    }

    // Actually performs the bulk reconciliation
    const confirmBulkReconcile = async () => {
        try {
            await bulkReconcileTransactions(Array.from(selectedIds), bulkCategoryId || undefined)
            setSelectedIds(new Set())
            setIsBulkReconcileModalOpen(false)
            setBulkCategoryId("")
            fetchTransactions()
        } catch (error) {
            alert("Failed to reconcile transactions.")
        }
    }

    const toggleSelectAll = () => {
        if (selectedIds.size === items.length && items.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(items.map(t => t.id)));
        }
    }

    const toggleSelectRow = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    const handleClearLedger = async () => {
        if (!confirm("⚠️ CLEAR LEDGER: This will delete ALL transactions and pending matches, but your Category structure will be preserved. Proceed?")) return;
        try {
            await clearLedgerData();
            fetchTransactions();
            fetchSummaryStats();
            alert("Ledger cleared. Categories preserved.");
        } catch (error) {
            alert("Failed to clear ledger.");
        }
    }

    const handleClearSetup = async () => {
        if (!confirm("⚠️ CLEAR SETUP: This will delete ALL Categories and Vendors. Transactions will remain but will become 'Uncategorized'. Proceed?")) return;
        try {
            await clearConfigurationData();
            fetchTransactions();
            fetchCategories();
            alert("Categories and Vendors cleared.");
        } catch (error) {
            alert("Failed to clear setup.");
        }
    }

    const handleClearAll = async () => {
        if (!confirm("⚠️ FACTORY RESET: This will permanently delete EVERYTHING (transactions, categories, invoices, debts, etc.). This cannot be undone. Proceed?")) return;
        try {
            await clearAllFinancialData();
            fetchTransactions();
            fetchCategories();
            fetchSummaryStats();
            alert("System wiped successfully. You now have a fresh start.");
        } catch (error) {
            alert("Failed to clear data.");
        }
    }

    // Add manual transaction
    const handleAddTransaction = async () => {
        if (!newTxDescription.trim() || !newTxAmount || !newTxDate) {
            alert('Please fill in required fields: Date, Description, and Amount')
            return
        }

        setIsAddingTx(true)
        try {
            const amount = parseFloat(newTxAmount)
            const finalAmount = newTxType === 'expense' ? -Math.abs(amount) : Math.abs(amount)

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            const { error } = await supabase.from('transactions').insert({
                user_id: user.id,
                transaction_date: newTxDate,
                description: newTxDescription.trim(),
                raw_party: newTxDescription.trim(),
                amount: finalAmount,
                category_id: newTxCategoryId || null,
                vendor_id: newTxPayeeType === 'vendor' ? (newTxVendorId || null) : null,
                staff_id: newTxPayeeType === 'staff' ? (newTxStaffId || null) : null,
                notes: newTxNotes.trim() || null,
                confirmed: !!newTxCategoryId, // Mark as reconciled if category is set
            })

            if (error) throw error

            // Reset form
            setNewTxDate(new Date().toISOString().split('T')[0])
            setNewTxDescription('')
            setNewTxAmount('')
            setNewTxType('expense')
            setNewTxPayeeType('vendor')
            setNewTxCategoryId('')
            setNewTxVendorId('')
            setNewTxStaffId('')
            setNewTxNotes('')
            setIsAddTxModalOpen(false)

            // Refresh data
            fetchTransactions()
            fetchSummaryStats()
            fetchReconciliationCounts()

            alert('Transaction added successfully!')
        } catch (error: any) {
            console.error('Add transaction error:', error)
            alert(`Failed to add transaction: ${error?.message || JSON.stringify(error)}`)
        } finally {
            setIsAddingTx(false)
        }
    }

    return (
        <div className="flex flex-col gap-8">
            {/* Header Row */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
                <p className="text-muted-foreground">
                    Manage and categorize your academy's financial history.
                </p>
            </div>

            {/* Actions Row */}
            <div className="flex items-center justify-end gap-3">
                {/* Hidden Input for Import - kept outside/nearby */}
                <input
                    id="csv-upload"
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={isImporting}
                />

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button disabled={isImporting || isSyncingBank}>
                            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Actions <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />

                        <DropdownMenuItem onClick={() => setIsAddTxModalOpen(true)} className="cursor-pointer">
                            <Plus className="mr-2 h-4 w-4" /> Add Transaction
                        </DropdownMenuItem>

                        <DropdownMenuItem onClick={() => setSyncModalOpen(true)} disabled={isSyncingBank} className="cursor-pointer">
                            {isSyncingBank ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Banknote className="mr-2 h-4 w-4" />}
                            Sync Bank
                        </DropdownMenuItem>

                        <DropdownMenuItem asChild>
                            <label htmlFor="csv-upload" className="cursor-pointer w-full flex items-center">
                                <Upload className="mr-2 h-4 w-4" /> Import Starling CSV
                            </label>
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-destructive">Danger Zone</DropdownMenuLabel>
                        <DropdownMenuSeparator />

                        <DropdownMenuItem onClick={handleClearLedger} className="text-orange-600 focus:text-orange-600 cursor-pointer">
                            <Database className="mr-2 h-4 w-4" /> Clear Ledger Only
                        </DropdownMenuItem>

                        <DropdownMenuItem onClick={handleClearSetup} className="text-orange-600 focus:text-orange-600 cursor-pointer">
                            <Settings2 className="mr-2 h-4 w-4" /> Clear Setup Only
                        </DropdownMenuItem>

                        <DropdownMenuItem onClick={handleClearAll} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer font-semibold">
                            <Trash2 className="mr-2 h-4 w-4" /> Factory Reset
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Summary Stats Bar */}
            <div className="grid grid-cols-4 gap-4">
                <StatCard
                    title="Total Income"
                    value={summaryStats.income.toFixed(2)}
                    valuePrefix="+£"
                    status="success"
                />
                <StatCard
                    title="Total Expenses"
                    value={summaryStats.expense.toFixed(2)}
                    valuePrefix="-£"
                    status="danger"
                />
                <StatCard
                    title="Net Position"
                    value={Math.abs(summaryStats.net).toFixed(2)}
                    valuePrefix={summaryStats.net >= 0 ? "+£" : "-£"}
                    status={summaryStats.net >= 0 ? "info" : "warning"}
                />
                <StatCard
                    title="Bank Balance"
                    value={(lastBankBalance !== null ? lastBankBalance : (openingBalance + summaryStats.net)).toFixed(2)}
                    valuePrefix="£"
                    status="info"
                    subtext={lastBankBalance !== null ? "(from Starling)" : "(click to edit)"}
                    onClick={async () => {
                        const newBalance = prompt("Enter your opening bank balance (before any imported transactions):", openingBalance.toString())
                        if (newBalance !== null) {
                            const parsed = parseFloat(newBalance)
                            if (!isNaN(parsed)) {
                                await setOpeningBalance(parsed)
                                setOpeningBalanceState(parsed)
                            }
                        }
                    }}
                />
            </div>

            <Card className="shadow-sm border-slate-200 dark:border-zinc-800">
                <CardHeader className="p-6">
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="relative w-full md:w-96">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by vendor or description..."
                                    className="pl-10 h-10 font-medium"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                {selectedIds.size > 0 && (
                                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-9 gap-2 font-bold text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950/30"
                                            onClick={handleBulkReconcile}
                                        >
                                            <CheckCircle2 className="h-3.5 w-3.5" /> Reconcile ({selectedIds.size})
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-9 gap-2 font-bold text-orange-600 border-orange-200 hover:bg-orange-50"
                                            onClick={handleBulkUncategorize}
                                        >
                                            <RefreshCcw className="h-3.5 w-3.5" /> Uncategorize ({selectedIds.size})
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            className="h-9 gap-2 font-bold bg-rose-600 hover:bg-rose-700 shake-animation"
                                            onClick={handleBulkDelete}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" /> Delete ({selectedIds.size})
                                        </Button>
                                    </div>
                                )}
                                <Button variant="outline" size="sm" className="h-9 gap-2">
                                    <Filter className="h-3.5 w-3.5" /> Filter
                                </Button>
                            </div>
                        </div>

                        {/* Advanced Filters */}
                        <div className="flex flex-wrap gap-2 items-center bg-slate-50/50 dark:bg-zinc-900/30 p-2 rounded-lg border border-slate-100 dark:border-zinc-800/50">
                            <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground px-2">Quick Filters:</span>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value as any)}
                                className="h-8 rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 text-[11px] font-bold outline-none ring-primary/20 focus:ring-2"
                            >
                                <option value="all">Status: All</option>
                                <option value="reconciled">Status: Reconciled</option>
                                <option value="pending">Status: Pending</option>
                            </select>

                            <select
                                value={filterMonth}
                                onChange={(e) => setFilterMonth(e.target.value)}
                                className="h-8 rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 text-[11px] font-bold outline-none ring-primary/20 focus:ring-2"
                            >
                                <option value="all">Month: All</option>
                                {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
                                    <option key={m} value={(i + 1).toString()}>{m}</option>
                                ))}
                            </select>

                            <select
                                value={filterYear}
                                onChange={(e) => setFilterYear(e.target.value)}
                                className="h-8 rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 text-[11px] font-bold outline-none ring-primary/20 focus:ring-2"
                            >
                                {/* Dynamic years: current year down to 2024 */}
                                {Array.from({ length: new Date().getFullYear() - 2023 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                    <option key={year} value={year.toString()}>Year: {year}</option>
                                ))}
                                <option value="all">Year: Any</option>
                            </select>

                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-[10px] font-bold h-7 px-2 text-muted-foreground hover:text-destructive"
                                onClick={() => {
                                    setFilterStatus('all')
                                    setFilterMonth((new Date().getMonth() + 1).toString())
                                    setFilterYear(new Date().getFullYear().toString())
                                    setSearchQuery("")
                                }}
                            >
                                Reset Filters
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                {/* Transaction Counts Summary */}
                <div className="px-6 py-3 bg-slate-50 dark:bg-zinc-900/50 border-t border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm">
                        <span className="font-bold">
                            {totalCount.toLocaleString()} <span className="text-muted-foreground font-medium">transactions</span>
                        </span>
                        <span className="text-muted-foreground">•</span>
                        <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4 text-success" />
                            <span className="font-bold text-success">{reconciledCount.toLocaleString()}</span>
                            <span className="text-muted-foreground">reconciled</span>
                        </span>
                        <span className="text-muted-foreground">•</span>
                        <span className="flex items-center gap-1.5">
                            <AlertCircle className="h-4 w-4 text-warning" />
                            <span className="font-bold text-warning">{pendingCount.toLocaleString()}</span>
                            <span className="text-muted-foreground">pending</span>
                        </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {Math.round((reconciledCount / (reconciledCount + pendingCount || 1)) * 100)}% complete
                    </div>
                </div>

                <CardContent className="p-0">
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50/50 dark:bg-zinc-950/50 border-b border-slate-200 dark:border-zinc-800">
                                    <TableHead className="w-[40px] px-6">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-slate-300 dark:border-zinc-700 accent-black dark:accent-white cursor-pointer"
                                            checked={selectedIds.size === items.length && items.length > 0}
                                            onChange={toggleSelectAll}
                                        />
                                    </TableHead>
                                    <TableHead
                                        className="w-[120px] font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors"
                                        onClick={() => {
                                            if (sortColumn === 'date') {
                                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                                            } else {
                                                setSortColumn('date')
                                                setSortDirection('desc')
                                            }
                                        }}
                                    >
                                        <div className="flex items-center gap-1">
                                            Date
                                            {sortColumn === 'date' ? (
                                                sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                            ) : (
                                                <ArrowUpDown className="h-3 w-3 opacity-30" />
                                            )}
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors"
                                        onClick={() => {
                                            if (sortColumn === 'party') {
                                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                                            } else {
                                                setSortColumn('party')
                                                setSortDirection('asc')
                                            }
                                        }}
                                    >
                                        <div className="flex items-center gap-1">
                                            Counter Party
                                            {sortColumn === 'party' ? (
                                                sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                            ) : (
                                                <ArrowUpDown className="h-3 w-3 opacity-30" />
                                            )}
                                        </div>
                                    </TableHead>
                                    <TableHead className="font-bold">Category</TableHead>
                                    <TableHead
                                        className="text-right font-bold w-[150px] cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors"
                                        onClick={() => {
                                            if (sortColumn === 'amount') {
                                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                                            } else {
                                                setSortColumn('amount')
                                                setSortDirection('desc')
                                            }
                                        }}
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            Amount
                                            {sortColumn === 'amount' ? (
                                                sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                            ) : (
                                                <ArrowUpDown className="h-3 w-3 opacity-30" />
                                            )}
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="text-right font-bold w-[120px] px-6 cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors"
                                        onClick={() => {
                                            if (sortColumn === 'status') {
                                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                                            } else {
                                                setSortColumn('status')
                                                setSortDirection('asc')
                                            }
                                        }}
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            Status
                                            {sortColumn === 'status' ? (
                                                sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                            ) : (
                                                <ArrowUpDown className="h-3 w-3 opacity-30" />
                                            )}
                                        </div>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                                            Fetching transactions...
                                        </TableCell>
                                    </TableRow>
                                ) : items.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                                            No transactions found. Upload a CSV to get started.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    items.map((t) => (
                                        <TableRow key={t.id} className={`hover:bg-slate-100 dark:hover:bg-zinc-800 border-b border-slate-100 dark:border-zinc-900 transition-colors ${selectedIds.has(t.id) ? 'bg-slate-100 dark:bg-zinc-700' : ''}`}>
                                            <TableCell className="px-6">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 rounded border-slate-300 dark:border-zinc-700 accent-black dark:accent-white cursor-pointer"
                                                    checked={selectedIds.has(t.id)}
                                                    onChange={() => toggleSelectRow(t.id)}
                                                />
                                            </TableCell>
                                            <TableCell className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">
                                                {new Date(t.transaction_date).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-sm">
                                                            {t.staff?.name
                                                                ? `${t.staff.name} (${t.staff.role})`
                                                                : t.vendors?.name || t.raw_party || "Unknown"}
                                                        </span>
                                                        {t.notes && <MessageSquare className="h-3 w-3 text-indigo-500" />}
                                                    </div>
                                                    <span className="text-[10px] text-muted-foreground truncate max-w-[200px] italic">
                                                        {t.description}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <CategorySelector
                                                    transactionId={t.id}
                                                    amount={t.amount}
                                                    currentCategoryId={t.category_id}
                                                    aiSuggestion={t.ai_suggested}
                                                    confirmed={t.confirmed}
                                                    categories={categories}
                                                    onUpdate={() => {
                                                        fetchTransactions()
                                                        fetchCategories()
                                                        fetchReconciliationCounts()
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell className="text-right px-4">
                                                <span className={`font-black tabular-nums text-sm ${t.amount < 0 ? 'text-destructive' : 'text-success'}`}>
                                                    {t.amount < 0 ? `-£${Math.abs(t.amount).toFixed(2)}` : `+£${t.amount.toFixed(2)}`}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right px-6">
                                                <div className="flex items-center justify-end gap-2">
                                                    {t.confirmed ? (
                                                        <div className="flex items-center gap-1" title={t.matched_rule_id ? "Auto-reconciled by rule" : "Manually reconciled"}>
                                                            <CheckCircle2 className="h-4 w-4 text-success" />
                                                            {t.matched_rule_id && (
                                                                <Settings2 className="h-3 w-3 text-indigo-500" />
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest flex items-center justify-end gap-1">
                                                            <AlertCircle className="h-3 w-3" /> Review
                                                        </span>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                                                        onClick={() => {
                                                            setReconcileTx(t)
                                                            setIsReconcileModalOpen(true)
                                                        }}
                                                        title="Advanced Reconcile"
                                                    >
                                                        <Filter className="h-4 w-4" />
                                                    </Button>
                                                    {/* Link to Invoice - only for outgoing transactions */}
                                                    {t.amount < 0 && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                                            onClick={() => {
                                                                setLinkingTx(t)
                                                                setLinkAmount(Math.abs(t.amount).toString())
                                                                setIsInvoiceLinkModalOpen(true)
                                                            }}
                                                            title="Link to Invoice"
                                                        >
                                                            <Receipt className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {/* Link to Bill / Show Linked Bill - only for outgoing transactions */}
                                                    {t.amount < 0 && (
                                                        t.payables ? (
                                                            // Show linked bill badge when linked
                                                            <button
                                                                onClick={() => {
                                                                    setLinkingPayableTx(t)
                                                                    setIsPayableLinkModalOpen(true)
                                                                }}
                                                                className="group flex items-center gap-1.5 px-2 py-1 rounded-full bg-cyan-500/10 text-cyan-600 hover:bg-cyan-500/20 transition-colors text-[10px] font-semibold"
                                                                title={`Linked to: ${t.payables.name} - £${Number(t.payables.amount).toFixed(2)}`}
                                                            >
                                                                <FileText className="h-3 w-3" />
                                                                <span className="max-w-[80px] truncate">{t.payables.name}</span>
                                                            </button>
                                                        ) : (
                                                            // Show link button when not linked
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-muted-foreground hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-950/30"
                                                                onClick={() => {
                                                                    setLinkingPayableTx(t)
                                                                    setIsPayableLinkModalOpen(true)
                                                                }}
                                                                title="Link to Payable"
                                                            >
                                                                <FileText className="h-4 w-4" />
                                                            </Button>
                                                        )
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                                        onClick={() => handleDelete(t.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
                        {isLoading ? (
                            <div className="py-12 text-center text-muted-foreground italic">
                                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                                Fetching transactions...
                            </div>
                        ) : items.length === 0 ? (
                            <div className="py-12 text-center text-muted-foreground italic">
                                No transactions found. Upload a CSV to get started.
                            </div>
                        ) : (
                            items.map((t) => (
                                <div key={t.id} className={`p-4 flex flex-col gap-3 transition-colors ${selectedIds.has(t.id) ? 'bg-zinc-50 dark:bg-zinc-900' : 'bg-white dark:bg-zinc-950'}`}>
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-start gap-3">
                                            <input
                                                type="checkbox"
                                                className="mt-1 h-4 w-4 rounded border-slate-300 dark:border-zinc-700 accent-black dark:accent-white cursor-pointer"
                                                checked={selectedIds.has(t.id)}
                                                onChange={() => toggleSelectRow(t.id)}
                                            />
                                            <div>
                                                <div className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">
                                                    {new Date(t.transaction_date).toLocaleDateString()}
                                                </div>
                                                <div className="font-semibold text-sm mt-0.5">
                                                    {t.staff?.name
                                                        ? `${t.staff.name}`
                                                        : t.vendors?.name || t.raw_party || "Unknown"}
                                                </div>
                                                <div className="text-xs text-muted-foreground italic truncate max-w-[180px]">
                                                    {t.description}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`font-black text-base ${t.amount < 0 ? 'text-destructive' : 'text-success'}`}>
                                                {t.amount < 0 ? `-£${Math.abs(t.amount).toFixed(2)}` : `+£${t.amount.toFixed(2)}`}
                                            </div>
                                            {t.confirmed && (
                                                <div className="flex items-center justify-end gap-1 mt-1">
                                                    <CheckCircle2 className="h-3 w-3 text-success" />
                                                    {t.matched_rule_id && <Settings2 className="h-3 w-3 text-indigo-500" />}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <div className="flex-1">
                                            <CategorySelector
                                                transactionId={t.id}
                                                amount={t.amount}
                                                currentCategoryId={t.category_id}
                                                aiSuggestion={t.ai_suggested}
                                                confirmed={t.confirmed}
                                                categories={categories}
                                                onUpdate={() => {
                                                    fetchTransactions()
                                                    fetchCategories()
                                                    fetchReconciliationCounts()
                                                }}
                                            />
                                        </div>
                                        <div className="flex items-center">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-indigo-600"
                                                onClick={() => {
                                                    setReconcileTx(t)
                                                    setIsReconcileModalOpen(true)
                                                }}
                                            >
                                                <Filter className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                onClick={() => handleDelete(t.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>

                {/* Pagination Controls */}
                <div className="flex items-center justify-between px-6 py-4 border-t">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Showing {((currentPage - 1) * PAGE_SIZE) + 1} - {Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount}</span>
                        <span>•</span>
                        <span className="text-success font-medium">{reconciledCount} reconciled</span>
                        <span>•</span>
                        <span className="text-warning font-medium">{pendingCount} pending</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                        >
                            Previous
                        </Button>
                        <span className="text-sm font-medium px-3">
                            Page {currentPage} of {Math.ceil(totalCount / PAGE_SIZE)}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => p + 1)}
                            disabled={currentPage >= Math.ceil(totalCount / PAGE_SIZE)}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </Card>


            <ReconciliationModal
                transaction={reconcileTx}
                categories={categories}
                isOpen={isReconcileModalOpen}
                onOpenChange={setIsReconcileModalOpen}
                onUpdate={() => {
                    fetchTransactions()
                    fetchCategories()
                    fetchReconciliationCounts()
                }}
            />

            {/* Bulk Reconcile Modal */}
            {isBulkReconcileModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => {
                    setBulkCategoryDropdownOpen(false)
                }}>
                    <div className="bg-white dark:bg-zinc-950 rounded-xl shadow-2xl p-6 w-full max-w-md border border-slate-200 dark:border-zinc-800" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-black mb-4">Bulk Reconcile {selectedIds.size} Transactions</h2>

                        <div className="mb-4">
                            <label className="text-sm font-bold text-muted-foreground mb-2 block">Category (optional)</label>
                            <p className="text-xs text-muted-foreground mb-2">Apply the same category to all selected transactions, or leave blank to keep existing categories.</p>

                            {/* Searchable Category Dropdown */}
                            <div className="relative">
                                <input
                                    type="text"
                                    value={bulkCategoryDropdownOpen ? bulkCategorySearch : (categories.find(c => c.id === bulkCategoryId)?.name || '')}
                                    onChange={(e) => {
                                        setBulkCategorySearch(e.target.value)
                                        if (!bulkCategoryDropdownOpen) setBulkCategoryDropdownOpen(true)
                                    }}
                                    onFocus={() => setBulkCategoryDropdownOpen(true)}
                                    placeholder="Search categories or keep existing..."
                                    className="w-full h-10 rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 text-sm outline-none ring-primary/20 focus:ring-2"
                                />

                                {bulkCategoryDropdownOpen && (
                                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                                        {/* Clear / Keep existing option */}
                                        <div
                                            onClick={() => {
                                                setBulkCategoryId("")
                                                setBulkCategorySearch("")
                                                setBulkCategoryDropdownOpen(false)
                                            }}
                                            className={`px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-900 ${!bulkCategoryId ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground italic'}`}
                                        >
                                            -- Keep existing categories --
                                        </div>

                                        {/* Filtered category list */}
                                        {categories
                                            .filter(c => !c.parent_id)
                                            .filter(parent => {
                                                const searchLower = bulkCategorySearch.toLowerCase()
                                                if (!searchLower) return true
                                                const childMatches = categories.some(
                                                    child => child.parent_id === parent.id && child.name.toLowerCase().includes(searchLower)
                                                )
                                                return parent.name.toLowerCase().includes(searchLower) || childMatches
                                            })
                                            .map(parent => {
                                                const searchLower = bulkCategorySearch.toLowerCase()
                                                const children = categories.filter(c =>
                                                    c.parent_id === parent.id &&
                                                    (!searchLower || c.name.toLowerCase().includes(searchLower) || parent.name.toLowerCase().includes(searchLower))
                                                )

                                                return (
                                                    <div key={parent.id}>
                                                        <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-slate-50 dark:bg-zinc-900/50 sticky top-0">
                                                            {parent.name}
                                                        </div>
                                                        <div
                                                            onClick={() => {
                                                                setBulkCategoryId(parent.id)
                                                                setBulkCategorySearch("")
                                                                setBulkCategoryDropdownOpen(false)
                                                            }}
                                                            className={`px-3 py-2 pl-5 text-sm cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950/30 ${bulkCategoryId === parent.id ? 'bg-emerald-100 dark:bg-emerald-900/30 font-bold' : ''}`}
                                                        >
                                                            {parent.name} (General)
                                                        </div>
                                                        {children.map(child => (
                                                            <div
                                                                key={child.id}
                                                                onClick={() => {
                                                                    setBulkCategoryId(child.id)
                                                                    setBulkCategorySearch("")
                                                                    setBulkCategoryDropdownOpen(false)
                                                                }}
                                                                className={`px-3 py-2 pl-8 text-sm cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950/30 ${bulkCategoryId === child.id ? 'bg-emerald-100 dark:bg-emerald-900/30 font-bold' : ''}`}
                                                            >
                                                                {child.name}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )
                                            })
                                        }

                                        {categories.filter(c => !c.parent_id).filter(parent => {
                                            const searchLower = bulkCategorySearch.toLowerCase()
                                            if (!searchLower) return true
                                            const childMatches = categories.some(child => child.parent_id === parent.id && child.name.toLowerCase().includes(searchLower))
                                            return parent.name.toLowerCase().includes(searchLower) || childMatches
                                        }).length === 0 && (
                                                <div className="px-3 py-2 text-sm text-muted-foreground italic">No categories found</div>
                                            )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setIsBulkReconcileModalOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={confirmBulkReconcile}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Reconcile {selectedIds.size} Transactions
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Invoice Link Modal */}
            {isInvoiceLinkModalOpen && linkingTx && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
                    <div className="bg-white dark:bg-zinc-950 rounded-xl shadow-2xl p-6 w-full max-w-md border border-slate-200 dark:border-zinc-800">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-black">Link to Invoice</h2>
                            <button onClick={() => setIsInvoiceLinkModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="mb-4 p-3 bg-zinc-100 dark:bg-zinc-900 rounded-lg">
                            <p className="text-sm font-medium">{linkingTx.raw_party || linkingTx.description}</p>
                            <p className="text-lg font-bold text-destructive">-£{Math.abs(linkingTx.amount).toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">{new Date(linkingTx.transaction_date).toLocaleDateString()}</p>
                        </div>

                        <div className="mb-4">
                            <label className="text-sm font-bold text-muted-foreground mb-2 block">Select Invoice</label>
                            {invoices.length === 0 ? (
                                <p className="text-sm text-muted-foreground italic">No pending invoices available</p>
                            ) : (
                                <select
                                    value={selectedInvoiceId}
                                    onChange={(e) => setSelectedInvoiceId(e.target.value)}
                                    className="w-full h-10 px-3 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm"
                                >
                                    <option value="">Select an invoice...</option>
                                    {invoices.map(inv => (
                                        <option key={inv.id} value={inv.id}>
                                            {inv.staff?.name || 'Unknown'} - £{inv.amount.toFixed(2)} ({inv.invoice_number})
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <div className="mb-4">
                            <label className="text-sm font-bold text-muted-foreground mb-2 block">Amount to Link</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">£</span>
                                <input
                                    type="number"
                                    value={linkAmount}
                                    onChange={(e) => setLinkAmount(e.target.value)}
                                    className="w-full h-10 pl-7 pr-3 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm"
                                    placeholder="0.00"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">You can link a partial amount for split payments</p>
                        </div>

                        <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setIsInvoiceLinkModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleLinkToInvoice}
                                disabled={!selectedInvoiceId || !linkAmount}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Receipt className="h-4 w-4 mr-2" />
                                Link Payment
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payable Link Modal */}
            {isPayableLinkModalOpen && linkingPayableTx && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
                    <div className="bg-white dark:bg-zinc-950 rounded-xl shadow-2xl p-6 w-full max-w-md border border-slate-200 dark:border-zinc-800">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-black">Link to Payable</h2>
                            <button onClick={() => setIsPayableLinkModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="mb-4 p-3 bg-zinc-100 dark:bg-zinc-900 rounded-lg">
                            <p className="text-sm font-medium">{linkingPayableTx.raw_party || linkingPayableTx.description}</p>
                            <p className="text-lg font-bold text-destructive">-£{Math.abs(linkingPayableTx.amount).toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">{new Date(linkingPayableTx.transaction_date).toLocaleDateString()}</p>
                        </div>

                        {/* Show Currently Linked Payable */}
                        {linkingPayableTx.payables && (
                            <div className="mb-4 p-3 bg-cyan-50 dark:bg-cyan-950/30 rounded-lg border border-cyan-200 dark:border-cyan-800">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wide">Currently Linked To</p>
                                        <p className="text-sm font-bold mt-1">{linkingPayableTx.payables.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            £{Number(linkingPayableTx.payables.amount).toFixed(2)} • {new Date(linkingPayableTx.payables.next_due).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/30"
                                        onClick={async () => {
                                            try {
                                                await unlinkTransactionFromPayable(linkingPayableTx.id)
                                                setIsPayableLinkModalOpen(false)
                                                setLinkingPayableTx(null)
                                                fetchTransactions()
                                                fetchPayables()
                                                alert('Transaction unlinked successfully!')
                                            } catch (e) {
                                                alert('Failed to unlink: ' + e)
                                            }
                                        }}
                                    >
                                        Unlink
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div className="mb-4">
                            <label className="text-sm font-bold text-muted-foreground mb-2 block">Search & Select Payable</label>
                            <input
                                type="text"
                                placeholder="Search by name, vendor, or amount..."
                                value={payableSearch}
                                onChange={(e) => setPayableSearch(e.target.value)}
                                className="w-full h-10 px-3 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm mb-2"
                            />
                            {payables.length === 0 ? (
                                <p className="text-sm text-muted-foreground italic">No unpaid payables available</p>
                            ) : (
                                <div className="max-h-48 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-lg">
                                    {payables
                                        .filter((p: any) => {
                                            if (!payableSearch) return true
                                            const search = payableSearch.toLowerCase()
                                            const name = (p.vendor_name || p.staff_name || p.name || '').toLowerCase()
                                            const amount = Number(p.amount).toFixed(2)
                                            return name.includes(search) || amount.includes(search)
                                        })
                                        .map((p: any) => (
                                            <div
                                                key={p.id}
                                                onClick={() => setSelectedPayableId(p.id)}
                                                className={`p-2 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 ${selectedPayableId === p.id ? 'bg-cyan-50 dark:bg-cyan-950/30 border-l-2 border-l-cyan-500' : ''}`}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm font-medium">{p.vendor_name || p.staff_name || p.name}</span>
                                                    <span className="text-sm font-bold text-destructive">£{Number(p.amount).toFixed(2)}</span>
                                                </div>
                                                {p.next_due && (
                                                    <span className="text-xs text-muted-foreground">Due: {new Date(p.next_due).toLocaleDateString()}</span>
                                                )}
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>

                        <p className="text-xs text-muted-foreground mb-4 bg-cyan-50 dark:bg-cyan-950/30 p-2 rounded">
                            Linking will mark the payable as paid and advance the next due date for recurring items.
                        </p>

                        <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setIsPayableLinkModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleLinkToPayable}
                                disabled={!selectedPayableId}
                                className="bg-cyan-600 hover:bg-cyan-700"
                            >
                                <FileText className="h-4 w-4 mr-2" />
                                Link to Payable
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Transaction Modal */}
            {isAddTxModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
                    <div className="bg-white dark:bg-zinc-950 rounded-xl shadow-2xl p-6 w-full max-w-md border border-slate-200 dark:border-zinc-800">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-black">Add Transaction</h2>
                            <button onClick={() => setIsAddTxModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Type Toggle */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setNewTxType('income')}
                                    className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors ${newTxType === 'income'
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                                        }`}
                                >
                                    <ArrowUpRight className="h-4 w-4 inline mr-1" /> Income
                                </button>
                                <button
                                    onClick={() => setNewTxType('expense')}
                                    className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors ${newTxType === 'expense'
                                        ? 'bg-rose-600 text-white'
                                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                                        }`}
                                >
                                    <ArrowDownRight className="h-4 w-4 inline mr-1" /> Expense
                                </button>
                            </div>

                            {/* Date */}
                            <div>
                                <label className="text-sm font-bold text-muted-foreground mb-1 block">Date *</label>
                                <input
                                    type="date"
                                    value={newTxDate}
                                    onChange={(e) => setNewTxDate(e.target.value)}
                                    className="w-full h-10 px-3 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="text-sm font-bold text-muted-foreground mb-1 block">Description *</label>
                                <input
                                    type="text"
                                    value={newTxDescription}
                                    onChange={(e) => setNewTxDescription(e.target.value)}
                                    placeholder="e.g., Membership Payment, Equipment Purchase"
                                    className="w-full h-10 px-3 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm"
                                />
                            </div>

                            {/* Amount */}
                            <div>
                                <label className="text-sm font-bold text-muted-foreground mb-1 block">Amount *</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">£</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={newTxAmount}
                                        onChange={(e) => setNewTxAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full h-10 pl-7 pr-3 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm"
                                    />
                                </div>
                            </div>

                            {/* Payee Type Toggle */}
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Payee Type</label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => { setNewTxPayeeType('vendor'); setNewTxStaffId(''); }}
                                        className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 ${newTxPayeeType === 'vendor'
                                            ? 'bg-amber-500 text-black'
                                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                            }`}
                                    >
                                        <Receipt className="h-4 w-4" /> Vendor
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setNewTxPayeeType('staff'); setNewTxVendorId(''); }}
                                        className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 ${newTxPayeeType === 'staff'
                                            ? 'bg-amber-500 text-black'
                                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                            }`}
                                    >
                                        <ArrowUpRight className="h-4 w-4" /> Staff
                                    </button>
                                </div>
                            </div>

                            {/* Vendor/Staff Dropdown */}
                            <div>
                                <label className="text-sm font-bold text-muted-foreground mb-1 block">
                                    {newTxPayeeType === 'vendor' ? 'Select Vendor' : 'Select Staff'}
                                </label>
                                {newTxPayeeType === 'vendor' ? (
                                    <select
                                        value={newTxVendorId}
                                        onChange={(e) => setNewTxVendorId(e.target.value)}
                                        className="w-full h-10 px-3 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm"
                                    >
                                        <option value="">Select a vendor...</option>
                                        {vendors.map(v => (
                                            <option key={v.id} value={v.id}>{v.name}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <select
                                        value={newTxStaffId}
                                        onChange={(e) => setNewTxStaffId(e.target.value)}
                                        className="w-full h-10 px-3 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm"
                                    >
                                        <option value="">Select a staff member...</option>
                                        {staff.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {/* Category */}
                            <div>
                                <label className="text-sm font-bold text-muted-foreground mb-1 block">Category (optional)</label>
                                <select
                                    value={newTxCategoryId}
                                    onChange={(e) => setNewTxCategoryId(e.target.value)}
                                    className="w-full h-10 px-3 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm"
                                >
                                    <option value="">No category</option>
                                    {categories.filter(c => !c.parent_id).map(parent => (
                                        <optgroup key={parent.id} label={parent.name}>
                                            <option value={parent.id}>{parent.name} (General)</option>
                                            {categories.filter(c => c.parent_id === parent.id).map(child => (
                                                <option key={child.id} value={child.id}>{child.name}</option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="text-sm font-bold text-muted-foreground mb-1 block">Notes (optional)</label>
                                <textarea
                                    value={newTxNotes}
                                    onChange={(e) => setNewTxNotes(e.target.value)}
                                    placeholder="Additional details..."
                                    rows={2}
                                    className="w-full px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <Button variant="outline" onClick={() => setIsAddTxModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleAddTransaction}
                                disabled={isAddingTx || !newTxDescription || !newTxAmount}
                                className={newTxType === 'income' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}
                            >
                                {isAddingTx ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                                Add {newTxType === 'income' ? 'Income' : 'Expense'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bank Sync Modal */}
            {syncModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md bg-zinc-950 rounded-2xl border border-zinc-800 shadow-2xl">
                        <div className="p-6 border-b border-zinc-900 flex justify-between items-center">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Banknote className="h-5 w-5 text-purple-400" />
                                Sync Bank Transactions
                            </h2>
                            <button onClick={() => setSyncModalOpen(false)} className="text-zinc-500 hover:text-white">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-zinc-400">
                                Select the date range to sync transactions from Starling Bank.
                            </p>
                            {lastSyncDate && (
                                <div className="p-2 rounded-lg bg-purple-900/20 border border-purple-800/50">
                                    <p className="text-xs text-purple-400">
                                        ✓ Last synced up to: <strong>{lastSyncDate}</strong> — Starting from there.
                                    </p>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">
                                        From Date {lastSyncDate && <span className="text-purple-400">(auto)</span>}
                                    </label>
                                    <input
                                        type="date"
                                        value={syncFromDate}
                                        onChange={e => setSyncFromDate(e.target.value)}
                                        className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">To Date</label>
                                    <input
                                        type="date"
                                        value={syncToDate}
                                        onChange={e => setSyncToDate(e.target.value)}
                                        className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm"
                                    />
                                </div>
                            </div>
                            <div className="p-3 rounded-lg bg-amber-900/20 border border-amber-800/50">
                                <p className="text-xs text-amber-400">
                                    <strong>Note:</strong> Duplicate transactions are automatically skipped based on Starling's unique IDs.
                                </p>
                            </div>
                        </div>
                        <div className="p-6 border-t border-zinc-900 flex gap-3">
                            <Button variant="outline" onClick={() => setSyncModalOpen(false)} className="flex-1">Cancel</Button>
                            <Button
                                onClick={async () => {
                                    setIsSyncingBank(true)
                                    try {
                                        const result = await syncStarlingTransactions(syncFromDate, syncToDate, true)
                                        if (result.success) {
                                            const preview = result.preview?.slice(0, 10).map(t =>
                                                `${t.date} | ${t.party.substring(0, 20).padEnd(20)} | £${Math.abs(t.amount).toFixed(2).padStart(8)} | ${t.type} | ${t.status}`
                                            ).join('\n') || 'No transactions'
                                            const more = (result.preview?.length || 0) > 10 ? `\n... and ${(result.preview?.length || 0) - 10} more` : ''
                                            alert(`TEST SUCCESSFUL! ✅\n\n${result.synced} transactions found:\n\n${preview}${more}\n\nClick "Sync Now" to import.`)
                                        } else {
                                            alert(`Test failed: ${result.errors.join(', ')}`)
                                        }
                                    } catch (e: any) {
                                        alert(`Test error: ${e.message}`)
                                    }
                                    setIsSyncingBank(false)
                                }}
                                disabled={isSyncingBank}
                                variant="outline"
                                className="flex-1 border-amber-800 text-amber-400 hover:bg-amber-900/30"
                            >
                                🧪 Test Connection
                            </Button>
                            <Button
                                onClick={async () => {
                                    setSyncModalOpen(false)
                                    setIsSyncingBank(true)
                                    try {
                                        const result = await syncStarlingTransactions(syncFromDate, syncToDate, false)
                                        if (result.success) {
                                            if (result.balance) {
                                                setLastBankBalance(result.balance.cleared)
                                            }
                                            // Save last sync date for smart syncing next time
                                            setLastSyncDate(syncToDate)
                                            localStorage.setItem('lastSyncDate', syncToDate)
                                            fetchTransactions()
                                            fetchSummaryStats()
                                            fetchReconciliationCounts()
                                            const errorInfo = result.errors.length > 0 ? `\n\nErrors: ${result.errors.slice(0, 5).join('\n')}` : ''
                                            alert(`Bank sync complete! ${result.synced} new transactions synced, ${result.skipped} duplicates skipped.${result.balance ? ` Bank balance: £${result.balance.cleared.toFixed(2)}` : ''}${errorInfo}`)
                                        } else {
                                            alert(`Bank sync failed: ${result.errors.join(', ')}`)
                                        }
                                    } catch (e: any) {
                                        alert(`Bank sync error: ${e.message}`)
                                    }
                                    setIsSyncingBank(false)
                                }}
                                disabled={isSyncingBank}
                                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                            >
                                {isSyncingBank ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Banknote className="h-4 w-4 mr-2" />}
                                Sync Now
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
