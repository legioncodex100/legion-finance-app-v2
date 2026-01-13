"use client"

import * as React from "react"
import { Plus, RotateCcw, Calendar, AlertCircle, CheckCircle2, Loader2, Pencil, Trash2, X, Clock, Zap, DollarSign, Filter, Upload, FileText, Eye } from "lucide-react"

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { extractBillFromImage, extractBillFromText } from "@/app/actions/extract-bill"
import { extractTextFromDocx } from "@/app/actions/extract-docx"
import { uploadBillDocument, getSignedDocumentUrl } from "@/app/actions/upload-bill-document"

interface Bill {
    id: string
    name: string
    vendor_id: string | null
    amount: number
    amount_paid: number
    frequency: string
    next_due: string
    is_paid: boolean
    category_id: string | null
    description: string | null
    auto_pay: boolean
    reminder_days: number
    last_paid_date: string | null
    status: 'active' | 'paused' | 'cancelled'
    created_at: string
    document_url: string | null
    vendors?: { name: string } | null
    categories?: { name: string } | null
}

export default function BillsPage() {
    const [bills, setBills] = React.useState<Bill[]>([])
    const [vendors, setVendors] = React.useState<any[]>([])
    const [categories, setCategories] = React.useState<any[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const [isModalOpen, setIsModalOpen] = React.useState(false)
    const [editingBill, setEditingBill] = React.useState<Bill | null>(null)
    const [isSaving, setIsSaving] = React.useState(false)
    const [filterStatus, setFilterStatus] = React.useState<'all' | 'active' | 'paused' | 'overdue'>('all')
    const [filterMonth, setFilterMonth] = React.useState<string>('all')

    // Form state
    const [name, setName] = React.useState("")
    const [vendorId, setVendorId] = React.useState("")
    const [amount, setAmount] = React.useState("")
    const [frequency, setFrequency] = React.useState("monthly")
    const [nextDue, setNextDue] = React.useState("")
    const [categoryId, setCategoryId] = React.useState("")
    const [description, setDescription] = React.useState("")
    const [autoPay, setAutoPay] = React.useState(false)
    const [reminderDays, setReminderDays] = React.useState("3")
    const [status, setStatus] = React.useState<'active' | 'paused' | 'cancelled'>('active')
    const [isAddingVendor, setIsAddingVendor] = React.useState(false)
    const [newVendorName, setNewVendorName] = React.useState("")
    const [isScanning, setIsScanning] = React.useState(false)
    const [categorySearch, setCategorySearch] = React.useState("")
    const [showCategoryDropdown, setShowCategoryDropdown] = React.useState(false)
    const [scannedDocumentData, setScannedDocumentData] = React.useState<{ base64: string, mimeType: string } | null>(null)
    const [viewingDocument, setViewingDocument] = React.useState<string | null>(null)
    const [documentLoading, setDocumentLoading] = React.useState(false)
    const fileInputRef = React.useRef<HTMLInputElement>(null)


    const supabase = createClient()

    const fetchBills = React.useCallback(async () => {
        setIsLoading(true)
        const { data } = await supabase
            .from('recurring_bills')
            .select('*, vendors(name), categories(name)')
            .order('next_due', { ascending: true })
        if (data) setBills(data)
        setIsLoading(false)
    }, [supabase])

    const fetchVendors = React.useCallback(async () => {
        const { data } = await supabase.from('vendors').select('id, name').order('name')
        if (data) setVendors(data)
    }, [supabase])

    const fetchCategories = React.useCallback(async () => {
        const { data } = await supabase.from('categories').select('id, name').eq('type', 'expense').order('name')
        if (data) setCategories(data)
    }, [supabase])

    React.useEffect(() => {
        fetchBills()
        fetchVendors()
        fetchCategories()
    }, [fetchBills, fetchVendors, fetchCategories])

    const resetForm = () => {
        setName("")
        setVendorId("")
        setAmount("")
        setFrequency("monthly")
        setNextDue("")
        setCategoryId("")
        setDescription("")
        setAutoPay(false)
        setReminderDays("3")
        setStatus('active')
        setEditingBill(null)
        setIsAddingVendor(false)
        setNewVendorName("")
        setCategorySearch("")
        setShowCategoryDropdown(false)
        setScannedDocumentData(null)
    }

    const handleAddVendor = async () => {
        if (!newVendorName.trim()) return
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase.from('vendors').insert({
            name: newVendorName.trim(),
            user_id: user.id
        }).select().single()

        if (data && !error) {
            setVendors(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
            setVendorId(data.id)
            setIsAddingVendor(false)
            setNewVendorName("")
        }
    }

    const handleScanBill = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        setIsScanning(true)
        setIsModalOpen(true)

        try {
            // Convert file to base64
            const reader = new FileReader()
            reader.onload = async () => {
                const base64 = (reader.result as string).split(',')[1]
                const mimeType = file.type
                const isDocx = file.name.toLowerCase().endsWith('.docx') ||
                    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

                try {
                    let extracted
                    if (isDocx) {
                        // Extract text from Word doc first, then parse
                        const text = await extractTextFromDocx(base64)
                        extracted = await extractBillFromText(text)
                    } else {
                        // Use image/PDF extraction
                        extracted = await extractBillFromImage(base64, mimeType)
                    }

                    // Pre-fill form with extracted data
                    if (extracted.vendor_name) {
                        setName(extracted.vendor_name)
                        // Check if vendor exists
                        const matchingVendor = vendors.find(v =>
                            v.name.toLowerCase().includes(extracted.vendor_name!.toLowerCase()) ||
                            extracted.vendor_name!.toLowerCase().includes(v.name.toLowerCase())
                        )
                        if (matchingVendor) {
                            setVendorId(matchingVendor.id)
                        }
                    }
                    if (extracted.amount) {
                        setAmount(extracted.amount.toString())
                    }
                    if (extracted.due_date) {
                        setNextDue(extracted.due_date)
                    }
                    if (extracted.description) {
                        setDescription(extracted.description)
                    }
                    if (extracted.frequency) {
                        setFrequency(extracted.frequency)
                    }
                    // Match suggested category to existing categories
                    // First try to match based on description keywords
                    const descLower = (extracted.description || '').toLowerCase()
                    const vendorLower = (extracted.vendor_name || '').toLowerCase()
                    const searchText = descLower + ' ' + vendorLower

                    let matchingCategory = null

                    // Priority matching based on bill content keywords
                    if (searchText.includes('electric') || searchText.includes('gas')) {
                        matchingCategory = categories.find(c =>
                            c.name.toLowerCase().includes('electric') || c.name.toLowerCase().includes('gas')
                        )
                    } else if (searchText.includes('water') || searchText.includes('waste')) {
                        matchingCategory = categories.find(c => c.name.toLowerCase().includes('water'))
                    } else if (searchText.includes('internet') || searchText.includes('broadband') || searchText.includes('wifi')) {
                        matchingCategory = categories.find(c => c.name.toLowerCase().includes('broadband'))
                    } else if (searchText.includes('phone') || searchText.includes('mobile') || searchText.includes('telecom')) {
                        matchingCategory = categories.find(c => c.name.toLowerCase().includes('communication'))
                    } else if (searchText.includes('rent') || searchText.includes('lease')) {
                        matchingCategory = categories.find(c => c.name.toLowerCase().includes('rent'))
                    } else if (searchText.includes('insurance')) {
                        matchingCategory = categories.find(c => c.name.toLowerCase().includes('insurance'))
                    }

                    // Fallback to AI suggestion if no keyword match
                    if (!matchingCategory && extracted.suggested_category) {
                        matchingCategory = categories.find(c =>
                            c.name.toLowerCase().includes(extracted.suggested_category!.toLowerCase()) ||
                            extracted.suggested_category!.toLowerCase().includes(c.name.toLowerCase())
                        )
                    }

                    if (matchingCategory) {
                        setCategoryId(matchingCategory.id)
                    }

                    // Store document data for upload when saving
                    setScannedDocumentData({ base64: reader.result as string, mimeType })
                } catch (error) {
                    console.error("Extraction failed:", error)
                    alert("Failed to extract bill data. Please fill in manually.")
                }
                setIsScanning(false)
            }
            reader.readAsDataURL(file)
        } catch (error) {
            console.error("File read failed:", error)
            setIsScanning(false)
        }

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const handleOpenModal = (bill?: Bill) => {
        if (bill) {
            setEditingBill(bill)
            setName(bill.name)
            setVendorId(bill.vendor_id || "")
            setAmount(bill.amount.toString())
            setFrequency(bill.frequency)
            setNextDue(bill.next_due)
            setCategoryId(bill.category_id || "")
            setDescription(bill.description || "")
            setAutoPay(bill.auto_pay || false)
            setReminderDays(bill.reminder_days?.toString() || "3")
            setStatus(bill.status || 'active')
        } else {
            resetForm()
        }
        setIsModalOpen(true)
    }

    const handleSave = async () => {
        if (!name || !amount || !nextDue) return
        setIsSaving(true)

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setIsSaving(false); return }

        const billData = {
            name,
            vendor_id: vendorId || null,
            amount: parseFloat(amount),
            frequency,
            next_due: nextDue,
            category_id: categoryId || null,
            description: description || null,
            auto_pay: autoPay,
            reminder_days: parseInt(reminderDays) || 3,
            status,
            user_id: user.id
        }

        let billId = editingBill?.id

        if (editingBill) {
            await supabase.from('recurring_bills').update(billData).eq('id', editingBill.id)
        } else {
            const { data: newBill } = await supabase.from('recurring_bills').insert(billData).select('id').single()
            billId = newBill?.id
        }

        // Upload document if we have one from scanning
        if (scannedDocumentData && billId) {
            const { url, error } = await uploadBillDocument(
                scannedDocumentData.base64,
                scannedDocumentData.mimeType,
                billId
            )
            if (url && !error) {
                await supabase.from('recurring_bills').update({ document_url: url }).eq('id', billId)
            }
        }

        setIsModalOpen(false)
        resetForm()
        fetchBills()
        setIsSaving(false)
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this bill?")) return
        await supabase.from('recurring_bills').delete().eq('id', id)
        fetchBills()
    }

    const handleMarkPaid = async (bill: Bill) => {
        // Calculate next due date based on frequency
        const currentDue = new Date(bill.next_due)
        let nextDueDate = new Date(currentDue)

        switch (bill.frequency.toLowerCase()) {
            case 'weekly':
                nextDueDate.setDate(nextDueDate.getDate() + 7)
                break
            case 'monthly':
                nextDueDate.setMonth(nextDueDate.getMonth() + 1)
                break
            case 'quarterly':
                nextDueDate.setMonth(nextDueDate.getMonth() + 3)
                break
            case 'yearly':
            case 'annual':
                nextDueDate.setFullYear(nextDueDate.getFullYear() + 1)
                break
            default:
                nextDueDate.setMonth(nextDueDate.getMonth() + 1)
        }

        // Mark current cycle as paid and advance to next cycle
        // Reset is_paid and amount_paid for the NEW billing cycle
        await supabase.from('recurring_bills').update({
            last_paid_date: new Date().toISOString().split('T')[0],
            next_due: nextDueDate.toISOString().split('T')[0],
            is_paid: false,  // New cycle is not paid yet
            amount_paid: 0   // Reset for new cycle
        }).eq('id', bill.id)

        fetchBills()
    }

    // Calculate summaries
    const today = new Date()
    const oneWeekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

    const activeBills = bills.filter(b => b.status === 'active')
    const totalMonthly = activeBills.reduce((sum, b) => {
        const amount = b.amount
        switch (b.frequency.toLowerCase()) {
            case 'weekly': return sum + (amount * 4.33)
            case 'monthly': return sum + amount
            case 'quarterly': return sum + (amount / 3)
            case 'yearly':
            case 'annual': return sum + (amount / 12)
            default: return sum + amount
        }
    }, 0)

    const upcomingThisWeek = activeBills.filter(b => {
        const due = new Date(b.next_due)
        return due >= today && due <= oneWeekFromNow
    }).length

    const overdueBills = activeBills.filter(b => new Date(b.next_due) < today)
    const overdueCount = overdueBills.length

    // Filter bills
    const filteredBills = bills.filter(b => {
        // Status filter
        if (filterStatus === 'active' && b.status !== 'active') return false
        if (filterStatus === 'paused' && b.status !== 'paused') return false
        if (filterStatus === 'overdue' && !(b.status === 'active' && new Date(b.next_due) < today)) return false

        // Month filter
        if (filterMonth !== 'all') {
            const dueDate = new Date(b.next_due)
            const monthKey = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`
            if (monthKey !== filterMonth) return false
        }

        return true
    })

    // Calculate filtered totals for the summary cards
    const filteredTotal = filteredBills.reduce((sum, b) => sum + b.amount, 0)
    const filteredActiveCount = filteredBills.filter(b => b.status === 'active').length
    const filteredOverdueCount = filteredBills.filter(b => b.status === 'active' && new Date(b.next_due) < today).length
    const filteredUpcomingThisWeek = filteredBills.filter(b => {
        const due = new Date(b.next_due)
        return b.status === 'active' && due >= today && due <= oneWeekFromNow
    }).length


    const getDueStatus = (nextDue: string, status: string, isPaid: boolean, lastPaidDate: string | null) => {
        if (status !== 'active') return null
        const due = new Date(nextDue)
        const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

        // If paid, check if it was paid late
        if (isPaid && lastPaidDate) {
            const paidDate = new Date(lastPaidDate)
            const daysLate = Math.ceil((paidDate.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
            if (daysLate > 0) {
                return { label: `Paid ${daysLate} days late`, color: 'text-amber-500 bg-amber-500/10' }
            }
            return null // Paid on time, no special label needed
        }

        if (diffDays < 0) return { label: `Overdue by ${Math.abs(diffDays)} days`, color: 'text-rose-500 bg-rose-500/10' }
        if (diffDays === 0) return { label: 'Due today', color: 'text-amber-500 bg-amber-500/10' }
        if (diffDays <= 3) return { label: `Due in ${diffDays} days`, color: 'text-amber-500 bg-amber-500/10' }
        return null
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Bills</h1>
                    <p className="text-muted-foreground">Track and manage your recurring business expenses.</p>
                </div>
                <div className="flex gap-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,.pdf,.docx"
                        onChange={handleScanBill}
                        className="hidden"
                        id="bill-upload"
                    />
                    <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isScanning}
                        className="h-10 gap-2 border-sky-800 text-sky-400 hover:bg-sky-900/50"
                    >
                        {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        Scan Bill
                    </Button>
                    <Button onClick={() => handleOpenModal()} className="h-10 gap-2 bg-black hover:bg-zinc-800 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200">
                        <Plus className="h-4 w-4" /> Add Bill
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                    <p className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">
                        {filterMonth !== 'all' ? 'Month Total' : 'Monthly Total'}
                    </p>
                    <p className="text-2xl font-black text-white mt-1">£{filterMonth !== 'all' ? filteredTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : totalMonthly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                    <p className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">Due This Week</p>
                    <p className="text-2xl font-black text-sky-400 mt-1">{filterMonth !== 'all' ? filteredUpcomingThisWeek : upcomingThisWeek}</p>
                </div>
                <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                    <p className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">Overdue</p>
                    <p className={`text-2xl font-black mt-1 ${(filterMonth !== 'all' ? filteredOverdueCount : overdueCount) > 0 ? 'text-rose-500' : 'text-zinc-500'}`}>{filterMonth !== 'all' ? filteredOverdueCount : overdueCount}</p>
                </div>
                <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                    <p className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">{filterMonth !== 'all' ? 'Filtered Bills' : 'Active Bills'}</p>
                    <p className="text-2xl font-black text-emerald-400 mt-1">{filterMonth !== 'all' ? filteredBills.length : activeBills.length}</p>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    {(['all', 'active', 'paused', 'overdue'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilterStatus(f)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === f
                                ? 'bg-white text-black'
                                : 'bg-zinc-900 text-zinc-400 hover:text-white'
                                }`}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                            {f === 'overdue' && overdueCount > 0 && (
                                <span className="ml-1 text-rose-500">({overdueCount})</span>
                            )}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <select
                        value={filterMonth}
                        onChange={(e) => setFilterMonth(e.target.value)}
                        className="h-8 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-300 focus:outline-none focus:border-zinc-600"
                    >
                        <option value="all">All Months</option>
                        {(() => {
                            // Generate month options from bill due dates
                            const months = new Set<string>()
                            bills.forEach(b => {
                                const d = new Date(b.next_due)
                                months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
                            })
                            // Also add current month and next 6 months
                            for (let i = 0; i < 6; i++) {
                                const d = new Date()
                                d.setMonth(d.getMonth() + i)
                                months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
                            }
                            return Array.from(months).sort().map(m => {
                                const [year, month] = m.split('-')
                                const date = new Date(parseInt(year), parseInt(month) - 1)
                                return (
                                    <option key={m} value={m}>
                                        {date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                                    </option>
                                )
                            })
                        })()}
                    </select>
                </div>
            </div>

            {isLoading ? (
                <div className="flex h-32 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : filteredBills.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-zinc-800 rounded-xl">
                    <p className="text-muted-foreground italic text-sm">No bills found. Add one to start tracking.</p>
                </div>
            ) : (
                <Card className="border-zinc-800 bg-zinc-950/50">
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-zinc-800 hover:bg-transparent">
                                    <TableHead className="text-zinc-400 font-bold text-xs uppercase tracking-wider">Bill Name</TableHead>
                                    <TableHead className="text-zinc-400 font-bold text-xs uppercase tracking-wider">Vendor</TableHead>
                                    <TableHead className="text-zinc-400 font-bold text-xs uppercase tracking-wider">Frequency</TableHead>
                                    <TableHead className="text-zinc-400 font-bold text-xs uppercase tracking-wider text-right">Amount</TableHead>
                                    <TableHead className="text-zinc-400 font-bold text-xs uppercase tracking-wider">Due Date</TableHead>
                                    <TableHead className="text-zinc-400 font-bold text-xs uppercase tracking-wider">Status</TableHead>
                                    <TableHead className="text-zinc-400 font-bold text-xs uppercase tracking-wider text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredBills.map((bill) => {
                                    const dueStatus = getDueStatus(bill.next_due, bill.status, bill.is_paid, bill.last_paid_date)
                                    return (
                                        <TableRow key={bill.id} className="border-zinc-800 hover:bg-zinc-900/50">
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-white">{bill.name}</span>
                                                    {bill.auto_pay && (
                                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 font-medium flex items-center gap-0.5">
                                                            <Zap className="h-2.5 w-2.5" /> AUTO
                                                        </span>
                                                    )}
                                                </div>
                                                {bill.categories?.name && (
                                                    <span className="text-[10px] text-zinc-500">{bill.categories.name}</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-zinc-400 text-sm">
                                                {bill.vendors?.name || <span className="italic text-zinc-600">No vendor</span>}
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-xs px-2 py-1 rounded-full bg-zinc-800 text-zinc-300 capitalize">
                                                    {bill.frequency}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span className="font-bold text-white tabular-nums">£{bill.amount.toFixed(2)}</span>
                                                {(bill.amount_paid > 0 && bill.amount_paid < bill.amount) && (
                                                    <p className="text-[10px] text-amber-400">£{bill.amount_paid.toFixed(2)} paid</p>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-sm text-zinc-300 flex items-center gap-1">
                                                        <Calendar className="h-3 w-3 text-zinc-500" />
                                                        {new Date(bill.next_due).toLocaleDateString()}
                                                    </span>
                                                    {dueStatus && (
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium w-fit ${dueStatus.color}`}>
                                                            {dueStatus.label}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {bill.is_paid ? (
                                                    <span className="text-[10px] px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 font-medium flex items-center gap-1 w-fit">
                                                        <CheckCircle2 className="h-3 w-3" /> Paid
                                                    </span>
                                                ) : bill.status === 'paused' ? (
                                                    <span className="text-[10px] px-2 py-1 rounded bg-zinc-700 text-zinc-400 font-medium">Paused</span>
                                                ) : bill.status === 'cancelled' ? (
                                                    <span className="text-[10px] px-2 py-1 rounded bg-zinc-700 text-zinc-500 font-medium">Cancelled</span>
                                                ) : (
                                                    <span className="text-[10px] px-2 py-1 rounded bg-amber-500/20 text-amber-400 font-medium">Unpaid</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {!bill.is_paid && bill.status === 'active' && (
                                                        <button
                                                            onClick={() => handleMarkPaid(bill)}
                                                            className="p-2 text-zinc-500 hover:text-emerald-500 transition-colors"
                                                            title="Mark Paid"
                                                        >
                                                            <CheckCircle2 className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {bill.document_url && (
                                                        <button
                                                            onClick={async () => {
                                                                setDocumentLoading(true)
                                                                const url = await getSignedDocumentUrl(bill.document_url!)
                                                                if (url) setViewingDocument(url)
                                                                setDocumentLoading(false)
                                                            }}
                                                            className="p-2 text-zinc-500 hover:text-sky-400 transition-colors"
                                                            title="View Document"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    <button onClick={() => handleOpenModal(bill)} className="p-2 text-zinc-500 hover:text-white transition-colors" title="Edit">
                                                        <Pencil className="h-4 w-4" />
                                                    </button>
                                                    <button onClick={() => handleDelete(bill.id)} className="p-2 text-zinc-500 hover:text-rose-500 transition-colors" title="Delete">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-lg bg-zinc-950 rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-zinc-900 flex justify-between items-center">
                            <h2 className="text-xl font-bold">{editingBill ? 'Edit Bill' : 'Add Bill'}</h2>
                            <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="text-zinc-500 hover:text-white">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto overflow-x-hidden">
                            {isScanning && (
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span className="text-sm font-medium">Scanning bill with AI...</span>
                                </div>
                            )}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Bill Name *</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm"
                                    placeholder="e.g., Rent, Internet, Software"
                                />
                            </div>
                            {/* Vendor - Right after Bill Name */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Vendor</label>
                                {isAddingVendor ? (
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newVendorName}
                                            onChange={e => setNewVendorName(e.target.value)}
                                            placeholder="Enter vendor name..."
                                            className="flex-1 min-w-0 h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm"
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddVendor}
                                            className="shrink-0 px-3 h-10 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
                                        >
                                            Add
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setIsAddingVendor(false); setNewVendorName("") }}
                                            className="shrink-0 p-2 h-10 rounded-lg bg-zinc-800 text-zinc-400 text-sm hover:text-white"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <select
                                            value={vendorId}
                                            onChange={e => setVendorId(e.target.value)}
                                            className="flex-1 min-w-0 h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm"
                                        >
                                            <option value="">None</option>
                                            {vendors.map(v => (
                                                <option key={v.id} value={v.id}>{v.name}</option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => setIsAddingVendor(true)}
                                            className="shrink-0 p-2 h-10 rounded-lg bg-zinc-800 text-zinc-400 text-sm hover:text-white hover:bg-zinc-700"
                                            title="Add new vendor"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Amount *</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">£</span>
                                        <input
                                            type="number"
                                            value={amount}
                                            onChange={e => setAmount(e.target.value)}
                                            className="w-full h-10 pl-7 pr-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Frequency</label>
                                    <select
                                        value={frequency}
                                        onChange={e => setFrequency(e.target.value)}
                                        className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm"
                                    >
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                        <option value="quarterly">Quarterly</option>
                                        <option value="yearly">Yearly</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Due Date *</label>
                                <input
                                    type="date"
                                    value={nextDue}
                                    onChange={e => setNextDue(e.target.value)}
                                    className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="relative">
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Category</label>
                                    <div
                                        className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm flex items-center justify-between cursor-pointer"
                                        onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                                    >
                                        <span className={categoryId ? "text-white" : "text-zinc-500"}>
                                            {categoryId ? categories.find(c => c.id === categoryId)?.name : "Select category..."}
                                        </span>
                                        <svg className="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                    {showCategoryDropdown && (
                                        <div className="absolute z-50 w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-h-60 overflow-hidden">
                                            <div className="p-2 border-b border-zinc-800">
                                                <input
                                                    type="text"
                                                    value={categorySearch}
                                                    onChange={e => setCategorySearch(e.target.value)}
                                                    placeholder="Search categories..."
                                                    className="w-full h-8 px-2 rounded bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-zinc-600"
                                                    autoFocus
                                                    onClick={e => e.stopPropagation()}
                                                />
                                            </div>
                                            <div className="max-h-44 overflow-y-auto">
                                                <div
                                                    className="px-3 py-2 hover:bg-zinc-800 cursor-pointer text-zinc-400 text-sm"
                                                    onClick={() => { setCategoryId(""); setShowCategoryDropdown(false); setCategorySearch(""); }}
                                                >
                                                    None
                                                </div>
                                                {categories
                                                    .filter(c => c.name.toLowerCase().includes(categorySearch.toLowerCase()))
                                                    .map(c => (
                                                        <div
                                                            key={c.id}
                                                            className={`px-3 py-2 hover:bg-zinc-800 cursor-pointer text-sm truncate ${categoryId === c.id ? 'bg-zinc-800 text-white' : 'text-zinc-300'}`}
                                                            onClick={() => { setCategoryId(c.id); setShowCategoryDropdown(false); setCategorySearch(""); }}
                                                        >
                                                            {c.name}
                                                        </div>
                                                    ))
                                                }
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Status</label>
                                    <select
                                        value={status}
                                        onChange={e => setStatus(e.target.value as any)}
                                        className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm"
                                    >
                                        <option value="active">Active</option>
                                        <option value="paused">Paused</option>
                                        <option value="cancelled">Cancelled</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Description</label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    className="w-full h-20 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm resize-none"
                                    placeholder="Optional notes..."
                                />
                            </div>
                            <div className="flex items-center gap-6 pt-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={autoPay}
                                        onChange={e => setAutoPay(e.target.checked)}
                                        className="h-4 w-4 rounded border-zinc-700 text-sky-600"
                                    />
                                    <span className="text-sm text-zinc-300">Auto-pay enabled</span>
                                </label>
                            </div>
                            {/* Document Upload */}
                            <div className="flex items-center gap-4 pt-2">
                                <input
                                    type="file"
                                    id="document-upload"
                                    accept=".pdf,image/*,.docx"
                                    className="hidden"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0]
                                        if (!file) return
                                        const reader = new FileReader()
                                        reader.onload = () => {
                                            setScannedDocumentData({
                                                base64: reader.result as string,
                                                mimeType: file.type
                                            })
                                        }
                                        reader.readAsDataURL(file)
                                    }}
                                />
                                <label
                                    htmlFor="document-upload"
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm cursor-pointer transition-colors"
                                >
                                    <Upload className="h-4 w-4" />
                                    {scannedDocumentData ? 'Document attached ✓' : 'Upload Document'}
                                </label>
                                {scannedDocumentData && (
                                    <button
                                        type="button"
                                        onClick={() => setScannedDocumentData(null)}
                                        className="text-xs text-zinc-500 hover:text-rose-400"
                                    >
                                        Remove
                                    </button>
                                )}
                                {editingBill?.document_url && !scannedDocumentData && (
                                    <span className="text-xs text-emerald-400 flex items-center gap-1">
                                        <FileText className="h-3 w-3" /> Has document
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="p-6 border-t border-zinc-900 flex justify-end gap-3">
                            <Button variant="outline" onClick={() => { setIsModalOpen(false); resetForm(); }}>Cancel</Button>
                            <Button onClick={handleSave} disabled={!name || !amount || !nextDue || isSaving} className="bg-white text-black hover:bg-zinc-200 font-bold">
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                {editingBill ? 'Save Changes' : 'Add Bill'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Document Viewer Modal */}
            {viewingDocument && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="w-full max-w-4xl h-[85vh] bg-zinc-950 rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-zinc-800 flex justify-between items-center shrink-0">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <FileText className="h-5 w-5 text-sky-400" />
                                Bill Document
                            </h2>
                            <button onClick={() => setViewingDocument(null)} className="text-zinc-500 hover:text-white">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            {viewingDocument.includes('.pdf') || viewingDocument.includes('application/pdf') ? (
                                <iframe
                                    src={viewingDocument}
                                    className="w-full h-full bg-white"
                                    title="Bill Document"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
                                    <img
                                        src={viewingDocument}
                                        alt="Bill Document"
                                        className="max-w-full max-h-full object-contain"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
