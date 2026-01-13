"use client"

import * as React from "react"
import { Plus, CreditCard, ShieldCheck, Loader2, X, ChevronDown, ChevronRight, Users, Settings, MessageSquare, Calendar, Building2, Banknote, CircleDot, CheckCircle2, PauseCircle, MoreHorizontal, Trash2, Receipt, Target, TrendingUp, AlertCircle, Pencil, Landmark, Bold, Italic, List, Quote, Undo, Redo } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type ViewMode = 'all' | 'by-creditor'
type DebtStatus = 'active' | 'paused' | 'paid_off'

interface Creditor {
    id: string
    name: string
    type: string
    contact_email?: string
    contact_phone?: string
    notes?: string
}

interface DebtType {
    id: string
    name: string
    color: string
}

interface Debt {
    id: string
    name?: string
    creditor_name: string
    original_balance: number
    remaining_balance: number
    monthly_payment: number
    creditor_id?: string
    debt_type_id?: string
    status: DebtStatus
    start_date?: string
    target_payoff_date?: string
    notes?: string
    creditors?: Creditor
    debt_types?: DebtType
}

interface ActivityLog {
    id: string
    activity_type: string
    message: string
    created_at: string
    metadata?: any
}

interface LinkedTransaction {
    id: string
    transaction_date: string
    description: string
    amount: number
}

export default function DebtsPage() {
    const [debts, setDebts] = React.useState<Debt[]>([])
    const [creditors, setCreditors] = React.useState<Creditor[]>([])
    const [debtTypes, setDebtTypes] = React.useState<DebtType[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const [viewMode, setViewMode] = React.useState<ViewMode>('all')

    // Modal states
    const [isModalOpen, setIsModalOpen] = React.useState(false)
    const [isTypesModalOpen, setIsTypesModalOpen] = React.useState(false)
    const [isSaving, setIsSaving] = React.useState(false)
    const [editingDebtId, setEditingDebtId] = React.useState<string | null>(null)
    const [isEditMode, setIsEditMode] = React.useState(false)

    // Form state
    const [debtName, setDebtName] = React.useState("")
    const [creditorName, setCreditorName] = React.useState("")
    const [selectedCreditorId, setSelectedCreditorId] = React.useState<string | null>(null)
    const [selectedDebtTypeId, setSelectedDebtTypeId] = React.useState<string | null>(null)
    const [originalBalance, setOriginalBalance] = React.useState("")
    const [remainingBalance, setRemainingBalance] = React.useState("")
    const [monthlyPayment, setMonthlyPayment] = React.useState("")
    const [debtNotes, setDebtNotes] = React.useState("")
    const [startDate, setStartDate] = React.useState("")
    const [targetPayoffDate, setTargetPayoffDate] = React.useState("")

    // Debt Type form
    const [newTypeName, setNewTypeName] = React.useState("")

    // Activity log and linked transactions for expanded debt
    const [activityLog, setActivityLog] = React.useState<ActivityLog[]>([])
    const [linkedTransactions, setLinkedTransactions] = React.useState<LinkedTransaction[]>([])
    const [newNote, setNewNote] = React.useState("")
    const [isAddingNote, setIsAddingNote] = React.useState(false)

    const supabase = createClient()

    const fetchData = React.useCallback(async () => {
        setIsLoading(true)
        const [debtsRes, creditorsRes, typesRes] = await Promise.all([
            supabase.from('debts').select('*, creditors(*), debt_types(*)'),
            supabase.from('creditors').select('*'),
            supabase.from('debt_types').select('*').order('sort_order')
        ])

        if (debtsRes.data) setDebts(debtsRes.data)
        if (creditorsRes.data) setCreditors(creditorsRes.data)
        if (typesRes.data) setDebtTypes(typesRes.data)
        setIsLoading(false)
    }, [supabase])

    React.useEffect(() => {
        fetchData()
    }, [fetchData])

    const fetchDebtDetails = async (debtId: string) => {
        const [activityRes, txRes] = await Promise.all([
            supabase.from('debt_activity_log').select('*').eq('debt_id', debtId).order('created_at', { ascending: false }),
            supabase.from('transactions').select('id, transaction_date, description, amount').eq('debt_id', debtId)
        ])

        if (activityRes.data) setActivityLog(activityRes.data)
        if (txRes.data) setLinkedTransactions(txRes.data)
    }



    const handleAddLiability = async () => {
        if (!debtName || !creditorName || !originalBalance) return

        setIsSaving(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Create creditor if new
            let finalCreditorId = selectedCreditorId
            if (!selectedCreditorId && creditorName) {
                // First, check if creditor already exists
                const { data: existingCreditor } = await supabase
                    .from('creditors')
                    .select('id')
                    .eq('name', creditorName)
                    .eq('user_id', user.id)
                    .single()

                if (existingCreditor) {
                    finalCreditorId = existingCreditor.id
                } else {
                    // Create new creditor with required type field
                    const { data: newCreditor, error: creditorError } = await supabase
                        .from('creditors')
                        .insert({
                            name: creditorName,
                            user_id: user.id,
                            type: 'other'  // Default type
                        })
                        .select('id')
                        .single()

                    if (creditorError) {
                        console.error('Creditor insert error:', creditorError.message || creditorError)
                    } else if (newCreditor) {
                        finalCreditorId = newCreditor.id
                    }
                }
            }

            const { error } = await supabase.from('debts').insert({
                name: debtName || null,
                creditor_name: creditorName,
                original_balance: parseFloat(originalBalance),
                remaining_balance: parseFloat(remainingBalance || originalBalance),
                monthly_payment: parseFloat(monthlyPayment || "0"),
                user_id: user.id,
                creditor_id: finalCreditorId,
                debt_type_id: selectedDebtTypeId,
                notes: debtNotes || null,
                start_date: startDate || null,
                target_payoff_date: targetPayoffDate || null,
                status: 'active'
            })

            if (!error) {
                // Log activity
                const { data: newDebt } = await supabase.from('debts').select('id').eq('creditor_name', creditorName).order('created_at', { ascending: false }).limit(1).single()
                if (newDebt) {
                    await supabase.from('debt_activity_log').insert({
                        debt_id: newDebt.id,
                        user_id: user.id,
                        activity_type: 'system',
                        message: `Debt created with £${parseFloat(originalBalance).toLocaleString()} balance`
                    })
                }

                resetForm()
                setIsModalOpen(false)
                fetchData()
            }
        } finally {
            setIsSaving(false)
        }
    }

    const handleAddDebtType = async () => {
        if (!newTypeName.trim()) return
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        await supabase.from('debt_types').insert({
            name: newTypeName.trim(),
            user_id: user.id,
            sort_order: debtTypes.length
        })
        setNewTypeName("")
        fetchData()
    }

    const handleDeleteDebtType = async (typeId: string) => {
        await supabase.from('debt_types').delete().eq('id', typeId)
        fetchData()
    }

    const handleUpdateStatus = async (debtId: string, newStatus: DebtStatus) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        await supabase.from('debts').update({ status: newStatus }).eq('id', debtId)
        await supabase.from('debt_activity_log').insert({
            debt_id: debtId,
            user_id: user.id,
            activity_type: 'status_change',
            message: `Status changed to ${newStatus.replace('_', ' ')}`
        })
        fetchData()
        if (editingDebtId === debtId) fetchDebtDetails(debtId)
    }

    const handleAddNote = async () => {
        const targetId = editingDebtId
        if (!newNote.trim() || !targetId) return
        setIsAddingNote(true)

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        await supabase.from('debt_activity_log').insert({
            debt_id: targetId,
            user_id: user.id,
            activity_type: 'manual',
            message: newNote.trim()
        })

        setNewNote("")
        setIsAddingNote(false)
        fetchDebtDetails(targetId)
    }

    const resetForm = () => {
        setDebtName("")
        setCreditorName("")
        setSelectedCreditorId(null)
        setSelectedDebtTypeId(null)
        setOriginalBalance("")
        setRemainingBalance("")
        setMonthlyPayment("")
        setDebtNotes("")
        setStartDate("")
        setTargetPayoffDate("")
        setEditingDebtId(null)
    }

    const handleEditDebt = (debt: Debt) => {
        setEditingDebtId(debt.id)
        setDebtName(debt.name || "")
        setCreditorName(debt.creditor_name)
        setSelectedCreditorId(debt.creditor_id || null)
        setSelectedDebtTypeId(debt.debt_type_id || null)
        setOriginalBalance(debt.original_balance.toString())
        setRemainingBalance(debt.remaining_balance.toString())
        setMonthlyPayment((debt.monthly_payment || 0).toString())
        setDebtNotes(debt.notes || "")
        setStartDate(debt.start_date || "")
        setTargetPayoffDate(debt.target_payoff_date || "")

        // Fetch details immediately
        fetchDebtDetails(debt.id)

        setIsEditMode(false) // Start in "View Details" mode
        setIsModalOpen(true)
    }

    const handleUpdateDebt = async () => {
        if (!debtName || !creditorName || !originalBalance || !editingDebtId) return

        setIsSaving(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Create or find creditor
            let finalCreditorId = selectedCreditorId
            if (!selectedCreditorId && creditorName) {
                // Check if creditor already exists
                const { data: existingCreditor } = await supabase
                    .from('creditors')
                    .select('id')
                    .eq('name', creditorName)
                    .eq('user_id', user.id)
                    .single()

                if (existingCreditor) {
                    finalCreditorId = existingCreditor.id
                } else {
                    // Create new creditor
                    const { data: newCreditor, error: creditorError } = await supabase
                        .from('creditors')
                        .insert({ name: creditorName, user_id: user.id, type: 'other' })
                        .select('id')
                        .single()

                    if (!creditorError && newCreditor) {
                        finalCreditorId = newCreditor.id
                    }
                }
            }

            const { error } = await supabase.from('debts').update({
                name: debtName || null,
                creditor_name: creditorName,
                original_balance: parseFloat(originalBalance),
                remaining_balance: parseFloat(remainingBalance || originalBalance),
                monthly_payment: parseFloat(monthlyPayment || "0"),
                creditor_id: finalCreditorId,
                debt_type_id: selectedDebtTypeId,
                notes: debtNotes || null,
                start_date: startDate || null,
                target_payoff_date: targetPayoffDate || null
            }).eq('id', editingDebtId)

            if (!error) {
                // Log activity
                await supabase.from('debt_activity_log').insert({
                    debt_id: editingDebtId,
                    user_id: user.id,
                    activity_type: 'system',
                    message: 'Debt details updated'
                })

                resetForm()
                setIsModalOpen(false)
                fetchData()
                if (editingDebtId) {
                    fetchDebtDetails(editingDebtId)
                }
            }
        } finally {
            setIsSaving(false)
        }
    }

    const calculatedDuration = (startDate?: string) => {
        if (!startDate) return 'Unknown'
        const start = new Date(startDate)
        const now = new Date()
        const diffYears = now.getFullYear() - start.getFullYear()
        const diffMonths = now.getMonth() - start.getMonth()

        let years = diffYears
        let months = diffMonths
        if (months < 0) {
            years--
            months += 12
        }

        if (years > 0 && months > 0) return `${years}y ${months}m`
        if (years > 0) return `${years} yrs`
        return `${months} mos`
    }

    const renderDebtCard = (debt: Debt) => {
        const progress = debt.original_balance > 0 ? ((debt.original_balance - debt.remaining_balance) / debt.original_balance) * 100 : 0
        const isPaidOff = debt.status === 'paid_off'

        return (
            <Card key={debt.id} className="group relative bg-zinc-950 border-zinc-900 overflow-hidden hover:shadow-md hover:border-zinc-800 transition-all duration-300">
                <div onClick={() => handleEditDebt(debt)} className="cursor-pointer">
                    <div className="p-6">
                        {/* Header: Creditor & Balance */}
                        <div className="flex justify-between items-start mb-1">
                            <span className="text-[11px] font-bold tracking-widest text-zinc-500 uppercase">
                                {debt.creditor_name}
                            </span>
                            <div className="text-right">
                                <p className="text-lg font-bold text-white tabular-nums tracking-tight">£{debt.remaining_balance.toLocaleString()}</p>
                                <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider">Remaining</p>
                            </div>
                        </div>

                        {/* Debt Name */}
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-white tracking-tight">{debt.name || debt.creditor_name}</h3>
                            <button className="text-zinc-500 hover:text-white transition-colors">
                                <Pencil className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-6 space-y-1.5">
                            <div className="flex justify-between text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                                <span>Repayment Progress</span>
                                <span className={cn(isPaidOff ? "text-emerald-500" : (progress > 50 ? "text-emerald-500" : "text-zinc-400"))}>
                                    {isPaidOff ? "100" : progress.toFixed(0)}%
                                </span>
                            </div>
                            <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                                <div
                                    className={cn("h-full transition-all duration-1000", isPaidOff ? "bg-emerald-500" : "bg-emerald-500/80")}
                                    style={{ width: `${isPaidOff ? 100 : Math.max(progress, 2)}%` }}
                                ></div>
                            </div>
                        </div>

                        {/* Footer Details */}
                        <div className="flex items-center justify-between border-t border-zinc-900 pt-4">
                            <div>
                                <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider mb-0.5">Original Loan</p>
                                <p className="text-xs font-bold text-zinc-300">£{debt.original_balance.toLocaleString()}</p>
                            </div>

                            <div className="text-center">
                                <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider mb-0.5">Monthly</p>
                                <p className="text-xs font-bold text-white">£{debt.monthly_payment.toLocaleString()}</p>
                            </div>

                            <div className="text-right">
                                <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider mb-0.5">Status</p>
                                <span className={cn(
                                    "text-[10px] font-bold uppercase tracking-widest",
                                    debt.status === 'active' ? "text-emerald-500" :
                                        debt.status === 'paused' ? "text-amber-500" : "text-zinc-500"
                                )}>
                                    {debt.status}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>
        )
    }

    return (
        <div className="flex flex-col lg:flex-row gap-8 max-w-[1600px] mx-auto pb-20 min-h-screen">
            {/* Left Content Area */}
            <div className="flex-1 space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Active Debts</h1>
                    <p className="text-zinc-500 font-medium">Manage your debt portfolio and repayment tracking.</p>
                </div>

                <div>
                    <div className="flex justify-between items-end mb-4 px-1">
                        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Current Liabilities</h2>
                        <span className="text-xs font-medium text-zinc-600">{debts.filter(d => d.status === 'active').length} Active Debts</span>
                    </div>

                    {isLoading ? (
                        <div className="py-20 flex justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
                        </div>
                    ) : debts.length === 0 ? (
                        <div className="p-12 border-2 border-dashed border-zinc-900 rounded-3xl text-center">
                            <p className="text-zinc-500">No debts found. Add your first liability.</p>
                        </div>
                    ) : (() => {
                        // Group debts by creditor
                        const groupedByCreditor = debts.reduce((acc, debt) => {
                            const key = debt.creditor_name || 'Unknown Creditor'
                            if (!acc[key]) {
                                acc[key] = {
                                    creditorName: key,
                                    debts: [],
                                    totalRemaining: 0,
                                    totalOriginal: 0
                                }
                            }
                            acc[key].debts.push(debt)
                            acc[key].totalRemaining += debt.remaining_balance
                            acc[key].totalOriginal += debt.original_balance
                            return acc
                        }, {} as Record<string, { creditorName: string; debts: Debt[]; totalRemaining: number; totalOriginal: number }>)

                        const creditorGroups = Object.values(groupedByCreditor)

                        return (
                            <div className="space-y-4">
                                {creditorGroups.map((group) => (
                                    <Card key={group.creditorName} className="bg-zinc-950 border-zinc-900 overflow-hidden">
                                        {/* Creditor Header */}
                                        <div className="p-5 border-b border-zinc-900">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h3 className="text-lg font-bold text-white tracking-tight">{group.creditorName}</h3>
                                                    <span className="text-xs font-medium text-zinc-600">{group.debts.length} debt{group.debts.length !== 1 ? 's' : ''}</span>
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    <div className="text-right">
                                                        <p className="text-sm font-bold text-zinc-500 tabular-nums">£{group.totalOriginal.toLocaleString()}</p>
                                                        <p className="text-[9px] font-bold text-zinc-700 uppercase tracking-wider">Original</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xl font-bold text-white tabular-nums">£{group.totalRemaining.toLocaleString()}</p>
                                                        <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Remaining</p>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Overall Progress Bar */}
                                            {(() => {
                                                const overallProgress = group.totalOriginal > 0
                                                    ? ((group.totalOriginal - group.totalRemaining) / group.totalOriginal) * 100
                                                    : 0
                                                return (
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between text-[10px] uppercase font-bold tracking-wider text-zinc-600">
                                                            <span>Overall Repayment</span>
                                                            <span className={cn(overallProgress >= 100 ? "text-emerald-500" : overallProgress > 50 ? "text-emerald-500/80" : "text-zinc-500")}>
                                                                {overallProgress.toFixed(0)}%
                                                            </span>
                                                        </div>
                                                        <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                                                            <div
                                                                className={cn("h-full transition-all duration-500", overallProgress >= 100 ? "bg-emerald-500" : "bg-emerald-500/60")}
                                                                style={{ width: `${Math.min(Math.max(overallProgress, 0), 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                )
                                            })()}
                                        </div>

                                        {/* Debt Rows */}
                                        <div className="divide-y divide-zinc-900/50">
                                            {group.debts.map((debt) => {
                                                const progress = debt.original_balance > 0 ? ((debt.original_balance - debt.remaining_balance) / debt.original_balance) * 100 : 0
                                                return (
                                                    <div
                                                        key={debt.id}
                                                        onClick={() => handleEditDebt(debt)}
                                                        className="flex items-center justify-between px-5 py-4 hover:bg-zinc-900/50 cursor-pointer transition-colors group"
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-semibold text-white truncate">{debt.name || 'Unnamed Debt'}</span>
                                                                {debt.debt_types && (
                                                                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                                                                        {debt.debt_types.name}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-3 mt-1">
                                                                <span className="text-xs text-zinc-500">£{debt.monthly_payment}/mo</span>
                                                                <div className="flex-1 max-w-[100px] h-1 bg-zinc-800 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={cn("h-full", debt.status === 'paid_off' ? "bg-emerald-500" : "bg-emerald-500/60")}
                                                                        style={{ width: `${Math.max(progress, 2)}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-[10px] text-zinc-600">{progress.toFixed(0)}%</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-4 ml-4">
                                                            <div className="text-right">
                                                                <p className="font-bold text-white tabular-nums">£{debt.remaining_balance.toLocaleString()}</p>
                                                                <p className="text-[9px] text-zinc-600 uppercase tracking-wider">remaining</p>
                                                            </div>
                                                            <span className={cn(
                                                                "w-2 h-2 rounded-full",
                                                                debt.status === 'active' ? "bg-emerald-500" :
                                                                    debt.status === 'paused' ? "bg-amber-500" : "bg-zinc-600"
                                                            )} />
                                                            <ChevronRight className="h-4 w-4 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )
                    })()}
                </div>
            </div>

            {/* Right Sidebar */}
            <div className="w-full lg:w-[360px] space-y-6 lg:pt-8">
                {/* Total Debt Card */}
                <Card className="bg-white text-black border-none p-6 relative overflow-hidden">
                    <div className="flex justify-between items-start mb-4">
                        <div className="h-8 w-8 rounded-full border border-black/10 flex items-center justify-center">
                            <Target className="h-4 w-4" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-black/40">Total Debt</span>
                    </div>
                    <div>
                        <h3 className="text-4xl font-black tracking-tighter mb-1">£{debts.reduce((sum, d) => sum + d.remaining_balance, 0).toLocaleString()}</h3>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">Aggregate Balance</p>
                    </div>
                </Card>

                {/* Monthly Service Card */}
                <Card className="bg-zinc-950 border-zinc-900 p-6 relative">
                    <div className="flex justify-between items-start mb-6">
                        <div className="h-8 w-8 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400">
                            <Calendar className="h-4 w-4" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Monthly Service</span>
                    </div>
                    <div>
                        <h3 className="text-3xl font-bold text-white tracking-tight mb-1">£{debts.reduce((sum, d) => sum + (d.monthly_payment || 0), 0).toLocaleString()}</h3>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Combined Payments</p>
                    </div>
                </Card>

                {/* Quick Insights */}
                <Card className="bg-zinc-950 border-zinc-900 p-6">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-4">Quick Insights</p>
                    <div className="flex gap-4 items-start">
                        <TrendingUp className="h-5 w-5 text-emerald-500 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-white">Repayment Velocity</p>
                            <p className="text-xs text-zinc-500 leading-relaxed mt-1">
                                Your total debt has decreased by <span className="text-white font-bold">12%</span> this quarter based on your repayment schedule.
                            </p>
                        </div>
                    </div>
                </Card>

                <Button
                    onClick={() => setIsModalOpen(true)}
                    className="w-full h-12 bg-white text-black hover:bg-zinc-200 font-bold rounded-xl text-sm"
                >
                    <ShieldCheck className="mr-2 h-4 w-4" /> Register New Debt
                </Button>
            </div>



            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-2xl border border-zinc-900 flex flex-col max-h-[90vh]">

                        {/* VIEW MODE: Details & History */}
                        {!isEditMode && editingDebtId ? (
                            <div className="flex flex-col h-full overflow-hidden">
                                {/* Header */}
                                <div className="p-6 border-b border-zinc-900 flex items-start justify-between bg-zinc-950">
                                    <div>
                                        <h2 className="text-xl font-bold text-white">Edit Debt Details</h2>
                                        <p className="text-sm text-zinc-500 font-medium">Update the terms and balance of your liability.</p>
                                    </div>
                                    <button onClick={() => { setIsModalOpen(false); resetForm() }} className="p-2 hover:bg-zinc-900 rounded-full transition-colors text-zinc-500 hover:text-white">
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                                    {/* Action Bar */}
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Debt Narrative & History</span>
                                        <div className="flex gap-2">
                                            {/* Status Actions */}
                                            {debts.find(d => d.id === editingDebtId)?.status === 'active' ? (
                                                <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(editingDebtId!, 'paused')} title="Pause Debt" className="h-8 w-8 p-0 border-zinc-800 bg-zinc-900 text-amber-500 hover:text-amber-400 hover:bg-amber-950/20">
                                                    <PauseCircle className="h-3.5 w-3.5" />
                                                </Button>
                                            ) : (
                                                <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(editingDebtId!, 'active')} title="Activate Debt" className="h-8 w-8 p-0 border-zinc-800 bg-zinc-900 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-950/20">
                                                    <CircleDot className="h-3.5 w-3.5" />
                                                </Button>
                                            )}

                                            <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(editingDebtId!, 'paid_off')} title="Mark Paid" className="h-8 w-8 p-0 border-zinc-800 bg-zinc-900 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-950/20">
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                            </Button>

                                            <div className="w-px h-4 bg-zinc-800 mx-1 self-center"></div>

                                            <Button size="sm" variant="outline" onClick={() => setIsEditMode(true)} className="h-8 text-xs border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800">
                                                <Pencil className="h-3.5 w-3.5 mr-2" /> Edit Terms
                                            </Button>
                                            {/* <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-zinc-800 bg-zinc-900 text-rose-500 hover:text-rose-400 hover:bg-rose-950/20">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button> */}
                                        </div>
                                    </div>

                                    {/* Stats Grid */}
                                    <div className="grid md:grid-cols-2 gap-4">
                                        {/* Issue Terms */}
                                        <div className="bg-zinc-900/30 rounded-xl p-5 border border-zinc-900 space-y-4">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Issue Terms</p>

                                            <div className="flex justify-between items-center">
                                                <span className="text-lg font-bold text-white">£{parseFloat(originalBalance).toLocaleString()}</span>
                                                <span className="text-xs font-medium text-zinc-500">Initial Debt</span>
                                            </div>
                                            <div className="h-px bg-zinc-800/50"></div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-lg font-bold text-emerald-500">£{parseFloat(remainingBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                <span className="text-xs font-medium text-zinc-500">What's Left</span>
                                            </div>
                                            <div className="h-px bg-zinc-800/50"></div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-lg font-bold text-white">£{parseFloat(monthlyPayment).toLocaleString() || '0'}</span>
                                                <span className="text-xs font-medium text-zinc-500">Monthly</span>
                                            </div>
                                        </div>

                                        {/* Origination */}
                                        <div className="bg-zinc-900/30 rounded-xl p-5 border border-zinc-900 space-y-4">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Origination</p>

                                            <div className="flex justify-between items-start">
                                                <span className="text-sm font-bold text-white leading-tight max-w-[120px]">{creditorName}</span>
                                                <span className="text-xs font-medium text-zinc-500">Lender</span>
                                            </div>
                                            <div className="h-px bg-zinc-800/50"></div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-bold text-white">{startDate ? new Date(startDate).toLocaleDateString() : 'N/A'}</span>
                                                <span className="text-xs font-medium text-zinc-500">Date</span>
                                            </div>
                                            <div className="h-px bg-zinc-800/50"></div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-bold text-white">{startDate ? calculatedDuration(startDate) : '-'}</span>
                                                <span className="text-[10px] font-bold uppercase text-zinc-600">Debt Age</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Transaction History */}
                                    <div className="border border-emerald-900/30 bg-emerald-950/10 rounded-xl overflow-hidden">
                                        <div className="p-3 bg-emerald-950/20 flex justify-between items-center">
                                            <div className="flex items-center gap-2 text-emerald-500">
                                                <Landmark className="h-4 w-4" />
                                                <span className="text-[10px] font-bold uppercase tracking-widest">Transaction History</span>
                                            </div>
                                            <Badge variant="secondary" className="bg-emerald-900/40 text-emerald-400 text-[10px] h-5">{linkedTransactions.length} Records</Badge>
                                        </div>
                                        <div className="p-4">
                                            {linkedTransactions.length === 0 ? (
                                                <div className="border border-dashed border-emerald-900/30 rounded-lg p-6 text-center">
                                                    <p className="text-emerald-700 font-medium text-xs uppercase tracking-wider">No Transactions Linked</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                                    {linkedTransactions.map(tx => (
                                                        <div key={tx.id} className="flex justify-between items-center text-sm">
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-zinc-500 font-mono text-xs">{new Date(tx.transaction_date).toLocaleDateString()}</span>
                                                                <span className="text-zinc-300">{tx.description}</span>
                                                            </div>
                                                            <span className="text-emerald-500 font-bold">£{tx.amount.toFixed(2)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Audit Updates */}
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <MessageSquare className="h-4 w-4 text-white" />
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-white">Audit Updates</span>
                                            </div>
                                            <Badge variant="secondary" className="bg-zinc-800 text-zinc-400 text-[10px] h-5">{activityLog.length} Notes</Badge>
                                        </div>

                                        <div className="bg-zinc-900/50 border border-zinc-900 rounded-xl overflow-hidden mb-4">
                                            {/* Fake Toolbar */}
                                            <div className="flex items-center gap-1 p-2 border-b border-zinc-900 bg-zinc-900/30">
                                                <span className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded cursor-pointer"><Bold className="h-3.5 w-3.5" /></span>
                                                <span className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded cursor-pointer"><Italic className="h-3.5 w-3.5" /></span>
                                                <div className="h-4 w-px bg-zinc-800 mx-1"></div>
                                                <span className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded cursor-pointer"><List className="h-3.5 w-3.5" /></span>
                                                <span className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded cursor-pointer"><Quote className="h-3.5 w-3.5" /></span>
                                                <div className="flex-1"></div>
                                                <span className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded cursor-pointer"><Undo className="h-3.5 w-3.5" /></span>
                                                <span className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded cursor-pointer"><Redo className="h-3.5 w-3.5" /></span>
                                            </div>
                                            <textarea
                                                value={newNote}
                                                onChange={(e) => setNewNote(e.target.value)}
                                                placeholder="Write an update..."
                                                className="w-full h-24 bg-transparent p-4 text-sm text-white placeholder:text-zinc-700 outline-none resize-none"
                                            />
                                        </div>

                                        <div className="flex justify-end mb-8">
                                            <Button
                                                onClick={handleAddNote}
                                                disabled={isAddingNote || !newNote.trim()}
                                                className="bg-white text-black hover:bg-zinc-200 font-bold"
                                            >
                                                <Plus className="h-4 w-4 mr-2" /> Post Update
                                            </Button>
                                        </div>

                                        <div className="space-y-6 pl-4 border-l border-zinc-900">
                                            {activityLog.length === 0 ? (
                                                <p className="text-zinc-600 text-xs font-bold uppercase tracking-widest pl-2">No Updates Yet</p>
                                            ) : (
                                                activityLog.map(log => (
                                                    <div key={log.id} className="relative group">
                                                        <div className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-zinc-800 ring-4 ring-zinc-950 group-hover:bg-amber-500 transition-colors"></div>
                                                        <p className="text-zinc-300 text-sm leading-relaxed mb-1">{log.message}</p>
                                                        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">
                                                            {new Date(log.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                            {log.activity_type === 'system' && <span className="ml-2 text-zinc-700">• System</span>}
                                                        </p>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* EDIT/ADD FORM (Standard) */
                            <>
                                <div className="p-6 border-b border-zinc-900 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-xl font-bold text-white">{editingDebtId ? 'Edit Details' : 'New Liability'}</h2>
                                        <p className="text-sm text-zinc-500 font-medium">{editingDebtId ? 'Update loan terms and balance' : 'Record a new debt or loan'}</p>
                                    </div>
                                    <button onClick={() => { setIsModalOpen(false); resetForm() }} className="p-2 hover:bg-zinc-900 rounded-full transition-colors text-zinc-500 hover:text-white">
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>

                                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                                    {/* Form Fields from before... */}
                                    <div className="space-y-4">
                                        {/* ... inputs consistent with previous step ... */}
                                        <div className="grid gap-2">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Debt Name / Reference *</label>
                                            <input
                                                type="text"
                                                value={debtName}
                                                onChange={(e) => setDebtName(e.target.value)}
                                                placeholder="e.g. Business Insurance (24/25) INV 157"
                                                className="h-11 px-4 rounded-xl border border-zinc-900 bg-zinc-900/50 text-white font-medium focus:ring-2 focus:ring-amber-500/20 outline-none placeholder:text-zinc-700"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="grid gap-2">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Creditor *</label>
                                                <input
                                                    type="text"
                                                    value={creditorName}
                                                    onChange={(e) => setCreditorName(e.target.value)}
                                                    placeholder="e.g. Bank of Scotland"
                                                    className="h-11 px-4 rounded-xl border border-zinc-900 bg-zinc-900/50 text-white font-medium focus:ring-2 focus:ring-amber-500/20 outline-none placeholder:text-zinc-700"
                                                    list="creditors-list"
                                                />
                                                <datalist id="creditors-list">
                                                    {creditors.map(c => <option key={c.id} value={c.name} />)}
                                                </datalist>
                                            </div>

                                            <div className="grid gap-2">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Debt Type</label>
                                                <div className="relative">
                                                    <select
                                                        value={selectedDebtTypeId || ''}
                                                        onChange={(e) => setSelectedDebtTypeId(e.target.value || null)}
                                                        className="w-full h-11 px-4 rounded-xl border border-zinc-900 bg-zinc-900/50 text-white font-medium appearance-none focus:ring-2 focus:ring-amber-500/20 outline-none"
                                                    >
                                                        <option value="">Select Category...</option>
                                                        {debtTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                    </select>
                                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="h-px bg-zinc-900" />

                                    <div className="grid gap-6">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Original Total *</label>
                                                <div className="relative">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">£</span>
                                                    <input
                                                        type="number"
                                                        value={originalBalance}
                                                        onChange={(e) => setOriginalBalance(e.target.value)}
                                                        className="w-full h-11 pl-8 pr-4 rounded-xl border border-zinc-900 bg-zinc-900/50 text-white font-medium focus:ring-2 focus:ring-amber-500/20 outline-none"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Current Balance</label>
                                                <div className="relative">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">£</span>
                                                    <input
                                                        type="number"
                                                        value={remainingBalance}
                                                        onChange={(e) => setRemainingBalance(e.target.value)}
                                                        className="w-full h-11 pl-8 pr-4 rounded-xl border border-zinc-900 bg-zinc-900/50 text-white font-medium focus:ring-2 focus:ring-amber-500/20 outline-none"
                                                        placeholder="Defaults to Original"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Monthly Payment</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">£</span>
                                                <input
                                                    type="number"
                                                    value={monthlyPayment}
                                                    onChange={(e) => setMonthlyPayment(e.target.value)}
                                                    className="w-full h-11 pl-8 pr-4 rounded-xl border border-zinc-900 bg-zinc-900/50 text-white font-medium focus:ring-2 focus:ring-amber-500/20 outline-none"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="h-px bg-zinc-900" />

                                    <div className="grid gap-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Start Date</label>
                                                <input
                                                    type="date"
                                                    value={startDate}
                                                    onChange={(e) => setStartDate(e.target.value)}
                                                    className="w-full h-11 px-4 rounded-lg border border-zinc-900 bg-zinc-900/50 text-white font-medium text-sm focus:ring-2 focus:ring-amber-500/20 outline-none"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Target Payoff</label>
                                                <input
                                                    type="date"
                                                    value={targetPayoffDate}
                                                    onChange={(e) => setTargetPayoffDate(e.target.value)}
                                                    className="w-full h-11 px-4 rounded-lg border border-zinc-900 bg-zinc-900/50 text-white font-medium text-sm focus:ring-2 focus:ring-amber-500/20 outline-none"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Notes (Visible in Audit Log)</label>
                                            <textarea
                                                value={debtNotes}
                                                onChange={(e) => setDebtNotes(e.target.value)}
                                                placeholder="Terms, contact details, or other notes..."
                                                rows={3}
                                                className="w-full px-4 py-3 rounded-xl border border-zinc-900 bg-zinc-900/50 text-white text-sm font-medium focus:ring-2 focus:ring-amber-500/20 outline-none resize-none placeholder:text-zinc-700"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 border-t border-zinc-900 bg-zinc-900/50 flex gap-3">
                                    <Button variant="outline" onClick={() => { isEditMode && editingDebtId ? setIsEditMode(false) : setIsModalOpen(false); resetForm() }} className="flex-1 h-11 font-bold border-zinc-800 bg-transparent text-zinc-300 hover:bg-zinc-900 hover:text-white">Cancel</Button>
                                    <Button
                                        onClick={editingDebtId ? handleUpdateDebt : handleAddLiability}
                                        disabled={!debtName || !creditorName || !originalBalance || isSaving}
                                        className="flex-1 h-11 bg-amber-500 hover:bg-amber-600 text-white font-bold border-none"
                                    >
                                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingDebtId ? "Save Changes" : "Register Debt")}
                                    </Button>
                                </div>
                            </>
                        )}

                    </div>
                </div>
            )}


            {/* Types Modal */}
            {isTypesModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-zinc-900">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white">Debt Categories</h2>
                            <button onClick={() => setIsTypesModalOpen(false)} className="p-2 hover:bg-zinc-900 rounded-lg transition-colors text-zinc-500 hover:text-white">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="flex gap-2 mb-6">
                            <input
                                type="text"
                                value={newTypeName}
                                onChange={(e) => setNewTypeName(e.target.value)}
                                placeholder="New category name..."
                                className="flex-1 h-11 px-4 rounded-xl border border-zinc-900 bg-zinc-900/50 text-white text-sm font-medium focus:ring-2 focus:ring-amber-500/20 outline-none"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddDebtType()}
                            />
                            <Button onClick={handleAddDebtType} disabled={!newTypeName.trim()} className="h-11 w-11 p-0 rounded-xl bg-amber-500 hover:bg-amber-600 text-white">
                                <Plus className="h-5 w-5" />
                            </Button>
                        </div>
                        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                            {debtTypes.map(type => (
                                <div key={type.id} className="flex items-center justify-between p-3 bg-zinc-900 rounded-xl border border-zinc-800">
                                    <span className="font-bold text-sm text-zinc-300">{type.name}</span>
                                    <button
                                        onClick={() => handleDeleteDebtType(type.id)}
                                        className="p-2 text-rose-500 hover:bg-rose-950/20 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                            {debtTypes.length === 0 && (
                                <div className="py-8 text-center text-zinc-600 border-2 border-dashed border-zinc-800 rounded-xl">
                                    <p className="text-sm">No custom types added yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
