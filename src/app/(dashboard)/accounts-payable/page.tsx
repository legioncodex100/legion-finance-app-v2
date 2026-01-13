"use client"

import * as React from "react"
import { Plus, Loader2, Calendar, AlertCircle, CheckCircle2, Pencil, Trash2, X, Zap, Link2, Upload, Eye, Users, Building2, Bot, DollarSign, Banknote, ChevronLeft, ChevronRight, LayoutList, CalendarDays, CalendarPlus, FileText, Pause, Play, Square } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import {
    getPayables,
    getPayablesSummary,
    createPayable,
    updatePayable,
    deletePayable,
    markPayableAsPaid,
    markPayableAsUnpaid,
    linkPayableToTransaction,
    linkPayableRetroactive,
    generateStaffSalaryBills,
    generateUpcomingBills,
    getTemplates,
    createTemplate,
    toggleTemplateActive,
    endTemplate,
    type Payable,
    type PayeeType,
    type BillStatus,
    type Frequency
} from "@/lib/actions/payables"
import { createClient } from "@/lib/supabase/client"

export default function AccountsPayablePage() {
    const [payables, setPayables] = React.useState<Payable[]>([])
    const [vendors, setVendors] = React.useState<{ id: string, name: string }[]>([])
    const [staffList, setStaffList] = React.useState<{ id: string, name: string }[]>([])
    const [categories, setCategories] = React.useState<{ id: string, name: string }[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const [isModalOpen, setIsModalOpen] = React.useState(false)
    const [editingPayable, setEditingPayable] = React.useState<Payable | null>(null)
    const [isSaving, setIsSaving] = React.useState(false)
    const [isGeneratingSalaries, setIsGeneratingSalaries] = React.useState(false)
    const [filterStatus, setFilterStatus] = React.useState<'all' | 'overdue' | 'due-soon' | 'scheduled' | 'paid'>('all')
    const [filterPayee, setFilterPayee] = React.useState<'all' | 'vendor' | 'staff' | 'system'>('all')
    const [filterMonth, setFilterMonth] = React.useState<number | 'all'>('all')
    const [filterYear, setFilterYear] = React.useState<number>(new Date().getFullYear())
    const [viewMode, setViewMode] = React.useState<'table' | 'calendar'>('table')
    const [calendarMonth, setCalendarMonth] = React.useState(new Date())
    const [activeTab, setActiveTab] = React.useState<'bills' | 'templates'>('bills')
    const [templates, setTemplates] = React.useState<Payable[]>([])
    const [templateModalOpen, setTemplateModalOpen] = React.useState(false)
    const [editingTemplate, setEditingTemplate] = React.useState<Payable | null>(null)
    const [generateBillsModalOpen, setGenerateBillsModalOpen] = React.useState(false)
    const [generateMonth, setGenerateMonth] = React.useState(new Date().getMonth())
    const [generateYear, setGenerateYear] = React.useState(new Date().getFullYear())
    const [isGeneratingBills, setIsGeneratingBills] = React.useState(false)

    // Summary
    const [summary, setSummary] = React.useState({ totalPayables: 0, dueWithin7Days: 0, merchantFees: 0, staffLiability: 0 })

    // Form state
    const [name, setName] = React.useState("")
    const [payeeType, setPayeeType] = React.useState<PayeeType>('vendor')
    const [vendorId, setVendorId] = React.useState("")
    const [staffId, setStaffId] = React.useState("")
    const [amount, setAmount] = React.useState("")
    const [amountTax, setAmountTax] = React.useState("")
    const [frequency, setFrequency] = React.useState<Frequency>('one-time')
    const [nextDue, setNextDue] = React.useState("")
    const [categoryId, setCategoryId] = React.useState("")
    const [notes, setNotes] = React.useState("")
    const [invoiceNumber, setInvoiceNumber] = React.useState("")
    const [autoPay, setAutoPay] = React.useState(false)
    const [isVariableAmount, setIsVariableAmount] = React.useState(false)
    const [useSmartName, setUseSmartName] = React.useState(true)
    const [dayOfMonth, setDayOfMonth] = React.useState(15) // Default to 15th

    // Link modal
    const [linkModalOpen, setLinkModalOpen] = React.useState(false)
    const [linkingPayable, setLinkingPayable] = React.useState<Payable | null>(null)
    const [transactions, setTransactions] = React.useState<any[]>([])
    const [loadingTxns, setLoadingTxns] = React.useState(false)
    const [txnSearch, setTxnSearch] = React.useState('')
    const [isRetroactiveLink, setIsRetroactiveLink] = React.useState(false)

    // Detail modal
    const [detailModalOpen, setDetailModalOpen] = React.useState(false)
    const [selectedPayable, setSelectedPayable] = React.useState<Payable | null>(null)
    const [linkedTransaction, setLinkedTransaction] = React.useState<any | null>(null)
    const [loadingDetail, setLoadingDetail] = React.useState(false)

    const supabase = createClient()

    const fetchData = React.useCallback(async () => {
        setIsLoading(true)
        try {
            const [payablesData, summaryData, templatesData] = await Promise.all([
                getPayables(),
                getPayablesSummary(),
                getTemplates()
            ])
            setPayables(payablesData)
            setSummary(summaryData)
            setTemplates(templatesData)

            // Fetch vendors, staff, categories
            const { data: v } = await supabase.from('vendors').select('id, name').order('name')
            const { data: s } = await supabase.from('staff').select('id, name').eq('is_active', true).order('name')
            const { data: c } = await supabase.from('categories').select('id, name').eq('type', 'expense').order('name')
            if (v) setVendors(v)
            if (s) setStaffList(s)
            if (c) setCategories(c)
        } catch (e) {
            console.error('Error loading data:', e)
        }
        setIsLoading(false)
    }, [supabase])

    React.useEffect(() => { fetchData() }, [fetchData])

    const resetForm = () => {
        setName(""); setPayeeType('vendor'); setVendorId(""); setStaffId("")
        setAmount(""); setAmountTax(""); setFrequency('one-time'); setNextDue("")
        setCategoryId(""); setNotes(""); setInvoiceNumber(""); setAutoPay(false)
        setIsVariableAmount(false)
        setUseSmartName(true)
        setDayOfMonth(15)
        setEditingPayable(null)
    }

    const handleOpenModal = (payable?: Payable) => {
        if (payable) {
            setEditingPayable(payable)
            setName(payable.name)
            setPayeeType(payable.payee_type)
            setVendorId(payable.vendor_id || "")
            setStaffId(payable.staff_id || "")
            setAmount(payable.amount.toString())
            setAmountTax(payable.amount_tax?.toString() || "")
            setFrequency(payable.frequency)
            setNextDue(payable.next_due)
            setCategoryId(payable.category_id || "")
            setNotes(payable.notes || "")
            setInvoiceNumber(payable.invoice_number || "")
            setAutoPay(payable.auto_pay)
            setIsVariableAmount(payable.is_variable_amount || false)
        } else {
            resetForm()
        }
        setIsModalOpen(true)
    }

    const handleSave = async () => {
        if (!name || !amount || !nextDue) return
        setIsSaving(true)
        try {
            const data = {
                name,
                payee_type: payeeType,
                vendor_id: payeeType === 'vendor' ? vendorId || undefined : undefined,
                staff_id: payeeType === 'staff' ? staffId || undefined : undefined,
                amount: parseFloat(amount),
                amount_tax: amountTax ? parseFloat(amountTax) : 0,
                frequency,
                next_due: nextDue,
                is_recurring: frequency !== 'one-time',
                category_id: categoryId || undefined,
                notes: notes || undefined,
                invoice_number: invoiceNumber || undefined,
                auto_pay: autoPay,
                is_variable_amount: isVariableAmount
            }

            if (editingPayable) {
                await updatePayable(editingPayable.id, data)
            } else {
                await createPayable(data)
            }
            setIsModalOpen(false)
            resetForm()
            fetchData()
        } catch (e) {
            console.error('Save error:', e)
        }
        setIsSaving(false)
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this payable?")) return
        await deletePayable(id)
        fetchData()
    }

    const handleMarkPaid = async (payable: Payable) => {
        await markPayableAsPaid(payable.id)
        fetchData()
    }

    const handleMarkUnpaid = async (payable: Payable) => {
        if (!confirm("Mark this payable as unpaid? This will also unlink any connected transaction.")) return
        await markPayableAsUnpaid(payable.id)
        fetchData()
    }

    const openLinkModal = async (payable: Payable) => {
        setLinkingPayable(payable)
        setLinkModalOpen(true)
        setLoadingTxns(true)
        setTxnSearch('')
        // Fetch ALL expense transactions (include those with old bill_id links)
        const { data } = await supabase
            .from('transactions')
            .select('id, description, amount, transaction_date, raw_party, linked_payable_id, reconciliation_status')
            .lt('amount', 0) // Expense transactions have negative amounts
            .is('linked_payable_id', null) // Not already linked to a payable
            .order('transaction_date', { ascending: false })
            .limit(100)
        setTransactions(data || [])
        setLoadingTxns(false)
    }

    const handleLinkTransaction = async (transactionId: string) => {
        if (!linkingPayable) return
        if (isRetroactiveLink) {
            await linkPayableRetroactive(linkingPayable.id, transactionId)
        } else {
            await linkPayableToTransaction(linkingPayable.id, transactionId)
        }
        setLinkModalOpen(false)
        setLinkingPayable(null)
        setIsRetroactiveLink(false)
        fetchData()
    }

    const openLinkModalForPaid = async (payable: Payable) => {
        setIsRetroactiveLink(true)
        setLinkingPayable(payable)
        setLinkModalOpen(true)
        setLoadingTxns(true)
        setTxnSearch('')
        // For retroactive linking, show reconciled expense transactions too
        const { data } = await supabase
            .from('transactions')
            .select('id, description, amount, transaction_date, raw_party, linked_payable_id')
            .lt('amount', 0)
            .is('linked_payable_id', null)
            .order('transaction_date', { ascending: false })
            .limit(100)
        setTransactions(data || [])
        setLoadingTxns(false)
    }

    // Open detail modal with linked transaction
    const openDetailModal = async (payable: Payable) => {
        setSelectedPayable(payable)
        setDetailModalOpen(true)
        setLinkedTransaction(null)

        if (payable.linked_transaction_id) {
            setLoadingDetail(true)
            const { data } = await supabase
                .from('transactions')
                .select('id, description, amount, transaction_date, raw_party, type, categories(name)')
                .eq('id', payable.linked_transaction_id)
                .single()
            setLinkedTransaction(data)
            setLoadingDetail(false)
        }
    }

    // Filter
    const today = new Date()
    const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const filteredPayables = payables.filter(p => {
        const dueDate = new Date(p.next_due)
        const isOverdue = dueDate < today && p.bill_status !== 'paid'
        const isDueSoon = dueDate >= today && dueDate <= weekFromNow && p.bill_status !== 'paid'

        if (filterStatus === 'overdue' && !isOverdue) return false
        if (filterStatus === 'due-soon' && !isDueSoon) return false
        if (filterStatus === 'scheduled' && (isOverdue || isDueSoon || p.bill_status === 'paid')) return false
        if (filterStatus === 'paid' && p.bill_status !== 'paid') return false

        if (filterPayee !== 'all' && p.payee_type !== filterPayee) return false

        // Month/Year filter
        if (filterMonth !== 'all') {
            if (dueDate.getMonth() !== filterMonth || dueDate.getFullYear() !== filterYear) return false
        } else if (filterYear) {
            if (dueDate.getFullYear() !== filterYear) return false
        }

        return true
    })

    const overdueCount = payables.filter(p => new Date(p.next_due) < today && p.bill_status !== 'paid').length

    const getStatusBadge = (p: Payable) => {
        const dueDate = new Date(p.next_due)
        if (p.bill_status === 'paid') return <Badge className="bg-emerald-500/20 text-emerald-400">Paid</Badge>
        if (dueDate < today) return <Badge className="bg-rose-500/20 text-rose-400">Overdue</Badge>
        if (dueDate <= weekFromNow) return <Badge className="bg-amber-500/20 text-amber-400">Due Soon</Badge>
        return <Badge className="bg-zinc-700 text-zinc-300">Scheduled</Badge>
    }

    const getPayeeIcon = (type: PayeeType) => {
        if (type === 'vendor') return <Building2 className="h-4 w-4 text-sky-400" />
        if (type === 'staff') return <Users className="h-4 w-4 text-purple-400" />
        return <Bot className="h-4 w-4 text-amber-400" />
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Accounts Payable</h1>
                    <p className="text-muted-foreground">Manage bills, invoices, and outgoing payments.</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setGenerateBillsModalOpen(true)}
                        className="h-10 gap-2 border-sky-800 text-sky-400 hover:bg-sky-900/30"
                    >
                        <CalendarPlus className="h-4 w-4" />
                        Generate Bills
                    </Button>
                    <Button
                        variant="outline"
                        onClick={async () => {
                            setIsGeneratingSalaries(true)
                            const result = await generateStaffSalaryBills()
                            setIsGeneratingSalaries(false)
                            if (result.created > 0) {
                                alert(`Created ${result.created} salary bill(s) for this week!`)
                                fetchData()
                            } else {
                                alert('No new salary bills to create. Either already exist or no staff have weekly_salary set.')
                            }
                        }}
                        disabled={isGeneratingSalaries}
                        className="h-10 gap-2 border-purple-800 text-purple-400 hover:bg-purple-900/30"
                    >
                        {isGeneratingSalaries ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
                        Generate Salaries
                    </Button>
                    <Button onClick={() => handleOpenModal()} className="h-10 gap-2 bg-white hover:bg-zinc-200 text-black">
                        <Plus className="h-4 w-4" /> Add Payable
                    </Button>
                </div>
            </div>

            {/* Summary Tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                    <p className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">Total Payables</p>
                    <p className="text-2xl font-black text-white mt-1">£{summary.totalPayables.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                    <p className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">Due Within 7 Days</p>
                    <p className="text-2xl font-black text-amber-400 mt-1">£{summary.dueWithin7Days.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                    <p className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">Merchant Fees</p>
                    <p className="text-2xl font-black text-sky-400 mt-1">£{summary.merchantFees.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                    <p className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">Staff Liability</p>
                    <p className="text-2xl font-black text-purple-400 mt-1">£{summary.staffLiability.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
            </div>

            {/* Tab Switcher */}
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
                <button
                    onClick={() => setActiveTab('bills')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${activeTab === 'bills'
                        ? 'bg-white text-black'
                        : 'bg-zinc-900 text-zinc-400 hover:text-white'
                        }`}
                >
                    <DollarSign className="h-4 w-4" />
                    Bills ({payables.length})
                </button>
                <button
                    onClick={() => setActiveTab('templates')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${activeTab === 'templates'
                        ? 'bg-white text-black'
                        : 'bg-zinc-900 text-zinc-400 hover:text-white'
                        }`}
                >
                    <FileText className="h-4 w-4" />
                    Templates ({templates.length})
                </button>
            </div>

            {activeTab === 'bills' && (
                <>
                    {/* Filters */}
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                            {(['all', 'overdue', 'due-soon', 'scheduled', 'paid'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilterStatus(f)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === f
                                        ? 'bg-white text-black'
                                        : 'bg-zinc-900 text-zinc-400 hover:text-white'
                                        }`}
                                >
                                    {f === 'due-soon' ? 'Due Soon' : f.charAt(0).toUpperCase() + f.slice(1)}
                                    {f === 'overdue' && overdueCount > 0 && (
                                        <span className="ml-1 text-rose-500">({overdueCount})</span>
                                    )}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            {(['all', 'vendor', 'staff', 'system'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilterPayee(f)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${filterPayee === f
                                        ? 'bg-white text-black'
                                        : 'bg-zinc-900 text-zinc-400 hover:text-white'
                                        }`}
                                >
                                    {f === 'vendor' && <Building2 className="h-3 w-3" />}
                                    {f === 'staff' && <Users className="h-3 w-3" />}
                                    {f === 'system' && <Bot className="h-3 w-3" />}
                                    {f.charAt(0).toUpperCase() + f.slice(1)}
                                </button>
                            ))}
                        </div>
                        {/* Month/Year Filter */}
                        <div className="flex items-center gap-2">
                            <select
                                value={filterMonth === 'all' ? 'all' : filterMonth}
                                onChange={(e) => setFilterMonth(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 text-zinc-300 border border-zinc-700 focus:outline-none focus:border-zinc-500"
                            >
                                <option value="all">All Months</option>
                                <option value="0">January</option>
                                <option value="1">February</option>
                                <option value="2">March</option>
                                <option value="3">April</option>
                                <option value="4">May</option>
                                <option value="5">June</option>
                                <option value="6">July</option>
                                <option value="7">August</option>
                                <option value="8">September</option>
                                <option value="9">October</option>
                                <option value="10">November</option>
                                <option value="11">December</option>
                            </select>
                            <select
                                value={filterYear}
                                onChange={(e) => setFilterYear(parseInt(e.target.value))}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 text-zinc-300 border border-zinc-700 focus:outline-none focus:border-zinc-500"
                            >
                                {[2024, 2025, 2026, 2027].map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                        {/* View Toggle */}
                        <div className="flex items-center gap-1 ml-auto bg-zinc-900 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('table')}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${viewMode === 'table' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}
                            >
                                <LayoutList className="h-3.5 w-3.5" /> Table
                            </button>
                            <button
                                onClick={() => setViewMode('calendar')}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${viewMode === 'calendar' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}
                            >
                                <CalendarDays className="h-3.5 w-3.5" /> Calendar
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    {isLoading ? (
                        <div className="flex h-32 items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : viewMode === 'table' ? (
                        /* Table View */
                        filteredPayables.length === 0 ? (
                            <div className="p-12 text-center border-2 border-dashed border-zinc-800 rounded-xl">
                                <p className="text-muted-foreground italic text-sm">No payables found.</p>
                            </div>
                        ) : (
                            <Card className="border-zinc-800 bg-zinc-950/50">
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="border-zinc-800 hover:bg-transparent">
                                                <TableHead className="text-zinc-400 text-xs uppercase w-20">Status</TableHead>
                                                <TableHead className="text-zinc-400 text-xs uppercase">Payee</TableHead>
                                                <TableHead className="text-zinc-400 text-xs uppercase w-32 hidden lg:table-cell">Category</TableHead>
                                                <TableHead className="text-zinc-400 text-xs uppercase text-right w-20">Amount</TableHead>
                                                <TableHead className="text-zinc-400 text-xs uppercase w-24">Due</TableHead>
                                                <TableHead className="text-zinc-400 text-xs uppercase w-24">Paid</TableHead>
                                                <TableHead className="text-zinc-400 text-xs uppercase w-20 hidden md:table-cell">Linked</TableHead>
                                                <TableHead className="text-zinc-400 text-xs uppercase text-right w-24">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredPayables.map((p) => (
                                                <TableRow
                                                    key={p.id}
                                                    className="border-zinc-800 hover:bg-zinc-900/50 cursor-pointer"
                                                    onClick={() => openDetailModal(p)}
                                                >
                                                    <TableCell>{getStatusBadge(p)}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            {getPayeeIcon(p.payee_type)}
                                                            <div>
                                                                <p className="font-medium text-white">{p.name}</p>
                                                                <p className="text-[10px] text-zinc-500">
                                                                    {p.payee_type === 'vendor' && p.vendors?.name}
                                                                    {p.payee_type === 'staff' && p.staff?.name}
                                                                    {p.payee_type === 'system' && 'System Generated'}
                                                                </p>
                                                            </div>
                                                            {p.auto_pay && (
                                                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 font-medium flex items-center gap-0.5">
                                                                    <Zap className="h-2.5 w-2.5" /> AUTO
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-zinc-400 text-xs hidden lg:table-cell">{p.categories?.name || '-'}</TableCell>
                                                    <TableCell className="text-right">
                                                        <span className="font-bold text-white tabular-nums">£{p.amount.toFixed(2)}</span>
                                                        {p.amount_tax > 0 && <p className="text-[10px] text-zinc-500">+£{p.amount_tax.toFixed(2)} VAT</p>}
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-xs text-zinc-300">
                                                            {new Date(p.next_due).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        {p.last_paid_date ? (
                                                            <span className="text-xs text-emerald-400">
                                                                {new Date(p.last_paid_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-zinc-600">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="hidden md:table-cell">
                                                        {p.linked_transaction_id ? (
                                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">
                                                                Linked
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] text-zinc-600">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            {p.bill_status !== 'paid' && !p.linked_transaction_id && (
                                                                <>
                                                                    <button onClick={() => handleMarkPaid(p)} className="p-2 text-zinc-500 hover:text-emerald-500" title="Mark Paid">
                                                                        <CheckCircle2 className="h-4 w-4" />
                                                                    </button>
                                                                    <button onClick={() => openLinkModal(p)} className="p-2 text-zinc-500 hover:text-sky-400" title="Link Transaction">
                                                                        <Link2 className="h-4 w-4" />
                                                                    </button>
                                                                </>
                                                            )}
                                                            {/* Link button for paid items without linked transaction (retroactive linking) */}
                                                            {p.bill_status === 'paid' && !p.linked_transaction_id && (
                                                                <button onClick={() => openLinkModalForPaid(p)} className="p-2 text-zinc-500 hover:text-emerald-500" title="Link to Transaction (Retroactive)">
                                                                    <Link2 className="h-4 w-4" />
                                                                </button>
                                                            )}
                                                            {p.bill_status === 'paid' && (
                                                                <button onClick={() => handleMarkUnpaid(p)} className="p-2 text-zinc-500 hover:text-rose-500" title="Mark Unpaid">
                                                                    <AlertCircle className="h-4 w-4" />
                                                                </button>
                                                            )}
                                                            <button onClick={() => handleOpenModal(p)} className="p-2 text-zinc-500 hover:text-white" title="Edit">
                                                                <Pencil className="h-4 w-4" />
                                                            </button>
                                                            {!p.is_system_generated && (
                                                                <button onClick={() => handleDelete(p.id)} className="p-2 text-zinc-500 hover:text-rose-500" title="Delete">
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        )
                    ) : (
                        /* Calendar View */
                        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                            {/* Calendar Header */}
                            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                                <button
                                    onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                                    className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </button>
                                <h3 className="text-lg font-bold text-white">
                                    {calendarMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                                </h3>
                                <button
                                    onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                                    className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                                >
                                    <ChevronRight className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Day Headers */}
                            <div className="grid grid-cols-7 border-b border-zinc-800">
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                    <div key={day} className="p-2 text-center text-xs font-bold text-zinc-500 uppercase">
                                        {day}
                                    </div>
                                ))}
                            </div>

                            {/* Calendar Grid */}
                            <div className="grid grid-cols-7">
                                {(() => {
                                    const year = calendarMonth.getFullYear()
                                    const month = calendarMonth.getMonth()
                                    const firstDay = new Date(year, month, 1)
                                    const lastDay = new Date(year, month + 1, 0)
                                    const startOffset = (firstDay.getDay() + 6) % 7 // Monday = 0
                                    const daysInMonth = lastDay.getDate()
                                    const cells = []

                                    // Empty cells for offset
                                    for (let i = 0; i < startOffset; i++) {
                                        cells.push(<div key={`empty-${i}`} className="min-h-24 border-b border-r border-zinc-800 bg-zinc-950/50" />)
                                    }

                                    // Day cells
                                    for (let day = 1; day <= daysInMonth; day++) {
                                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                                        const dayPayables = payables.filter(p => p.next_due === dateStr)
                                        const isToday = new Date().toISOString().split('T')[0] === dateStr
                                        const isPast = new Date(dateStr) < new Date(new Date().toDateString())

                                        cells.push(
                                            <div
                                                key={day}
                                                className={`min-h-24 p-2 border-b border-r border-zinc-800 ${isToday ? 'bg-sky-900/20' : ''} ${isPast ? 'bg-zinc-950/50' : ''}`}
                                            >
                                                <div className={`text-sm font-medium mb-1 ${isToday ? 'text-sky-400' : isPast ? 'text-zinc-600' : 'text-zinc-300'}`}>
                                                    {day}
                                                </div>
                                                <div className="space-y-1">
                                                    {dayPayables.slice(0, 3).map(p => (
                                                        <div
                                                            key={p.id}
                                                            onClick={() => handleOpenModal(p)}
                                                            className={`text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer transition-opacity hover:opacity-80 ${p.bill_status === 'paid'
                                                                ? 'bg-emerald-500/20 text-emerald-400'
                                                                : isPast
                                                                    ? 'bg-rose-500/20 text-rose-400'
                                                                    : p.payee_type === 'vendor'
                                                                        ? 'bg-sky-500/20 text-sky-400'
                                                                        : p.payee_type === 'staff'
                                                                            ? 'bg-purple-500/20 text-purple-400'
                                                                            : 'bg-amber-500/20 text-amber-400'
                                                                }`}
                                                        >
                                                            £{p.amount.toFixed(0)} {p.name.slice(0, 12)}
                                                        </div>
                                                    ))}
                                                    {dayPayables.length > 3 && (
                                                        <div className="text-[10px] text-zinc-500">+{dayPayables.length - 3} more</div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    }

                                    return cells
                                })()}
                            </div>

                            {/* Legend */}
                            <div className="flex items-center gap-4 p-3 border-t border-zinc-800 text-[10px]">
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Templates Section */}
            {activeTab === 'templates' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <p className="text-sm text-zinc-400">
                            Create templates for recurring bills. Generated bills will link back to their template.
                        </p>
                        <Button
                            onClick={() => {
                                setEditingTemplate(null)
                                resetForm()
                                setFrequency('monthly')
                                setTemplateModalOpen(true)
                            }}
                            className="h-10 gap-2 bg-white hover:bg-zinc-200 text-black"
                        >
                            <Plus className="h-4 w-4" /> New Template
                        </Button>
                    </div>

                    {templates.length === 0 ? (
                        <div className="text-center py-12 bg-zinc-900/50 rounded-xl border border-zinc-800">
                            <FileText className="h-12 w-12 mx-auto text-zinc-600 mb-4" />
                            <h3 className="text-lg font-semibold text-white">No templates yet</h3>
                            <p className="text-sm text-zinc-500 mt-1">Create your first template to generate recurring bills</p>
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {templates.map(template => (
                                <div
                                    key={template.id}
                                    className={`p-4 rounded-xl border ${template.is_active ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-950 border-zinc-900 opacity-60'}`}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            {template.payee_type === 'vendor' && <Building2 className="h-4 w-4 text-sky-400" />}
                                            {template.payee_type === 'staff' && <Users className="h-4 w-4 text-purple-400" />}
                                            {template.payee_type === 'system' && <Bot className="h-4 w-4 text-amber-400" />}
                                            <h3 className="font-semibold text-white">{template.name}</h3>
                                        </div>
                                        {!template.is_active && (
                                            <Badge variant="outline" className={template.is_ended ? 'text-rose-500 border-rose-800' : 'text-zinc-500 border-zinc-700'}>
                                                {template.is_ended ? 'Ended' : 'Paused'}
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-zinc-500">Amount</span>
                                            <span className="text-white font-medium">£{template.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-zinc-500">Frequency</span>
                                            <span className="text-white capitalize">{template.frequency}</span>
                                        </div>
                                        {template.is_variable_amount && (
                                            <div className="flex items-center gap-1 text-amber-400">
                                                <AlertCircle className="h-3 w-3" />
                                                <span className="text-xs">Variable amount</span>
                                            </div>
                                        )}
                                        {template.vendors?.name && (
                                            <div className="flex justify-between">
                                                <span className="text-zinc-500">Vendor</span>
                                                <span className="text-zinc-300">{template.vendors.name}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-2 mt-4 pt-3 border-t border-zinc-800">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                setEditingTemplate(template)
                                                setName(template.name)
                                                setPayeeType(template.payee_type)
                                                setVendorId(template.vendor_id || '')
                                                setStaffId(template.staff_id || '')
                                                setAmount(template.amount.toString())
                                                setFrequency(template.frequency)
                                                setCategoryId(template.category_id || '')
                                                setNotes(template.notes || '')
                                                setIsVariableAmount(template.is_variable_amount || false)
                                                setUseSmartName(template.use_smart_name !== false)
                                                setDayOfMonth((template as any).day_of_month || 15)
                                                setTemplateModalOpen(true)
                                            }}
                                            className="flex-1 h-8"
                                        >
                                            <Pencil className="h-3 w-3 mr-1" /> Edit
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={async () => {
                                                await toggleTemplateActive(template.id)
                                                fetchData()
                                            }}
                                            className={`flex-1 h-8 ${template.is_active ? 'text-amber-400 border-amber-800 hover:bg-amber-900/30' : 'text-emerald-400 border-emerald-800 hover:bg-emerald-900/30'}`}
                                        >
                                            {template.is_active ? (
                                                <><Pause className="h-3 w-3 mr-1" /> Pause</>
                                            ) : (
                                                <><Play className="h-3 w-3 mr-1" /> Resume</>
                                            )}
                                        </Button>
                                        {!template.is_ended && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={async () => {
                                                    if (!confirm('End this template permanently? It will no longer generate bills.')) return
                                                    await endTemplate(template.id)
                                                    fetchData()
                                                }}
                                                className="h-8 text-rose-400 border-rose-800 hover:bg-rose-900/30"
                                            >
                                                <Square className="h-3 w-3" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-lg bg-zinc-950 rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-zinc-900 flex justify-between items-center">
                            <h2 className="text-xl font-bold">{editingPayable ? 'Edit Payable' : 'Add Payable'}</h2>
                            <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="text-zinc-500 hover:text-white">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            {/* Payee Type Toggle */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-2">Payee Type</label>
                                <div className="flex gap-2">
                                    {(['vendor', 'staff'] as const).map(t => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => setPayeeType(t)}
                                            className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${payeeType === t ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-400'}`}
                                        >
                                            {t === 'vendor' ? <Building2 className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                                            {t.charAt(0).toUpperCase() + t.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Name *</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm"
                                    placeholder="e.g., Rent, Coach Invoice, etc."
                                />
                            </div>

                            {payeeType === 'vendor' && (
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Vendor</label>
                                    <select value={vendorId} onChange={e => setVendorId(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm">
                                        <option value="">Select vendor...</option>
                                        {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                    </select>
                                </div>
                            )}

                            {payeeType === 'staff' && (
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Staff Member</label>
                                    <select value={staffId} onChange={e => setStaffId(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm">
                                        <option value="">Select staff...</option>
                                        {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Amount *</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">£</span>
                                        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full h-10 pl-7 pr-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm" placeholder="0.00" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">VAT Amount</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">£</span>
                                        <input type="number" value={amountTax} onChange={e => setAmountTax(e.target.value)} className="w-full h-10 pl-7 pr-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm" placeholder="0.00" />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Due Date *</label>
                                    <input type="date" value={nextDue} onChange={e => setNextDue(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Frequency</label>
                                    <select value={frequency} onChange={e => setFrequency(e.target.value as Frequency)} className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm">
                                        <option value="one-time">One-time</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                        <option value="quarterly">Quarterly</option>
                                        <option value="yearly">Yearly</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Category</label>
                                <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm">
                                    <option value="">Select category...</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            {payeeType === 'staff' && (
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Invoice Number</label>
                                    <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm" placeholder="INV-001" />
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Notes</label>
                                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full h-20 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm resize-none" placeholder="Optional notes..." />
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={autoPay} onChange={e => setAutoPay(e.target.checked)} className="h-4 w-4 rounded" />
                                <span className="text-sm text-zinc-300">Auto-pay enabled</span>
                            </label>

                            {frequency !== 'one-time' && (
                                <div className="p-3 rounded-lg bg-amber-900/20 border border-amber-800/50">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={isVariableAmount}
                                            onChange={e => setIsVariableAmount(e.target.checked)}
                                            className="h-4 w-4 rounded accent-amber-500"
                                        />
                                        <span className="text-sm text-amber-300 font-medium">Variable amount (metered)</span>
                                    </label>
                                    {isVariableAmount && (
                                        <p className="text-xs text-amber-400/70 mt-1 ml-6">
                                            Generated bills will be marked as "Draft" so you can update the amount when the actual bill arrives.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="p-6 border-t border-zinc-900 flex gap-3">
                            {editingPayable && (
                                <Button
                                    variant="outline"
                                    onClick={async () => {
                                        if (!confirm("Delete this payable?")) return
                                        setIsModalOpen(false)
                                        await handleDelete(editingPayable.id)
                                        resetForm()
                                    }}
                                    className="border-rose-800 text-rose-400 hover:bg-rose-900/30"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                            <Button variant="outline" onClick={() => { setIsModalOpen(false); resetForm(); }} className="flex-1">Cancel</Button>
                            <Button onClick={handleSave} disabled={isSaving} className="flex-1 bg-white text-black hover:bg-zinc-200">
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {editingPayable ? 'Update' : 'Create'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payable Detail Modal */}
            {detailModalOpen && selectedPayable && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-lg bg-zinc-950 rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-zinc-900 flex justify-between items-center">
                            <h2 className="text-xl font-bold">Bill Details</h2>
                            <button onClick={() => { setDetailModalOpen(false); setSelectedPayable(null); }} className="text-zinc-500 hover:text-white">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* Bill Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[10px] uppercase text-zinc-500 font-bold">Payee</p>
                                    <p className="text-white font-medium">{selectedPayable.name}</p>
                                    <p className="text-xs text-zinc-400">
                                        {selectedPayable.payee_type === 'vendor' && selectedPayable.vendors?.name}
                                        {selectedPayable.payee_type === 'staff' && selectedPayable.staff?.name}
                                        {selectedPayable.payee_type === 'system' && 'System Generated'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] uppercase text-zinc-500 font-bold">Amount</p>
                                    <p className="text-xl font-bold text-white">£{selectedPayable.amount.toFixed(2)}</p>
                                    {selectedPayable.amount_tax > 0 && (
                                        <p className="text-xs text-zinc-400">+£{selectedPayable.amount_tax.toFixed(2)} VAT</p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <p className="text-[10px] uppercase text-zinc-500 font-bold">Status</p>
                                    {getStatusBadge(selectedPayable)}
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase text-zinc-500 font-bold">Due Date</p>
                                    <p className="text-sm text-zinc-300">{new Date(selectedPayable.next_due).toLocaleDateString('en-GB')}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase text-zinc-500 font-bold">Paid Date</p>
                                    <p className="text-sm text-zinc-300">
                                        {selectedPayable.last_paid_date
                                            ? new Date(selectedPayable.last_paid_date).toLocaleDateString('en-GB')
                                            : '-'}
                                    </p>
                                </div>
                            </div>

                            {selectedPayable.categories?.name && (
                                <div>
                                    <p className="text-[10px] uppercase text-zinc-500 font-bold">Category</p>
                                    <p className="text-sm text-zinc-300">{selectedPayable.categories.name}</p>
                                </div>
                            )}

                            {selectedPayable.notes && (
                                <div>
                                    <p className="text-[10px] uppercase text-zinc-500 font-bold">Notes</p>
                                    <p className="text-sm text-zinc-300">{selectedPayable.notes}</p>
                                </div>
                            )}

                            {/* Linked Transaction Section */}
                            <div className="pt-4 border-t border-zinc-800">
                                <p className="text-[10px] uppercase text-zinc-500 font-bold mb-2">Linked Transaction</p>
                                {loadingDetail ? (
                                    <div className="flex items-center gap-2 text-zinc-400">
                                        <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                                    </div>
                                ) : linkedTransaction ? (
                                    <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-sm font-medium text-white">{linkedTransaction.raw_party || linkedTransaction.description}</p>
                                                <p className="text-xs text-zinc-400">
                                                    {new Date(linkedTransaction.transaction_date).toLocaleDateString('en-GB')} • {linkedTransaction.categories?.name || 'Uncategorized'}
                                                </p>
                                            </div>
                                            <p className="text-sm font-bold text-emerald-400">£{Math.abs(linkedTransaction.amount).toFixed(2)}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-zinc-500 text-sm italic">
                                        No transaction linked yet
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="p-4 border-t border-zinc-900 flex gap-2">
                            {!selectedPayable.linked_transaction_id && selectedPayable.bill_status !== 'paid' && (
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => { setDetailModalOpen(false); openLinkModal(selectedPayable); }}
                                >
                                    <Link2 className="h-4 w-4 mr-2" /> Link Transaction
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => { setDetailModalOpen(false); handleOpenModal(selectedPayable); }}
                            >
                                <Pencil className="h-4 w-4 mr-2" /> Edit
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setDetailModalOpen(false)}
                            >
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Link Transaction Modal */}
            {linkModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-xl bg-zinc-950 rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-zinc-900 flex justify-between items-center">
                            <h2 className="text-xl font-bold">Link to Transaction</h2>
                            <button onClick={() => { setLinkModalOpen(false); setLinkingPayable(null); }} className="text-zinc-500 hover:text-white">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-6">
                            {linkingPayable && (
                                <div className="mb-4 p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                                    <p className="text-sm text-zinc-400">Linking:</p>
                                    <p className="font-bold text-white">{linkingPayable.name} - £{linkingPayable.amount.toFixed(2)}</p>
                                </div>
                            )}
                            <div className="mb-4">
                                <input
                                    type="text"
                                    placeholder="Search transactions..."
                                    value={txnSearch}
                                    onChange={e => setTxnSearch(e.target.value)}
                                    className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm"
                                />
                            </div>
                            {loadingTxns ? (
                                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                            ) : transactions.length === 0 ? (
                                <p className="text-center text-zinc-500 py-8">No transactions available for linking.</p>
                            ) : (
                                <div className="max-h-80 overflow-y-auto space-y-2">
                                    {transactions
                                        .filter(t => {
                                            if (!txnSearch) return true
                                            const search = txnSearch.toLowerCase()
                                            return (t.description || '').toLowerCase().includes(search) ||
                                                (t.raw_party || '').toLowerCase().includes(search) ||
                                                String(Math.abs(t.amount)).includes(search)
                                        })
                                        .map(t => (
                                            <button
                                                key={t.id}
                                                onClick={() => handleLinkTransaction(t.id)}
                                                className="w-full p-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-left flex justify-between items-center"
                                            >
                                                <div>
                                                    <p className="text-sm text-white">{t.description || t.raw_party}</p>
                                                    <p className="text-xs text-zinc-500">{new Date(t.transaction_date).toLocaleDateString('en-GB')}</p>
                                                </div>
                                                <span className="font-bold text-red-400">-£{Math.abs(t.amount).toFixed(2)}</span>
                                            </button>
                                        ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Generate Bills Modal */}
            {generateBillsModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md bg-zinc-950 rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-zinc-900 flex justify-between items-center">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <CalendarPlus className="h-5 w-5 text-sky-400" />
                                Generate Recurring Bills
                            </h2>
                            <button onClick={() => setGenerateBillsModalOpen(false)} className="text-zinc-500 hover:text-white">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-zinc-400">
                                Pre-generate bills for all recurring payables for a specific month.
                                Bills that already exist for the selected month will be skipped.
                            </p>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Month</label>
                                    <select
                                        value={generateMonth}
                                        onChange={e => setGenerateMonth(parseInt(e.target.value))}
                                        className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm"
                                    >
                                        {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
                                            <option key={m} value={i}>{m}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Year</label>
                                    <select
                                        value={generateYear}
                                        onChange={e => setGenerateYear(parseInt(e.target.value))}
                                        className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm"
                                    >
                                        {[2025, 2026, 2027, 2028].map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
                                <p className="text-xs text-zinc-400">
                                    This will create bills like "<span className="text-sky-400">Rent - {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][generateMonth]} {generateYear}</span>"
                                    for each recurring bill template.
                                </p>
                            </div>
                        </div>
                        <div className="p-6 border-t border-zinc-900 flex gap-3">
                            <Button variant="outline" onClick={() => setGenerateBillsModalOpen(false)} className="flex-1">Cancel</Button>
                            <Button
                                onClick={async () => {
                                    setIsGeneratingBills(true)
                                    const result = await generateUpcomingBills(generateMonth, generateYear)
                                    setIsGeneratingBills(false)
                                    setGenerateBillsModalOpen(false)
                                    if (result.created > 0) {
                                        alert(`Created ${result.created} bill(s) for ${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][generateMonth]} ${generateYear}!`)
                                        fetchData()
                                    } else {
                                        alert(`No new bills to create. Either no recurring bills exist or they already have bills for ${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][generateMonth]} ${generateYear}.`)
                                    }
                                }}
                                disabled={isGeneratingBills}
                                className="flex-1 bg-sky-600 hover:bg-sky-700 text-white"
                            >
                                {isGeneratingBills && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Generate Bills
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Template Modal */}
            {templateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-lg bg-zinc-950 rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-zinc-900 flex justify-between items-center">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <FileText className="h-5 w-5 text-emerald-400" />
                                {editingTemplate ? 'Edit Template' : 'New Template'}
                            </h2>
                            <button onClick={() => { setTemplateModalOpen(false); resetForm(); }} className="text-zinc-500 hover:text-white">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Template Name *</label>
                                <input
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm"
                                    placeholder="e.g., Rent, Electric Bill, Internet"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-2">Payee Type</label>
                                <div className="flex gap-2">
                                    {(['vendor', 'staff'] as const).map(t => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => setPayeeType(t)}
                                            className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${payeeType === t ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-400'}`}
                                        >
                                            {t === 'vendor' ? <Building2 className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                                            {t.charAt(0).toUpperCase() + t.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {payeeType === 'vendor' && (
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Vendor</label>
                                    <select value={vendorId} onChange={e => setVendorId(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm">
                                        <option value="">Select vendor...</option>
                                        {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                    </select>
                                </div>
                            )}

                            {payeeType === 'staff' && (
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Staff Member</label>
                                    <select value={staffId} onChange={e => setStaffId(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm">
                                        <option value="">Select staff...</option>
                                        {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Amount *</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">£</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={amount}
                                            onChange={e => setAmount(e.target.value)}
                                            className="w-full h-10 pl-7 pr-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Frequency *</label>
                                    <select value={frequency} onChange={e => setFrequency(e.target.value as any)} className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm">
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                        <option value="quarterly">Quarterly</option>
                                        <option value="yearly">Yearly</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Due Day of Month</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="28"
                                    value={dayOfMonth}
                                    onChange={e => setDayOfMonth(Math.min(28, Math.max(1, parseInt(e.target.value) || 1)))}
                                    className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm"
                                />
                                <p className="text-[10px] text-zinc-500 mt-1">Bills will be due on this day (1-28)</p>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Category</label>
                                <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm">
                                    <option value="">Select category...</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Notes</label>
                                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full h-20 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm resize-none" placeholder="Optional notes..." />
                            </div>

                            <div className="p-3 rounded-lg bg-amber-900/20 border border-amber-800/50">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isVariableAmount}
                                        onChange={e => setIsVariableAmount(e.target.checked)}
                                        className="h-4 w-4 rounded accent-amber-500"
                                    />
                                    <span className="text-sm text-amber-300 font-medium">Variable amount (metered)</span>
                                </label>
                                {isVariableAmount && (
                                    <p className="text-xs text-amber-400/70 mt-1 ml-6">
                                        Generated bills will be Draft status so you can update the actual amount.
                                    </p>
                                )}
                            </div>

                            <div className="p-3 rounded-lg bg-emerald-900/20 border border-emerald-800/50">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={useSmartName}
                                        onChange={e => setUseSmartName(e.target.checked)}
                                        className="h-4 w-4 rounded accent-emerald-500"
                                    />
                                    <span className="text-sm text-emerald-300 font-medium">Smart naming</span>
                                </label>
                                <p className="text-xs text-emerald-400/70 mt-1 ml-6">
                                    {useSmartName
                                        ? frequency === 'yearly'
                                            ? `Bills will be named "${name || 'Template'} 2026"`
                                            : frequency === 'quarterly'
                                                ? `Bills will be named "${name || 'Template'} Q1 2026"`
                                                : frequency === 'weekly'
                                                    ? `Bills will be named "${name || 'Template'} Week 1"`
                                                    : `Bills will be named "${name || 'Template'} - January 2026"`
                                        : `Bills will just be named "${name || 'Template'}"`
                                    }
                                </p>
                            </div>
                        </div>
                        <div className="p-6 border-t border-zinc-900 flex gap-3">
                            {editingTemplate && (
                                <Button
                                    variant="outline"
                                    onClick={async () => {
                                        if (!confirm("Delete this template?")) return
                                        await deletePayable(editingTemplate.id)
                                        setTemplateModalOpen(false)
                                        resetForm()
                                        fetchData()
                                    }}
                                    className="border-rose-800 text-rose-400 hover:bg-rose-900/30"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                            <Button variant="outline" onClick={() => { setTemplateModalOpen(false); resetForm(); }} className="flex-1">Cancel</Button>
                            <Button
                                onClick={async () => {
                                    if (!name || !amount) return
                                    setIsSaving(true)
                                    try {
                                        if (editingTemplate) {
                                            await updatePayable(editingTemplate.id, {
                                                name,
                                                payee_type: payeeType,
                                                vendor_id: vendorId || null,
                                                staff_id: staffId || null,
                                                amount: parseFloat(amount),
                                                frequency,
                                                day_of_month: dayOfMonth,
                                                category_id: categoryId || null,
                                                notes: notes || null,
                                                is_variable_amount: isVariableAmount,
                                                use_smart_name: useSmartName
                                            } as any)
                                        } else {
                                            await createTemplate({
                                                name,
                                                payee_type: payeeType,
                                                vendor_id: vendorId || undefined,
                                                staff_id: staffId || undefined,
                                                amount: parseFloat(amount),
                                                frequency,
                                                day_of_month: dayOfMonth,
                                                category_id: categoryId || undefined,
                                                notes: notes || undefined,
                                                is_variable_amount: isVariableAmount,
                                                use_smart_name: useSmartName
                                            })
                                        }
                                        setTemplateModalOpen(false)
                                        resetForm()
                                        fetchData()
                                    } catch (e) {
                                        console.error('Save template error:', e)
                                    }
                                    setIsSaving(false)
                                }}
                                disabled={isSaving || !name || !amount}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {editingTemplate ? 'Update Template' : 'Create Template'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
