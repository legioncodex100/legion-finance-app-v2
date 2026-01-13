"use client"

import * as React from "react"
import { Plus, Building2, Mail, Phone, FileText, CreditCard, Loader2, X, ChevronDown, ChevronRight, Pencil, Trash2, Users, DollarSign, AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"

type CreditorType = 'bank' | 'family' | 'investor' | 'director' | 'supplier' | 'other'

interface Creditor {
    id: string
    name: string
    type: CreditorType
    contact_email?: string
    contact_phone?: string
    notes?: string
    created_at: string
}

interface LinkedDebt {
    id: string
    name?: string
    creditor_name: string
    remaining_balance: number
    original_balance: number
    monthly_payment: number
    status: string
}

const creditorTypeLabels: Record<CreditorType, { label: string; color: string }> = {
    bank: { label: 'Bank', color: 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-900/50' },
    family: { label: 'Family', color: 'bg-pink-500/10 text-pink-600 border-pink-200 dark:border-pink-900/50' },
    investor: { label: 'Investor', color: 'bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-900/50' },
    director: { label: 'Director', color: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-900/50' },
    supplier: { label: 'Supplier', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-900/50' },
    other: { label: 'Other', color: 'bg-slate-500/10 text-slate-600 border-slate-200 dark:border-zinc-800' },
}

export default function CreditorsPage() {
    const [creditors, setCreditors] = React.useState<Creditor[]>([])
    const [linkedDebts, setLinkedDebts] = React.useState<Record<string, LinkedDebt[]>>({})
    const [isLoading, setIsLoading] = React.useState(true)

    // Modal states
    const [isModalOpen, setIsModalOpen] = React.useState(false)
    const [isSaving, setIsSaving] = React.useState(false)
    const [expandedCreditorId, setExpandedCreditorId] = React.useState<string | null>(null)
    const [editingCreditorId, setEditingCreditorId] = React.useState<string | null>(null)

    // Form state
    const [name, setName] = React.useState("")
    const [type, setType] = React.useState<CreditorType>('other')
    const [contactEmail, setContactEmail] = React.useState("")
    const [contactPhone, setContactPhone] = React.useState("")
    const [notes, setNotes] = React.useState("")

    const supabase = createClient()

    const fetchCreditors = React.useCallback(async () => {
        setIsLoading(true)
        const { data } = await supabase
            .from('creditors')
            .select('*')
            .order('name')

        if (data) setCreditors(data)
        setIsLoading(false)
    }, [supabase])

    const fetchLinkedDebts = async (creditorId: string, creditorName: string) => {
        // Fetch debts linked by creditor_id OR by creditor_name
        const { data } = await supabase
            .from('debts')
            .select('id, name, creditor_name, remaining_balance, original_balance, monthly_payment, status')
            .or(`creditor_id.eq.${creditorId},creditor_name.ilike.${creditorName}`)

        if (data) {
            setLinkedDebts(prev => ({ ...prev, [creditorId]: data }))
        }
    }

    React.useEffect(() => {
        fetchCreditors()
    }, [fetchCreditors])

    const handleExpandCreditor = (creditor: Creditor) => {
        if (expandedCreditorId === creditor.id) {
            setExpandedCreditorId(null)
        } else {
            setExpandedCreditorId(creditor.id)
            fetchLinkedDebts(creditor.id, creditor.name)
        }
    }

    const resetForm = () => {
        setName("")
        setType('other')
        setContactEmail("")
        setContactPhone("")
        setNotes("")
        setEditingCreditorId(null)
    }

    const handleAddCreditor = async () => {
        if (!name) return

        setIsSaving(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { error } = await supabase.from('creditors').insert({
                name,
                type,
                contact_email: contactEmail || null,
                contact_phone: contactPhone || null,
                notes: notes || null,
                user_id: user.id
            })

            if (!error) {
                resetForm()
                setIsModalOpen(false)
                fetchCreditors()
            }
        } finally {
            setIsSaving(false)
        }
    }

    const handleEditCreditor = (creditor: Creditor) => {
        setEditingCreditorId(creditor.id)
        setName(creditor.name)
        setType(creditor.type)
        setContactEmail(creditor.contact_email || "")
        setContactPhone(creditor.contact_phone || "")
        setNotes(creditor.notes || "")
        setIsModalOpen(true)
    }

    const handleUpdateCreditor = async () => {
        if (!name || !editingCreditorId) return

        setIsSaving(true)
        try {
            const { error } = await supabase.from('creditors').update({
                name,
                type,
                contact_email: contactEmail || null,
                contact_phone: contactPhone || null,
                notes: notes || null
            }).eq('id', editingCreditorId)

            if (!error) {
                resetForm()
                setIsModalOpen(false)
                fetchCreditors()
            }
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteCreditor = async (creditorId: string) => {
        if (!confirm('Are you sure you want to delete this creditor? This will not delete linked debts.')) return

        await supabase.from('creditors').delete().eq('id', creditorId)
        fetchCreditors()
        if (expandedCreditorId === creditorId) setExpandedCreditorId(null)
    }

    // Calculate totals per creditor
    const getCreditorTotals = (creditorId: string) => {
        const debts = linkedDebts[creditorId] || []
        const totalOwed = debts.reduce((sum, d) => sum + d.remaining_balance, 0)
        const monthlyPayments = debts.reduce((sum, d) => sum + (d.monthly_payment || 0), 0)
        const activeDebts = debts.filter(d => d.status === 'active').length
        return { totalOwed, monthlyPayments, activeDebts, totalDebts: debts.length }
    }

    // Overall stats
    const totalCreditors = creditors.length
    const totalOwedAll = Object.values(linkedDebts).flat().reduce((sum, d) => sum + d.remaining_balance, 0)

    return (
        <div className="flex flex-col gap-8 max-w-7xl mx-auto pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter mb-2">Creditors</h1>
                    <p className="text-muted-foreground font-medium text-lg">Manage your lenders, suppliers, and contacts.</p>
                </div>
                <Button
                    onClick={() => setIsModalOpen(true)}
                    className="h-10 px-5 gap-2 bg-foreground text-background font-bold hover:opacity-90 transition-opacity"
                >
                    <Plus className="h-4 w-4" /> Add Creditor
                </Button>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-none shadow-sm bg-slate-50 dark:bg-zinc-900/50">
                    <CardContent className="p-6">
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Total Creditors</p>
                        <p className="text-3xl font-black tracking-tight">{totalCreditors}</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-slate-50 dark:bg-zinc-900/50">
                    <CardContent className="p-6">
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Banks</p>
                        <p className="text-3xl font-black tracking-tight">{creditors.filter(c => c.type === 'bank').length}</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-slate-50 dark:bg-zinc-900/50">
                    <CardContent className="p-6">
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Suppliers</p>
                        <p className="text-3xl font-black tracking-tight">{creditors.filter(c => c.type === 'supplier').length}</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-slate-50 dark:bg-zinc-900/50">
                    <CardContent className="p-6">
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Family & Directors</p>
                        <p className="text-3xl font-black tracking-tight">{creditors.filter(c => c.type === 'family' || c.type === 'director').length}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Creditors List */}
            {isLoading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4 text-muted-foreground animate-pulse">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="text-sm font-medium">Loading creditors...</p>
                </div>
            ) : creditors.length === 0 ? (
                <div className="py-20 text-center space-y-4 border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-3xl bg-slate-50/50 dark:bg-zinc-900/20">
                    <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                        <Users className="h-8 w-8 text-slate-400" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold">No Creditors Yet</h3>
                        <p className="text-muted-foreground max-w-sm mx-auto mt-2">Add your first creditor to start organizing your debt contacts.</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {creditors.map(creditor => {
                        const isExpanded = expandedCreditorId === creditor.id
                        const totals = getCreditorTotals(creditor.id)
                        const typeInfo = creditorTypeLabels[creditor.type]

                        return (
                            <Card key={creditor.id} className={`group relative overflow-hidden transition-all duration-300 ${isExpanded ? 'ring-2 ring-amber-500/20 shadow-xl' : 'hover:shadow-md hover:border-amber-500/20'}`}>
                                {/* Type Color Strip */}
                                <div className={`absolute top-0 left-0 bottom-0 w-1 ${creditor.type === 'bank' ? 'bg-blue-500' :
                                        creditor.type === 'family' ? 'bg-pink-500' :
                                            creditor.type === 'investor' ? 'bg-purple-500' :
                                                creditor.type === 'director' ? 'bg-amber-500' :
                                                    creditor.type === 'supplier' ? 'bg-emerald-500' :
                                                        'bg-slate-400'
                                    }`}></div>

                                <div onClick={() => handleExpandCreditor(creditor)} className="cursor-pointer">
                                    <div className="p-5 pl-7 grid md:grid-cols-[2fr,1fr,auto] gap-6 items-center">
                                        {/* Identity */}
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-zinc-800 flex items-center justify-center border border-slate-200 dark:border-zinc-700">
                                                <Building2 className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-lg leading-none">{creditor.name}</h3>
                                                    <Badge className={typeInfo.color}>{typeInfo.label}</Badge>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                    {creditor.contact_email && (
                                                        <span className="flex items-center gap-1">
                                                            <Mail className="h-3 w-3" /> {creditor.contact_email}
                                                        </span>
                                                    )}
                                                    {creditor.contact_phone && (
                                                        <span className="flex items-center gap-1">
                                                            <Phone className="h-3 w-3" /> {creditor.contact_phone}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Quick Stats */}
                                        <div className="flex items-center gap-6">
                                            {linkedDebts[creditor.id] && (
                                                <>
                                                    <div>
                                                        <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider mb-0.5">Total Owed</p>
                                                        <p className="text-lg font-bold tabular-nums">£{totals.totalOwed.toLocaleString()}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider mb-0.5">Debts</p>
                                                        <p className="text-lg font-bold">{totals.totalDebts}</p>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* Actions & Chevron */}
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => { e.stopPropagation(); handleEditCreditor(creditor) }}
                                                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => { e.stopPropagation(); handleDeleteCreditor(creditor.id) }}
                                                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                            <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div className="border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30 p-5 pl-7 animate-in slide-in-from-top-2 duration-200">
                                        <div className="grid lg:grid-cols-[1fr,300px] gap-8">
                                            {/* Left: Linked Debts */}
                                            <div>
                                                <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                                                    <CreditCard className="h-3.5 w-3.5" /> Linked Debts
                                                </h4>
                                                {!linkedDebts[creditor.id] || linkedDebts[creditor.id].length === 0 ? (
                                                    <div className="text-sm text-muted-foreground italic bg-white dark:bg-zinc-950/50 p-4 rounded-lg border border-slate-100 dark:border-zinc-800 border-dashed">
                                                        No debts linked to this creditor yet.
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {linkedDebts[creditor.id].map(debt => (
                                                            <div key={debt.id} className="flex justify-between items-center p-3 bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 rounded-lg shadow-sm">
                                                                <div className="flex items-center gap-3">
                                                                    <CreditCard className="h-4 w-4 text-amber-500" />
                                                                    <div>
                                                                        <p className="font-medium text-sm">{debt.name || debt.creditor_name}</p>
                                                                        <p className="text-xs text-muted-foreground">£{debt.monthly_payment?.toFixed(2) || '0'}/mo</p>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="font-bold tabular-nums">£{debt.remaining_balance.toLocaleString()}</p>
                                                                    <Badge variant="secondary" className={`text-[10px] ${debt.status === 'active' ? 'bg-emerald-500/10 text-emerald-600' :
                                                                            debt.status === 'paused' ? 'bg-amber-500/10 text-amber-600' :
                                                                                'bg-slate-500/10 text-slate-600'
                                                                        }`}>
                                                                        {debt.status}
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Right: Contact & Notes */}
                                            <div className="space-y-6">
                                                <div>
                                                    <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                                                        <FileText className="h-3.5 w-3.5" /> Notes
                                                    </h4>
                                                    <div className="bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 rounded-xl p-4">
                                                        {creditor.notes ? (
                                                            <p className="text-sm whitespace-pre-wrap">{creditor.notes}</p>
                                                        ) : (
                                                            <p className="text-sm text-muted-foreground italic">No notes added.</p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Summary Card */}
                                                <div className="bg-slate-100 dark:bg-zinc-800/50 rounded-xl p-4 space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs font-bold uppercase text-muted-foreground">Total Owed</span>
                                                        <span className="font-bold text-lg">£{totals.totalOwed.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs font-bold uppercase text-muted-foreground">Monthly Payments</span>
                                                        <span className="font-bold text-rose-600">£{totals.monthlyPayments.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs font-bold uppercase text-muted-foreground">Active Debts</span>
                                                        <span className="font-bold">{totals.activeDebts} of {totals.totalDebts}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </Card>
                        )
                    })}
                </div>
            )}

            {/* Add/Edit Creditor Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-black">{editingCreditorId ? 'Edit Creditor' : 'New Creditor'}</h2>
                                <p className="text-sm text-muted-foreground font-medium">{editingCreditorId ? 'Update creditor details' : 'Add a new lender or contact'}</p>
                            </div>
                            <button onClick={() => { setIsModalOpen(false); resetForm() }} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-900 rounded-full transition-colors text-muted-foreground hover:text-foreground">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6 overflow-y-auto">
                            {/* Name & Type */}
                            <div className="grid gap-4">
                                <div className="grid gap-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Creditor Name *</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="e.g. Bank of Scotland"
                                        className="h-11 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 outline-none transition-all"
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Type</label>
                                    <div className="relative">
                                        <select
                                            value={type}
                                            onChange={(e) => setType(e.target.value as CreditorType)}
                                            className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 font-medium appearance-none focus:ring-2 focus:ring-amber-500/20 outline-none"
                                        >
                                            <option value="bank">Bank</option>
                                            <option value="family">Family</option>
                                            <option value="investor">Investor</option>
                                            <option value="director">Director</option>
                                            <option value="supplier">Supplier</option>
                                            <option value="other">Other</option>
                                        </select>
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            <div className="h-px bg-slate-100 dark:bg-zinc-800" />

                            {/* Contact Info */}
                            <div className="grid gap-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Email</label>
                                        <div className="relative">
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <input
                                                type="email"
                                                value={contactEmail}
                                                onChange={(e) => setContactEmail(e.target.value)}
                                                placeholder="contact@bank.com"
                                                className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 font-medium focus:ring-2 focus:ring-amber-500/20 outline-none text-sm"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid gap-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Phone</label>
                                        <div className="relative">
                                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <input
                                                type="tel"
                                                value={contactPhone}
                                                onChange={(e) => setContactPhone(e.target.value)}
                                                placeholder="0800 123 456"
                                                className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 font-medium focus:ring-2 focus:ring-amber-500/20 outline-none text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Notes</label>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Account numbers, terms, or other notes..."
                                        rows={3}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-sm font-medium focus:ring-2 focus:ring-amber-500/20 outline-none resize-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 flex gap-3">
                            <Button variant="outline" onClick={() => { setIsModalOpen(false); resetForm() }} className="flex-1 h-11 font-bold">Cancel</Button>
                            <Button
                                onClick={editingCreditorId ? handleUpdateCreditor : handleAddCreditor}
                                disabled={!name || isSaving}
                                className="flex-1 h-11 bg-amber-500 hover:bg-amber-600 text-white font-bold"
                            >
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingCreditorId ? "Update Creditor" : "Add Creditor")}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
