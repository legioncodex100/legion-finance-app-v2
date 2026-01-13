"use client"

import * as React from "react"
import { Plus, Receipt, Calendar, CheckCircle2, Loader2, Pencil, Trash2, X, Clock, XCircle, DollarSign, Filter, Upload, FileText, Eye, UserCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { uploadBillDocument, getSignedDocumentUrl } from "@/app/actions/upload-bill-document"

interface Invoice {
    id: string
    invoice_number: string
    staff_id: string | null
    amount: number
    description: string | null
    service_date_from: string
    service_date_to: string | null
    due_date: string | null
    hours_worked: number | null
    hourly_rate: number | null
    status: 'pending' | 'paid' | 'review'
    invoice_type: 'coaching' | 'facilities' | 'va' | null
    document_url: string | null
    reviewed_at: string | null
    rejection_reason: string | null
    paid_at: string | null
    transaction_id: string | null
    notes: string | null
    created_at: string
    staff?: { name: string } | null
}

interface Staff {
    id: string
    name: string
    is_coach?: boolean
    is_facilities?: boolean
    is_va?: boolean
    coach_hourly_rate?: number
    coach_pay_period?: string
    coach_disciplines?: string[]
    facilities_hourly_rate?: number
    facilities_pay_period?: string
    va_monthly_rate?: number
    va_pay_period?: string
}

type InvoiceType = 'coaching' | 'facilities' | 'va' | ''

export default function InvoicesPage() {
    const [invoices, setInvoices] = React.useState<Invoice[]>([])
    const [staff, setStaff] = React.useState<Staff[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const [isModalOpen, setIsModalOpen] = React.useState(false)
    const [editingInvoice, setEditingInvoice] = React.useState<Invoice | null>(null)
    const [isSaving, setIsSaving] = React.useState(false)
    const [filterStatus, setFilterStatus] = React.useState<'all' | 'pending' | 'paid' | 'review'>('all')

    // Form state
    const [staffId, setStaffId] = React.useState("")
    const [amount, setAmount] = React.useState("")
    const [description, setDescription] = React.useState("")
    const [serviceDateFrom, setServiceDateFrom] = React.useState("")
    const [serviceDateTo, setServiceDateTo] = React.useState("")
    const [dueDate, setDueDate] = React.useState("")
    const [hoursWorked, setHoursWorked] = React.useState("")
    const [hourlyRate, setHourlyRate] = React.useState("")
    const [notes, setNotes] = React.useState("")
    const [documentData, setDocumentData] = React.useState<{ base64: string, mimeType: string } | null>(null)
    const [invoiceType, setInvoiceType] = React.useState<InvoiceType>("")
    const [payPeriod, setPayPeriod] = React.useState<string>("hourly")
    const [formStatus, setFormStatus] = React.useState<'pending' | 'paid' | 'review'>('pending')

    // Viewer state
    const [viewingDocument, setViewingDocument] = React.useState<string | null>(null)

    const supabase = createClient()

    const fetchInvoices = React.useCallback(async () => {
        setIsLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
            .from('invoices')
            .select('*, staff(name)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

        setInvoices(data || [])
        setIsLoading(false)
    }, [supabase])

    const fetchStaff = React.useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
            .from('staff')
            .select('id, name, is_coach, is_facilities, is_va, coach_hourly_rate, coach_pay_period, coach_disciplines, facilities_hourly_rate, facilities_pay_period, va_monthly_rate, va_pay_period')
            .eq('user_id', user.id)
            .order('name')

        setStaff(data || [])
    }, [supabase])

    React.useEffect(() => {
        fetchInvoices()
        fetchStaff()
    }, [fetchInvoices, fetchStaff])

    const resetForm = () => {
        setStaffId("")
        setAmount("")
        setDescription("")
        setServiceDateFrom("")
        setServiceDateTo("")
        setDueDate("")
        setHoursWorked("")
        setHourlyRate("")
        setNotes("")
        setDocumentData(null)
        setEditingInvoice(null)
        setInvoiceType("")
        setPayPeriod("hourly")
        setFormStatus('pending')
    }

    // Get the selected staff member
    const selectedStaff = staff.find(s => s.id === staffId)

    // Get available invoice types for selected staff
    const getAvailableTypes = () => {
        if (!selectedStaff) return []
        const types: { value: InvoiceType, label: string }[] = []
        if (selectedStaff.is_coach) types.push({ value: 'coaching', label: 'Coaching' })
        if (selectedStaff.is_facilities) types.push({ value: 'facilities', label: 'Facilities' })
        if (selectedStaff.is_va) types.push({ value: 'va', label: 'Virtual Assistant' })
        return types
    }

    // Auto-fill rate when staff or invoice type changes
    React.useEffect(() => {
        if (!selectedStaff || !invoiceType) {
            setHourlyRate("")
            return
        }
        if (invoiceType === 'coaching' && selectedStaff.coach_hourly_rate) {
            setHourlyRate(selectedStaff.coach_hourly_rate.toString())
            setPayPeriod(selectedStaff.coach_pay_period || 'hourly')
        } else if (invoiceType === 'facilities' && selectedStaff.facilities_hourly_rate) {
            setHourlyRate(selectedStaff.facilities_hourly_rate.toString())
            setPayPeriod(selectedStaff.facilities_pay_period || 'hourly')
        } else if (invoiceType === 'va' && selectedStaff.va_monthly_rate) {
            setHourlyRate(selectedStaff.va_monthly_rate.toString())
            setPayPeriod(selectedStaff.va_pay_period || 'monthly')
        }
    }, [staffId, invoiceType, selectedStaff])

    const handleOpenModal = (invoice?: Invoice) => {
        if (invoice) {
            setEditingInvoice(invoice)
            setStaffId(invoice.staff_id || "")
            setAmount(invoice.amount.toString())
            setDescription(invoice.description || "")
            setServiceDateFrom(invoice.service_date_from || "")
            setServiceDateTo(invoice.service_date_to || "")
            setDueDate(invoice.due_date || "")
            setHoursWorked(invoice.hours_worked?.toString() || "")
            setHourlyRate(invoice.hourly_rate?.toString() || "")
            setNotes(invoice.notes || "")
            setInvoiceType(invoice.invoice_type || "")
            setFormStatus(invoice.status)
        } else {
            resetForm()
        }
        setIsModalOpen(true)
    }

    const handleSave = async () => {
        if (!amount || !serviceDateFrom) return
        setIsSaving(true)

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setIsSaving(false); return }

        // Calculate amount from hours if provided
        let finalAmount = parseFloat(amount)
        if (hoursWorked && hourlyRate) {
            finalAmount = parseFloat(hoursWorked) * parseFloat(hourlyRate)
        }

        const invoiceData = {
            staff_id: staffId || null,
            amount: finalAmount,
            description: description || null,
            service_date_from: serviceDateFrom,
            service_date_to: serviceDateTo || null,
            due_date: dueDate || null,
            hours_worked: hoursWorked ? parseFloat(hoursWorked) : null,
            hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
            notes: notes || null,
            status: editingInvoice ? formStatus : 'pending' as const,
            invoice_type: invoiceType || null,
            paid_at: formStatus === 'paid' ? (editingInvoice?.paid_at || new Date().toISOString().split('T')[0]) : null,
            user_id: user.id
        }

        let invoiceId = editingInvoice?.id

        if (editingInvoice) {
            await supabase.from('invoices').update(invoiceData).eq('id', editingInvoice.id)
        } else {
            const { data: newInvoice } = await supabase.from('invoices').insert(invoiceData).select('id').single()
            invoiceId = newInvoice?.id
        }

        // Upload document if we have one
        if (documentData && invoiceId) {
            const { url } = await uploadBillDocument(documentData.base64, documentData.mimeType, invoiceId)
            if (url) {
                await supabase.from('invoices').update({ document_url: url }).eq('id', invoiceId)
            }
        }

        setIsModalOpen(false)
        resetForm()
        fetchInvoices()
        setIsSaving(false)
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this invoice?")) return
        await supabase.from('invoices').delete().eq('id', id)
        fetchInvoices()
    }

    const handleReject = async (invoice: Invoice) => {
        const reason = prompt("Review note (why are you flagging this?):")
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('invoices').update({
            status: 'review',
            reviewed_by: user?.id,
            reviewed_at: new Date().toISOString(),
            rejection_reason: reason || null
        }).eq('id', invoice.id)
        fetchInvoices()
    }

    const handleMarkPaid = async (invoice: Invoice) => {
        await supabase.from('invoices').update({
            status: 'paid',
            paid_at: new Date().toISOString().split('T')[0]
        }).eq('id', invoice.id)
        fetchInvoices()
    }

    const handleMarkPending = async (invoice: Invoice) => {
        await supabase.from('invoices').update({
            status: 'pending',
            paid_at: null
        }).eq('id', invoice.id)
        fetchInvoices()
    }

    // Filter invoices
    const filtered = invoices.filter(inv => {
        if (filterStatus === 'all') return true
        return inv.status === filterStatus
    })

    // Calculate stats
    const totalPending = invoices.filter(i => i.status === 'pending').reduce((sum, i) => sum + i.amount, 0)
    const totalReview = invoices.filter(i => i.status === 'review').reduce((sum, i) => sum + i.amount, 0)
    const totalPaid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0)
    const pendingCount = invoices.filter(i => i.status === 'pending').length

    const getStatusBadge = (status: Invoice['status']) => {
        switch (status) {
            case 'pending': return <Badge className="bg-amber-500/20 text-amber-400">Pending</Badge>
            case 'paid': return <Badge className="bg-emerald-500/20 text-emerald-400">Paid</Badge>
            case 'review': return <Badge className="bg-rose-500/20 text-rose-400">Review</Badge>
        }
    }

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white">Invoices</h1>
                    <p className="text-zinc-500 mt-1">Manage invoices from staff and contractors</p>
                </div>
                <Button onClick={() => handleOpenModal()} className="bg-white text-black hover:bg-zinc-200 font-semibold">
                    <Plus className="h-4 w-4 mr-2" /> Add Invoice
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4 mb-8">
                <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Pending</p>
                    <p className="text-2xl font-bold text-amber-400 mt-1">£{totalPending.toFixed(2)}</p>
                    <p className="text-xs text-zinc-500 mt-1">{pendingCount} invoices</p>
                </div>
                <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Under Review</p>
                    <p className="text-2xl font-bold text-rose-400 mt-1">£{totalReview.toFixed(2)}</p>
                </div>
                <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Paid This Month</p>
                    <p className="text-2xl font-bold text-emerald-400 mt-1">£{totalPaid.toFixed(2)}</p>
                </div>
                <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Total Invoices</p>
                    <p className="text-2xl font-bold text-white mt-1">{invoices.length}</p>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 mb-6">
                <Filter className="h-4 w-4 text-zinc-500" />
                {(['all', 'pending', 'paid', 'review'] as const).map(status => (
                    <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filterStatus === status
                            ? 'bg-white text-black'
                            : 'bg-zinc-800 text-zinc-400 hover:text-white'
                            }`}
                    >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                        {status === 'pending' && pendingCount > 0 && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-500 text-black text-[10px]">{pendingCount}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Invoice List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20 text-zinc-500">
                    <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No invoices found</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(invoice => (
                        <div key={invoice.id} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 hover:border-zinc-700 transition-colors">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                                        <Receipt className="h-4 w-4 text-zinc-500" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold text-white">{invoice.staff?.name || 'Unknown'}</p>
                                            {getStatusBadge(invoice.status)}
                                        </div>
                                        <p className="text-xs text-zinc-500">
                                            {invoice.invoice_number} • {new Date(invoice.service_date_from).toLocaleDateString()}{invoice.service_date_to ? ` - ${new Date(invoice.service_date_to).toLocaleDateString()}` : ''}
                                        </p>
                                        {invoice.description && (
                                            <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{invoice.description}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    {/* Only Mark Paid button on cards */}
                                    {(invoice.status === 'pending' || invoice.status === 'review') && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleMarkPaid(invoice)}
                                            className="text-xs h-8 border-emerald-800 text-emerald-400 hover:bg-emerald-900/50"
                                        >
                                            <span className="mr-1 font-bold">£</span> Mark Paid
                                        </Button>
                                    )}
                                    <div className="text-right">
                                        <p className="text-xl font-bold text-white tabular-nums">£{invoice.amount.toFixed(2)}</p>
                                        {invoice.hours_worked && (
                                            <p className="text-[10px] text-zinc-500">{invoice.hours_worked}h @ £{invoice.hourly_rate}/h</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {/* View document */}
                                        {invoice.document_url && (
                                            <button
                                                onClick={async () => {
                                                    const url = await getSignedDocumentUrl(invoice.document_url!)
                                                    if (url) setViewingDocument(url)
                                                }}
                                                className="p-2 text-zinc-500 hover:text-sky-400 transition-colors"
                                                title="View Document"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </button>
                                        )}
                                        <button onClick={() => handleOpenModal(invoice)} className="p-2 text-zinc-500 hover:text-white transition-colors">
                                            <Pencil className="h-4 w-4" />
                                        </button>
                                        <button onClick={() => handleDelete(invoice.id)} className="p-2 text-zinc-500 hover:text-rose-500 transition-colors">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-lg bg-zinc-950 rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-zinc-900 flex justify-between items-center">
                            <h2 className="text-xl font-bold">{editingInvoice ? 'Edit Invoice' : 'Add Invoice'}</h2>
                            <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="text-zinc-500 hover:text-white">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto overflow-x-hidden">
                            {/* Staff Selection */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Staff Member *</label>
                                <select
                                    value={staffId}
                                    onChange={e => { setStaffId(e.target.value); setInvoiceType(""); }}
                                    className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm"
                                >
                                    <option value="">Select staff...</option>
                                    {staff.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Invoice Type - only show if staff selected and has multiple types */}
                            {staffId && getAvailableTypes().length > 0 && (
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Invoice For *</label>
                                    <select
                                        value={invoiceType}
                                        onChange={e => setInvoiceType(e.target.value as InvoiceType)}
                                        className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm"
                                    >
                                        <option value="">Select type...</option>
                                        {getAvailableTypes().map(t => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Coach disciplines if coaching type */}
                            {invoiceType === 'coaching' && selectedStaff?.coach_disciplines && selectedStaff.coach_disciplines.length > 0 && (
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Disciplines</label>
                                    <div className="flex flex-wrap gap-1">
                                        {selectedStaff.coach_disciplines.map(d => (
                                            <span key={d} className="px-2 py-1 text-xs bg-indigo-500/20 text-indigo-400 rounded-full">{d}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Service Date Range */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">From *</label>
                                    <input
                                        type="date"
                                        value={serviceDateFrom}
                                        onChange={e => setServiceDateFrom(e.target.value)}
                                        className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">To</label>
                                    <input
                                        type="date"
                                        value={serviceDateTo}
                                        onChange={e => setServiceDateTo(e.target.value)}
                                        className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm"
                                    />
                                </div>
                            </div>

                            {/* Quantity/Rate based on pay period */}
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">
                                        {payPeriod === 'hourly' ? 'Hours' : payPeriod === 'weekly' ? 'Weeks' : 'Months'}
                                    </label>
                                    <input
                                        type="number"
                                        value={hoursWorked}
                                        onChange={e => {
                                            setHoursWorked(e.target.value)
                                            if (e.target.value && hourlyRate) {
                                                setAmount((parseFloat(e.target.value) * parseFloat(hourlyRate)).toString())
                                            }
                                        }}
                                        className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm"
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">
                                        Rate (£/{payPeriod === 'hourly' ? 'h' : payPeriod === 'weekly' ? 'wk' : 'mo'})
                                    </label>
                                    <input
                                        type="number"
                                        value={hourlyRate}
                                        onChange={e => {
                                            setHourlyRate(e.target.value)
                                            if (hoursWorked && e.target.value) {
                                                setAmount((parseFloat(hoursWorked) * parseFloat(e.target.value)).toString())
                                            }
                                        }}
                                        className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm"
                                        placeholder="0"
                                        readOnly={!!invoiceType}
                                    />
                                </div>
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
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Description</label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    className="w-full h-20 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm resize-none"
                                    placeholder="Services rendered..."
                                />
                            </div>

                            {/* Due Date */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Due Date</label>
                                <input
                                    type="date"
                                    value={dueDate}
                                    onChange={e => setDueDate(e.target.value)}
                                    className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm"
                                />
                            </div>

                            {/* Status - only show when editing */}
                            {editingInvoice && (
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Status</label>
                                    <select
                                        value={formStatus}
                                        onChange={e => setFormStatus(e.target.value as 'pending' | 'paid' | 'review')}
                                        className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm"
                                    >
                                        <option value="pending">Pending</option>
                                        <option value="paid">Paid</option>
                                        <option value="review">Review</option>
                                    </select>
                                </div>
                            )}

                            {/* Notes */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Internal Notes</label>
                                <input
                                    type="text"
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm"
                                    placeholder="Optional..."
                                />
                            </div>

                            {/* Document Upload */}
                            <div className="flex items-center gap-4 pt-2">
                                <input
                                    type="file"
                                    id="invoice-document-upload"
                                    accept=".pdf,image/*"
                                    className="hidden"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0]
                                        if (!file) return
                                        const reader = new FileReader()
                                        reader.onload = () => {
                                            setDocumentData({
                                                base64: reader.result as string,
                                                mimeType: file.type
                                            })
                                        }
                                        reader.readAsDataURL(file)
                                    }}
                                />
                                <label
                                    htmlFor="invoice-document-upload"
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm cursor-pointer transition-colors"
                                >
                                    <Upload className="h-4 w-4" />
                                    {documentData ? 'Document attached ✓' : 'Upload Invoice'}
                                </label>
                                {documentData && (
                                    <button
                                        type="button"
                                        onClick={() => setDocumentData(null)}
                                        className="text-xs text-zinc-500 hover:text-rose-400"
                                    >
                                        Remove
                                    </button>
                                )}
                                {editingInvoice?.document_url && !documentData && (
                                    <span className="text-xs text-emerald-400 flex items-center gap-1">
                                        <FileText className="h-3 w-3" /> Has document
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="p-6 border-t border-zinc-900 flex justify-end gap-3">
                            <Button variant="outline" onClick={() => { setIsModalOpen(false); resetForm(); }}>Cancel</Button>
                            <Button onClick={handleSave} disabled={!amount || !serviceDateFrom || isSaving} className="bg-white text-black hover:bg-zinc-200 font-bold">
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                {editingInvoice ? 'Save Changes' : 'Submit Invoice'}
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
                                Invoice Document
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
                                    title="Invoice Document"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
                                    <img
                                        src={viewingDocument}
                                        alt="Invoice Document"
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
