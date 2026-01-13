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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { updateTransactionDetails, getAICategorySuggestion, createCategory, getFinancialClasses, linkTransactionToPayable, getPayablesForLinking } from "@/lib/actions/transactions"
import { createRule, RuleCondition } from "@/lib/actions/rules"
import { getVendors, createVendor, assignVendorBulk } from "@/lib/actions/vendors"
import { getStaff, createStaff, StaffRole } from "@/lib/actions/staff"
import { Loader2, Info, Receipt, MessageSquare, User, Sparkles, Plus, X, ChevronRight, Wand2, Building2, Search, Store, Users, Check, Copy, CreditCard, Package, FileText } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface ReconciliationModalProps {
    transaction: any
    categories: any[]
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    onUpdate: () => void
}

export function ReconciliationModal({
    transaction,
    categories,
    isOpen,
    onOpenChange,
    onUpdate
}: ReconciliationModalProps) {
    const [isSaving, setIsSaving] = React.useState(false)
    const [vendorName, setVendorName] = React.useState(transaction?.vendors?.name || "")
    const [notes, setNotes] = React.useState(transaction?.notes || "")
    const [categoryId, setCategoryId] = React.useState(transaction?.category_id || null)
    const [isAISuggesting, setIsAISuggesting] = React.useState(false)
    const [aiSuggestion, setAiSuggestion] = React.useState<string | null>(null)

    // Category Creation State
    const [isAddingCategory, setIsAddingCategory] = React.useState(false)
    const [newCategoryName, setNewCategoryName] = React.useState("")
    const [newCategoryParentId, setNewCategoryParentId] = React.useState<string>("")
    const [isCreatingCategory, setIsCreatingCategory] = React.useState(false)
    const [justCreatedParentId, setJustCreatedParentId] = React.useState<string | null>(null)
    const [showSubcategoryForm, setShowSubcategoryForm] = React.useState(false)
    const [newCategoryClassId, setNewCategoryClassId] = React.useState<string>("")
    const [classes, setClasses] = React.useState<any[]>([])
    const [isLoadingClasses, setIsLoadingClasses] = React.useState(false)
    const [categorySearch, setCategorySearch] = React.useState('')

    // Rule Creation State
    const [shouldCreateRule, setShouldCreateRule] = React.useState(false)
    const [useDynamicBuilder, setUseDynamicBuilder] = React.useState(true)
    const [ruleConditions, setRuleConditions] = React.useState<RuleCondition[]>([])
    const [ruleDescriptionPattern, setRuleDescriptionPattern] = React.useState('')
    const [ruleAmountMin, setRuleAmountMin] = React.useState<string>('')
    const [ruleAmountMax, setRuleAmountMax] = React.useState<string>('')
    const [ruleNotesTemplate, setRuleNotesTemplate] = React.useState('')
    const [ruleRequiresApproval, setRuleRequiresApproval] = React.useState(true)

    // Vendor State
    const [vendors, setVendors] = React.useState<any[]>([])
    const [vendorId, setVendorId] = React.useState<string | null>(transaction?.vendor_id || null)
    const [isAddingVendor, setIsAddingVendor] = React.useState(false)
    const [newVendorName, setNewVendorName] = React.useState("")
    const [isCreatingVendor, setIsCreatingVendor] = React.useState(false)
    const [applyVendorBulk, setApplyVendorBulk] = React.useState(false)
    const [vendorSearch, setVendorSearch] = React.useState('')
    const [vendorDropdownOpen, setVendorDropdownOpen] = React.useState(false)

    // Staff State
    const [payeeType, setPayeeType] = React.useState<'vendor' | 'staff'>('vendor')
    const [staffList, setStaffList] = React.useState<any[]>([])
    const [staffId, setStaffId] = React.useState<string | null>(transaction?.staff_id || null)
    const [isAddingStaff, setIsAddingStaff] = React.useState(false)
    const [newStaffName, setNewStaffName] = React.useState("")
    const [newStaffRole, setNewStaffRole] = React.useState<StaffRole>('staff')
    const [isCreatingStaff, setIsCreatingStaff] = React.useState(false)
    const [staffSearch, setStaffSearch] = React.useState('')
    const [staffDropdownOpen, setStaffDropdownOpen] = React.useState(false)

    // Debt Linking State
    const [debts, setDebts] = React.useState<any[]>([])
    const [debtId, setDebtId] = React.useState<string | null>(null)
    const [debtDropdownOpen, setDebtDropdownOpen] = React.useState(false)
    const [isCreatingDebtFromTx, setIsCreatingDebtFromTx] = React.useState(false)
    const [newDebtCreditor, setNewDebtCreditor] = React.useState('')
    const [newDebtMonthlyPayment, setNewDebtMonthlyPayment] = React.useState('')
    const [updateDebtBalance, setUpdateDebtBalance] = React.useState(true)

    // Asset Linking State (for expense transactions - to create assets from purchases)
    const [assets, setAssets] = React.useState<any[]>([])
    const [assetId, setAssetId] = React.useState<string | null>(null)
    const [assetDropdownOpen, setAssetDropdownOpen] = React.useState(false)
    const [isCreatingAsset, setIsCreatingAsset] = React.useState(false)
    const [newAssetName, setNewAssetName] = React.useState('')
    const [newAssetType, setNewAssetType] = React.useState<'fixed' | 'current'>('fixed')
    const [newAssetCategory, setNewAssetCategory] = React.useState('')
    const [newAssetPurchasePrice, setNewAssetPurchasePrice] = React.useState('')
    const [isInstallmentPurchase, setIsInstallmentPurchase] = React.useState(false)
    const [transactionHasAsset, setTransactionHasAsset] = React.useState(false)

    // Payable Linking State
    const [payables, setPayables] = React.useState<any[]>([])
    const [payableId, setPayableId] = React.useState<string | null>(null)
    const [payableSearch, setPayableSearch] = React.useState('')
    const [payableDropdownOpen, setPayableDropdownOpen] = React.useState(false)

    // Sync state when transaction changes or modal opens
    React.useEffect(() => {
        const fetchClasses = async () => {
            setIsLoadingClasses(true)
            try {
                const data = await getFinancialClasses()
                setClasses(data)
            } finally {
                setIsLoadingClasses(false)
            }
        }
        const fetchVendors = async () => {
            try {
                const data = await getVendors()
                setVendors(data)
            } catch (e) {
                console.error('Failed to fetch vendors:', e)
            }
        }
        const fetchStaff = async () => {
            try {
                const data = await getStaff()
                setStaffList(data)
            } catch (e) {
                console.error('Failed to fetch staff:', e)
            }
        }
        const fetchDebts = async () => {
            try {
                const supabase = (await import('@/lib/supabase/client')).createClient()
                const { data } = await supabase.from('debts').select('*')
                if (data) setDebts(data)
            } catch (e) {
                console.error('Failed to fetch debts:', e)
            }
        }
        const checkExistingAsset = async () => {
            if (transaction?.id) {
                const supabase = (await import('@/lib/supabase/client')).createClient()
                const { data } = await supabase
                    .from('assets')
                    .select('id')
                    .eq('linked_transaction_id', transaction.id)
                    .maybeSingle()
                setTransactionHasAsset(!!data)
            }
        }
        if (isOpen && transaction) {
            fetchClasses()
            fetchVendors()
            fetchStaff()
            fetchDebts()
            checkExistingAsset()
            setDebtId(transaction.debt_id || null)
            setVendorName(transaction.vendors?.name || "")
            setVendorId(transaction.vendor_id || null)
            setStaffId(transaction.staff_id || null)
            // Set payee type based on existing data
            if (transaction.staff_id) {
                setPayeeType('staff')
            } else {
                setPayeeType('vendor')
            }
            setNotes(transaction.notes || "")
            setCategoryId(transaction.category_id || null)
            setAiSuggestion(null)
            setIsAddingCategory(false)
            setNewCategoryName("")
            setNewCategoryParentId("")
            setNewCategoryClassId("")
            setShouldCreateRule(false)
            setRuleConditions([])
            setCategorySearch('')
            setJustCreatedParentId(null)
            setShowSubcategoryForm(false)
            setIsAddingVendor(false)
            setNewVendorName("")
            setApplyVendorBulk(false)
            setIsAddingStaff(false)
            setNewStaffName("")
            setNewStaffRole('staff')
            setUpdateDebtBalance(true)
            setIsCreatingAsset(false)
            setNewAssetName('')
            setNewAssetType('fixed')
            setNewAssetCategory('')
            setNewAssetPurchasePrice('')
            setIsInstallmentPurchase(false)
            setAssetId(transaction.asset_id || null)
            setAssetDropdownOpen(false)
            // Fetch assets for linking
            const fetchAssets = async () => {
                const supabase = (await import('@/lib/supabase/client')).createClient()
                const { data } = await supabase.from('assets').select('*').eq('status', 'active').order('name')
                if (data) setAssets(data)
            }
            fetchAssets()
            // Fetch payables for linking (expense transactions only)
            const fetchPayablesData = async () => {
                console.log('[RECONCILE MODAL] Fetching payables...')
                try {
                    const data = await getPayablesForLinking()
                    console.log('[RECONCILE MODAL] Payables fetched:', data?.length || 0, data)
                    setPayables(data)
                } catch (e) {
                    console.error('[RECONCILE MODAL] Failed to fetch payables:', e)
                }
            }
            console.log('[RECONCILE MODAL] Transaction amount:', transaction.amount, 'isExpense:', transaction.amount < 0)
            if (transaction.amount < 0) {
                fetchPayablesData()
            }
            setPayableId(transaction.linked_payable_id || null)
            setPayableSearch('')
            setPayableDropdownOpen(false)
        }
    }, [isOpen, transaction])

    const handleAISuggest = async () => {
        setIsAISuggesting(true)
        try {
            const suggestion = await getAICategorySuggestion(
                transaction.description || "",
                transaction.reference || "",
                transaction.bank_category || undefined
            )
            setAiSuggestion(suggestion)
        } catch (error) {
            console.error("AI Suggestion failed:", error)
        } finally {
            setIsAISuggesting(false)
        }
    }

    const handleCreateCategory = async () => {
        if (!newCategoryName.trim()) return
        setIsCreatingCategory(true)
        try {
            const isCreatingSubcategory = !!newCategoryParentId
            const newCat = await createCategory({
                name: newCategoryName,
                type: transaction.amount < 0 ? 'expense' : 'income',
                parentId: newCategoryParentId || undefined,
                classId: newCategoryClassId || undefined
            })
            onUpdate() // Refresh categories list
            setCategoryId(newCat.id)

            if (!isCreatingSubcategory) {
                // Just created a parent - offer to create subcategory
                setJustCreatedParentId(newCat.id)
                setShowSubcategoryForm(true)
                setNewCategoryName("")
            } else {
                // Created subcategory - done
                setIsAddingCategory(false)
                setNewCategoryName("")
                setNewCategoryParentId("")
                setJustCreatedParentId(null)
                setShowSubcategoryForm(false)
            }
        } catch (error) {
            console.error("Failed to create category:", error)
        } finally {
            setIsCreatingCategory(false)
        }
    }

    const handleCreateSubcategory = async () => {
        if (!newCategoryName.trim() || !justCreatedParentId) return
        setIsCreatingCategory(true)
        try {
            const newSub = await createCategory({
                name: newCategoryName,
                type: transaction.amount < 0 ? 'expense' : 'income',
                parentId: justCreatedParentId,
                classId: newCategoryClassId || undefined
            })
            onUpdate()
            setCategoryId(newSub.id)
            setIsAddingCategory(false)
            setNewCategoryName("")
            setJustCreatedParentId(null)
            setShowSubcategoryForm(false)
        } catch (error) {
            console.error("Failed to create subcategory:", error)
        } finally {
            setIsCreatingCategory(false)
        }
    }

    const handleSkipSubcategory = () => {
        setIsAddingCategory(false)
        setNewCategoryName("")
        setJustCreatedParentId(null)
        setShowSubcategoryForm(false)
    }

    const handleCreateVendor = async () => {
        if (!newVendorName.trim()) return
        setIsCreatingVendor(true)
        try {
            const vendor = await createVendor({ name: newVendorName })
            setVendors([...vendors, vendor])
            setVendorId(vendor.id)
            setIsAddingVendor(false)
            setNewVendorName("")
        } catch (e) {
            console.error('Failed to create vendor:', e)
        } finally {
            setIsCreatingVendor(false)
        }
    }

    const handleCreateStaff = async () => {
        if (!newStaffName.trim()) return
        setIsCreatingStaff(true)
        try {
            const staff = await createStaff({ name: newStaffName, role: newStaffRole })
            setStaffList([...staffList, staff])
            setStaffId(staff.id)
            setIsAddingStaff(false)
            setNewStaffName("")
        } catch (e) {
            console.error('Failed to create staff:', e)
        } finally {
            setIsCreatingStaff(false)
        }
    }

    const handleSave = async () => {
        setIsSaving(true)
        try {
            let finalCategoryId = categoryId

            // 1. Bulk assign vendor if toggled
            if (applyVendorBulk && vendorId && transaction.raw_party) {
                try {
                    await assignVendorBulk(vendorId, transaction.raw_party)
                } catch (e) {
                    console.error('Bulk vendor assignment failed:', e)
                }
            }

            // 2. Create Rule if toggled
            if (shouldCreateRule && finalCategoryId) {
                try {
                    const baseRuleData = {
                        actionCategoryId: finalCategoryId,
                        actionStaffId: payeeType === 'staff' ? staffId || undefined : undefined,
                        actionVendorId: payeeType === 'vendor' ? vendorId || undefined : undefined,
                        matchTransactionType: (transaction.amount < 0 ? 'expense' : 'income') as 'income' | 'expense',
                        requiresApproval: ruleRequiresApproval,
                        actionNotesTemplate: ruleNotesTemplate || undefined
                    }

                    // Use Dynamic Builder if conditions are set
                    if (useDynamicBuilder && ruleConditions.length > 0) {
                        // Build clean name: extract key values from conditions
                        const categoryName = categories.find(c => c.id === finalCategoryId)?.name || 'Unknown'
                        const keyParts = ruleConditions.slice(0, 2).map(c => {
                            const val = String(c.value)
                            // Extract first meaningful word or short phrase
                            if (c.field === 'transaction_type') return val === 'expense' ? '💰 Expense' : '💵 Income'
                            if (c.field === 'amount') return `£${val}`
                            // Truncate long values
                            return val.length > 15 ? val.slice(0, 15) + '…' : val
                        })
                        const keyString = keyParts.join(' + ')
                        const suffix = ruleConditions.length > 2 ? ` (+${ruleConditions.length - 2})` : ''

                        await createRule({
                            ...baseRuleData,
                            name: `${keyString}${suffix} → ${categoryName}`,
                            matchType: 'conditions',
                            conditions: ruleConditions
                        })
                    } else {
                        // Legacy rule creation (fallback)
                        const categoryName = categories.find(c => c.id === finalCategoryId)?.name || 'Unknown'
                        const hasMultipleMatchers =
                            ((payeeType === 'vendor' && vendorId) || (payeeType === 'staff' && staffId)) &&
                            (ruleDescriptionPattern || ruleAmountMin || ruleAmountMax)

                        if (hasMultipleMatchers) {
                            const payeeName = payeeType === 'vendor'
                                ? vendors.find(v => v.id === vendorId)?.name
                                : staffList.find((s: any) => s.id === staffId)?.name
                            const descPart = ruleDescriptionPattern ? ` + "${ruleDescriptionPattern}"` : ''
                            await createRule({
                                ...baseRuleData,
                                name: `${payeeName}${descPart} → ${categoryName}`,
                                matchType: 'composite',
                                matchVendorId: payeeType === 'vendor' ? vendorId || undefined : undefined,
                                matchStaffId: payeeType === 'staff' ? staffId || undefined : undefined,
                                matchDescriptionPattern: ruleDescriptionPattern || undefined,
                                matchAmountMin: ruleAmountMin ? parseFloat(ruleAmountMin) : undefined,
                                matchAmountMax: ruleAmountMax ? parseFloat(ruleAmountMax) : undefined
                            })
                        } else if (payeeType === 'vendor' && vendorId) {
                            const vendorName = vendors.find(v => v.id === vendorId)?.name || 'Vendor'
                            await createRule({
                                ...baseRuleData,
                                name: `${vendorName} → ${categoryName}`,
                                matchType: 'vendor',
                                matchVendorId: vendorId,
                                matchDescriptionPattern: ruleDescriptionPattern || undefined,
                                matchAmountMin: ruleAmountMin ? parseFloat(ruleAmountMin) : undefined,
                                matchAmountMax: ruleAmountMax ? parseFloat(ruleAmountMax) : undefined
                            })
                        } else if (payeeType === 'staff' && staffId) {
                            const staffName = staffList.find((s: any) => s.id === staffId)?.name || 'Staff'
                            await createRule({
                                ...baseRuleData,
                                name: `${staffName} → ${categoryName}`,
                                matchType: 'staff',
                                matchStaffId: staffId,
                                matchDescriptionPattern: ruleDescriptionPattern || undefined,
                                matchAmountMin: ruleAmountMin ? parseFloat(ruleAmountMin) : undefined,
                                matchAmountMax: ruleAmountMax ? parseFloat(ruleAmountMax) : undefined
                            })
                        } else if (ruleDescriptionPattern) {
                            await createRule({
                                ...baseRuleData,
                                name: `"${ruleDescriptionPattern}" → ${categoryName}`,
                                matchType: 'description',
                                matchDescriptionPattern: ruleDescriptionPattern
                            })
                        } else if (ruleAmountMin || ruleAmountMax) {
                            await createRule({
                                ...baseRuleData,
                                name: `£${ruleAmountMin || '0'}-${ruleAmountMax || '∞'} → ${categoryName}`,
                                matchType: 'amount',
                                matchAmountMin: ruleAmountMin ? parseFloat(ruleAmountMin) : undefined,
                                matchAmountMax: ruleAmountMax ? parseFloat(ruleAmountMax) : undefined
                            })
                        }
                    }
                } catch (ruleError) {
                    console.error("Failed to create rule:", ruleError)
                }
            }

            // 3. Handle Debt Creation/Linking
            let finalDebtId = debtId
            const supabase = (await import('@/lib/supabase/client')).createClient()

            // Create new debt if user filled out the form
            if (isCreatingDebtFromTx && newDebtCreditor && transaction.amount > 0) {
                const { data: newDebt, error: debtError } = await supabase
                    .from('debts')
                    .insert({
                        creditor_name: newDebtCreditor,
                        original_balance: Math.abs(transaction.amount),
                        remaining_balance: Math.abs(transaction.amount),
                        monthly_payment: parseFloat(newDebtMonthlyPayment) || 0
                    })
                    .select('id')
                    .single()

                if (!debtError && newDebt) {
                    finalDebtId = newDebt.id
                }
            }

            // Update debt balance if linking to existing debt
            if (finalDebtId && transaction.debt_id !== finalDebtId && updateDebtBalance) {
                const linkedDebt = debts.find(d => d.id === finalDebtId)
                if (linkedDebt) {
                    const currentBalance = parseFloat(linkedDebt.remaining_balance)
                    const txAmount = Math.abs(transaction.amount)

                    // Incoming = increases debt, Outgoing = decreases debt
                    const newBalance = transaction.amount > 0
                        ? currentBalance + txAmount  // Additional borrowing
                        : currentBalance - txAmount  // Repayment

                    const finalBalance = Math.max(0, newBalance)

                    // Auto-mark as paid off if balance reaches zero
                    const updateData: { remaining_balance: number; status?: string } = { remaining_balance: finalBalance }
                    if (finalBalance === 0 && linkedDebt.status !== 'paid_off') {
                        updateData.status = 'paid_off'
                    }

                    await supabase
                        .from('debts')
                        .update(updateData)
                        .eq('id', finalDebtId)
                }
            }

            // 4. Update Transaction
            await updateTransactionDetails(transaction.id, {
                categoryId: finalCategoryId,
                notes,
                vendorId: payeeType === 'vendor' ? vendorId : null,
                staffId: payeeType === 'staff' ? staffId : null
            })

            // Also update debt_id directly
            if (finalDebtId !== transaction.debt_id) {
                await supabase
                    .from('transactions')
                    .update({ debt_id: finalDebtId })
                    .eq('id', transaction.id)
            }

            if (isCreatingAsset && newAssetName && transaction.amount < 0) {
                const { data: { user } } = await supabase.auth.getUser()
                if (user) {
                    const purchasePrice = newAssetPurchasePrice ? parseFloat(newAssetPurchasePrice) : Math.abs(transaction.amount)
                    // If not installment (paid in full), amount_paid = purchase_price
                    const amountPaid = isInstallmentPurchase ? Math.abs(transaction.amount) : purchasePrice
                    const { data: newAsset } = await supabase.from('assets').insert({
                        user_id: user.id,
                        name: newAssetName,
                        asset_type: newAssetType,
                        category: newAssetCategory || null,
                        purchase_date: transaction.transaction_date,
                        purchase_price: purchasePrice,
                        amount_paid: amountPaid,
                        linked_transaction_id: transaction.id,
                        status: 'active'
                    }).select().single()

                    // Also set asset_id on transaction
                    if (newAsset) {
                        await supabase.from('transactions').update({ asset_id: newAsset.id }).eq('id', transaction.id)
                    }
                }
            }

            // Link to existing asset (installment payment)
            if (assetId && assetId !== transaction.asset_id && transaction.amount < 0) {
                const linkedAsset = assets.find(a => a.id === assetId)
                if (linkedAsset) {
                    const newAmountPaid = (linkedAsset.amount_paid || 0) + Math.abs(transaction.amount)
                    await supabase.from('assets').update({ amount_paid: newAmountPaid }).eq('id', assetId)
                    await supabase.from('transactions').update({ asset_id: assetId }).eq('id', transaction.id)
                }
            }

            // 5. Link to payable (if selected)
            if (payableId && payableId !== transaction.linked_payable_id) {
                try {
                    await linkTransactionToPayable(transaction.id, payableId)
                } catch (e) {
                    console.error('Failed to link payable:', e)
                }
            }

            onUpdate()
            onOpenChange(false)
        } catch (error) {
            console.error(error)
        } finally {
            setIsSaving(false)
        }
    }

    if (!transaction) return null

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto border-none shadow-2xl p-0 dark:bg-zinc-950 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-zinc-900 [&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-thumb]:rounded-full">
                <div className="bg-indigo-600 p-6 text-white">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black flex items-center gap-2">
                            <Receipt className="h-5 w-5" />
                            Reconcile Transaction
                        </DialogTitle>
                        <DialogDescription className="text-indigo-100 opacity-90 font-medium mt-1">
                            Refine details and categorize this transaction for your ledger.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="mt-6 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold tracking-widest opacity-70">Amount</span>
                            <span className="text-3xl font-black tabular-nums">
                                {transaction.amount < 0 ? `-£${Math.abs(transaction.amount).toFixed(2)}` : `+£${transaction.amount.toFixed(2)}`}
                            </span>
                        </div>
                        <div className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter">
                            {new Date(transaction.transaction_date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                        </div>
                    </div>
                    {transaction.description && (
                        <div className="mt-3 p-2 bg-white/10 rounded-lg">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase font-bold tracking-widest opacity-70 block mb-1">Reference / Description</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        navigator.clipboard.writeText(transaction.description)
                                    }}
                                    className="p-1 hover:bg-white/20 rounded transition-colors"
                                    title="Copy to clipboard"
                                >
                                    <Copy className="h-3.5 w-3.5 opacity-70 hover:opacity-100" />
                                </button>
                            </div>
                            <span className="text-sm font-medium opacity-90">{transaction.description}</span>
                        </div>
                    )}
                </div>

                <div className="p-6 space-y-6">
                    {/* Raw Party Reference */}
                    {transaction.raw_party && (
                        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900/50">
                            <Building2 className="h-4 w-4 text-amber-600" />
                            <div className="flex flex-col flex-1">
                                <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400">Bank Party Name</span>
                                <span className="text-sm font-medium text-amber-900 dark:text-amber-200">{transaction.raw_party}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    navigator.clipboard.writeText(transaction.raw_party)
                                }}
                                className="p-1.5 hover:bg-amber-200/50 dark:hover:bg-amber-800/30 rounded transition-colors"
                                title="Copy to clipboard"
                            >
                                <Copy className="h-4 w-4 text-amber-600" />
                            </button>
                        </div>
                    )}

                    {/* Payee Type Toggle */}
                    <div className="grid gap-3">
                        <Label className="text-[11px] uppercase font-black tracking-widest text-muted-foreground">Payee Type</Label>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => { setPayeeType('vendor'); setStaffId(null); }}
                                className={`flex-1 h-10 rounded-lg border text-sm font-bold transition-all flex items-center justify-center gap-2 ${payeeType === 'vendor' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 hover:border-indigo-300'}`}
                            >
                                <Store className="h-4 w-4" /> Vendor
                            </button>
                            <button
                                type="button"
                                onClick={() => { setPayeeType('staff'); setVendorId(null); }}
                                className={`flex-1 h-10 rounded-lg border text-sm font-bold transition-all flex items-center justify-center gap-2 ${payeeType === 'staff' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 hover:border-indigo-300'}`}
                            >
                                <Users className="h-4 w-4" /> Staff
                            </button>
                        </div>

                        {/* Vendor Selector */}
                        {payeeType === 'vendor' && (
                            <>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">Select or create a vendor</span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setIsAddingVendor(!isAddingVendor)}
                                        className={`h-7 px-2 text-xs gap-1 ${isAddingVendor ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                                    >
                                        {isAddingVendor ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                                        {isAddingVendor ? "Cancel" : "New"}
                                    </Button>
                                </div>
                                {isAddingVendor ? (
                                    <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 space-y-3 animate-in fade-in">
                                        <Input
                                            value={newVendorName}
                                            onChange={(e) => setNewVendorName(e.target.value)}
                                            placeholder="e.g. Stripe, British Gas..."
                                            className="h-9 font-bold"
                                            autoFocus
                                        />
                                        <Button
                                            onClick={handleCreateVendor}
                                            disabled={!newVendorName.trim() || isCreatingVendor}
                                            className="w-full h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                                        >
                                            {isCreatingVendor ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Plus className="h-3 w-3 mr-2" />}
                                            Create Vendor
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={vendorDropdownOpen ? vendorSearch : (vendors.find(v => v.id === vendorId)?.name || '')}
                                            onChange={(e) => {
                                                setVendorSearch(e.target.value)
                                                if (!vendorDropdownOpen) setVendorDropdownOpen(true)
                                            }}
                                            onFocus={() => setVendorDropdownOpen(true)}
                                            placeholder="Search vendors..."
                                            className="w-full h-11 rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 text-sm font-bold outline-none"
                                        />
                                        {vendorDropdownOpen && (
                                            <div className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                                <div
                                                    onClick={() => {
                                                        setVendorId(null)
                                                        setVendorSearch('')
                                                        setVendorDropdownOpen(false)
                                                    }}
                                                    className="px-3 py-2 text-sm text-muted-foreground hover:bg-slate-50 dark:hover:bg-zinc-900 cursor-pointer"
                                                >
                                                    — Clear Selection —
                                                </div>
                                                {vendors
                                                    .filter(v => v.name.toLowerCase().includes(vendorSearch.toLowerCase()))
                                                    .map(v => (
                                                        <div
                                                            key={v.id}
                                                            onClick={() => {
                                                                setVendorId(v.id)
                                                                setVendorSearch('')
                                                                setVendorDropdownOpen(false)
                                                            }}
                                                            className={`px-3 py-2 text-sm font-bold cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-900 ${vendorId === v.id ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400' : ''}`}
                                                        >
                                                            {v.name}
                                                        </div>
                                                    ))}
                                                {vendors.filter(v => v.name.toLowerCase().includes(vendorSearch.toLowerCase())).length === 0 && (
                                                    <div className="px-3 py-2 text-xs text-muted-foreground italic">No vendors found</div>
                                                )}
                                            </div>
                                        )}
                                        {vendorDropdownOpen && (
                                            <div className="fixed inset-0 z-40" onClick={() => setVendorDropdownOpen(false)} />
                                        )}
                                    </div>
                                )}
                                {/* Bulk Assignment Toggle */}
                                {vendorId && transaction.raw_party && (
                                    <div
                                        onClick={() => setApplyVendorBulk(!applyVendorBulk)}
                                        className={`flex items-center gap-3 p-2 rounded-lg border transition-all cursor-pointer text-xs ${applyVendorBulk ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/30' : 'bg-slate-50 dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-800 opacity-60 hover:opacity-100'}`}
                                    >
                                        <div className={`h-4 w-4 rounded flex items-center justify-center border ${applyVendorBulk ? 'bg-amber-600 border-amber-600 text-white' : 'border-slate-300 dark:border-zinc-700'}`}>
                                            {applyVendorBulk && <ChevronRight className="h-2.5 w-2.5" />}
                                        </div>
                                        <span className="font-bold">Apply to all "{transaction.raw_party}" transactions</span>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Staff Selector */}
                        {payeeType === 'staff' && (
                            <>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">Select or create a staff member</span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setIsAddingStaff(!isAddingStaff)}
                                        className={`h-7 px-2 text-xs gap-1 ${isAddingStaff ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                                    >
                                        {isAddingStaff ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                                        {isAddingStaff ? "Cancel" : "New"}
                                    </Button>
                                </div>
                                {isAddingStaff ? (
                                    <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 space-y-3 animate-in fade-in">
                                        <Input
                                            value={newStaffName}
                                            onChange={(e) => setNewStaffName(e.target.value)}
                                            placeholder="e.g. John Smith"
                                            className="h-9 font-bold"
                                            autoFocus
                                        />
                                        <select
                                            value={newStaffRole}
                                            onChange={(e) => setNewStaffRole(e.target.value as StaffRole)}
                                            className="w-full h-9 rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 text-xs font-bold outline-none"
                                        >
                                            <option value="director">Director</option>
                                            <option value="coach">Coach</option>
                                            <option value="staff">Staff</option>
                                        </select>
                                        <Button
                                            onClick={handleCreateStaff}
                                            disabled={!newStaffName.trim() || isCreatingStaff}
                                            className="w-full h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                                        >
                                            {isCreatingStaff ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Plus className="h-3 w-3 mr-2" />}
                                            Create Staff
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={staffDropdownOpen ? staffSearch : (staffList.find(s => s.id === staffId)?.name || '')}
                                            onChange={(e) => {
                                                setStaffSearch(e.target.value)
                                                if (!staffDropdownOpen) setStaffDropdownOpen(true)
                                            }}
                                            onFocus={() => setStaffDropdownOpen(true)}
                                            placeholder="Search staff..."
                                            className="w-full h-11 rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 text-sm font-bold outline-none"
                                        />
                                        {staffDropdownOpen && (
                                            <div className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                                <div
                                                    onClick={() => {
                                                        setStaffId(null)
                                                        setStaffSearch('')
                                                        setStaffDropdownOpen(false)
                                                    }}
                                                    className="px-3 py-2 text-sm text-muted-foreground hover:bg-slate-50 dark:hover:bg-zinc-900 cursor-pointer"
                                                >
                                                    — Clear Selection —
                                                </div>
                                                {staffList
                                                    .filter(s => s.name.toLowerCase().includes(staffSearch.toLowerCase()))
                                                    .map(s => (
                                                        <div
                                                            key={s.id}
                                                            onClick={() => {
                                                                setStaffId(s.id)
                                                                setStaffSearch('')
                                                                setStaffDropdownOpen(false)
                                                            }}
                                                            className={`px-3 py-2 text-sm font-bold cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-900 ${staffId === s.id ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400' : ''}`}
                                                        >
                                                            {s.name} <span className="text-xs text-muted-foreground font-normal">({s.role})</span>
                                                        </div>
                                                    ))}
                                                {staffList.filter(s => s.name.toLowerCase().includes(staffSearch.toLowerCase())).length === 0 && (
                                                    <div className="px-3 py-2 text-xs text-muted-foreground italic">No staff found</div>
                                                )}
                                            </div>
                                        )}
                                        {staffDropdownOpen && (
                                            <div className="fixed inset-0 z-40" onClick={() => setStaffDropdownOpen(false)} />
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Payable Linking (expense transactions only) */}
                    {transaction.amount < 0 && (
                        <div className="grid gap-2">
                            <Label className="text-[11px] uppercase font-black tracking-widest text-muted-foreground flex items-center gap-2">
                                <FileText className="h-3 w-3" /> Link to Payable ({payables.length} available)
                            </Label>
                            <span className="text-xs text-muted-foreground">Match this transaction to an existing payable</span>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={payableDropdownOpen ? payableSearch : (payables.find(p => p.id === payableId)?.name || payables.find(p => p.id === payableId)?.vendor_name || '')}
                                    onChange={(e) => {
                                        setPayableSearch(e.target.value)
                                        if (!payableDropdownOpen) setPayableDropdownOpen(true)
                                    }}
                                    onFocus={() => setPayableDropdownOpen(true)}
                                    placeholder="Search payables..."
                                    className="w-full h-11 rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 text-sm font-bold outline-none"
                                />
                                {payableDropdownOpen && (
                                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                        <div
                                            onClick={() => {
                                                setPayableId(null)
                                                setPayableSearch('')
                                                setPayableDropdownOpen(false)
                                            }}
                                            className="px-3 py-2 text-sm text-muted-foreground hover:bg-slate-50 dark:hover:bg-zinc-900 cursor-pointer"
                                        >
                                            — No Payable —
                                        </div>
                                        {payables
                                            .filter(p => {
                                                const name = (p.vendor_name || p.staff_name || p.name || '').toLowerCase()
                                                return name.includes(payableSearch.toLowerCase()) || String(p.amount).includes(payableSearch)
                                            })
                                            .map(p => (
                                                <div
                                                    key={p.id}
                                                    onClick={() => {
                                                        setPayableId(p.id)
                                                        setPayableSearch('')
                                                        setPayableDropdownOpen(false)
                                                    }}
                                                    className={`px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-900 ${payableId === p.id ? 'bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-400' : ''}`}
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold">{p.vendor_name || p.staff_name || 'Unknown'}</span>
                                                            {p.name && <span className="text-xs text-muted-foreground">{p.name}</span>}
                                                        </div>
                                                        <span className="text-sm font-bold text-rose-600">£{Number(p.amount).toFixed(2)}</span>
                                                    </div>
                                                    {p.next_due && (
                                                        <span className="text-xs text-muted-foreground">Due: {new Date(p.next_due).toLocaleDateString()}</span>
                                                    )}
                                                </div>
                                            ))}
                                        {payables.filter(p => (p.vendor_name || p.staff_name || p.name || '').toLowerCase().includes(payableSearch.toLowerCase())).length === 0 && (
                                            <div className="px-3 py-2 text-xs text-muted-foreground italic">No payables found</div>
                                        )}
                                    </div>
                                )}
                                {payableDropdownOpen && (
                                    <div className="fixed inset-0 z-40" onClick={() => setPayableDropdownOpen(false)} />
                                )}
                            </div>
                            {payableId && (
                                <p className="text-xs text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/30 p-2 rounded">
                                    💡 Saving will link this transaction to the payable and mark it as paid.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Bank Category Hint */}
                    {transaction.bank_category && (
                        <div className="flex items-center gap-2">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-[10px] uppercase font-bold text-muted-foreground">Bank Category:</span>
                            <Badge variant="secondary" className="text-[10px] font-bold">
                                {transaction.bank_category}
                            </Badge>
                        </div>
                    )}

                    <div className="grid gap-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-[11px] uppercase font-black tracking-widest text-muted-foreground flex items-center gap-2">
                                <Info className="h-3 w-3" /> Category
                            </Label>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleAISuggest}
                                    disabled={isAISuggesting}
                                    className="h-7 px-2 text-xs gap-1 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
                                >
                                    {isAISuggesting ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <Sparkles className="h-3 w-3" />
                                    )}
                                    {isAISuggesting ? "Thinking..." : "Suggest"}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsAddingCategory(!isAddingCategory)}
                                    className={`h-7 px-2 text-xs gap-1 ${isAddingCategory ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                                >
                                    {isAddingCategory ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                                    {isAddingCategory ? "Cancel" : "New"}
                                </Button>
                            </div>
                        </div>

                        {/* Inline Category Creation */}
                        {isAddingCategory && !showSubcategoryForm && (
                            <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 space-y-3 animate-in fade-in slide-in-from-top-2">
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-bold opacity-70">Category Name</Label>
                                    <Input
                                        value={newCategoryName}
                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                        placeholder="e.g. Cleaning Supplies"
                                        className="h-9 font-bold bg-white dark:bg-zinc-950"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-bold opacity-70">Parent (Optional)</Label>
                                    <select
                                        value={newCategoryParentId}
                                        onChange={(e) => {
                                            const val = e.target.value
                                            setNewCategoryParentId(val)
                                            // If picking a parent, we might want to hide the Class selector or auto-set it
                                            if (val) {
                                                const parent = categories.find(c => c.id === val)
                                                if (parent?.class_id) setNewCategoryClassId(parent.class_id)
                                            }
                                        }}
                                        className="w-full h-9 rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 text-xs font-bold outline-none"
                                    >
                                        <option value="">— Top Level (Create Parent) —</option>
                                        {categories
                                            .filter(c => !c.parent_id && c.type === (transaction.amount < 0 ? 'expense' : 'income'))
                                            .map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                                        }
                                    </select>
                                </div>
                                {!newCategoryParentId && (
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-bold opacity-70">Accounting Class</Label>
                                        <select
                                            value={newCategoryClassId}
                                            onChange={(e) => setNewCategoryClassId(e.target.value)}
                                            className="w-full h-9 rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 text-xs font-bold outline-none"
                                        >
                                            <option value="">— Select Class —</option>
                                            {classes
                                                .filter(c => c.type === (transaction.amount < 0 ? 'expense' : 'income') || c.type === 'both' || !c.type)
                                                .map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                                            }
                                        </select>
                                    </div>
                                )}
                                <Button
                                    onClick={handleCreateCategory}
                                    disabled={!newCategoryName.trim() || isCreatingCategory}
                                    className="w-full h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                                >
                                    {isCreatingCategory ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Plus className="h-3 w-3 mr-2" />}
                                    {newCategoryParentId ? 'Create Subcategory' : 'Create Category'}
                                </Button>
                            </div>
                        )}

                        {/* Two-Step: Subcategory Form */}
                        {isAddingCategory && showSubcategoryForm && justCreatedParentId && (
                            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-900/50 space-y-3 animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                                    <ChevronRight className="h-4 w-4" />
                                    <span className="text-xs font-bold">Parent created! Add a subcategory?</span>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-bold opacity-70">Subcategory Name</Label>
                                    <Input
                                        value={newCategoryName}
                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                        placeholder="e.g. Equipment, Supplies..."
                                        className="h-9 font-bold bg-white dark:bg-zinc-950"
                                        autoFocus
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={handleSkipSubcategory}
                                        className="flex-1 h-8 text-xs font-bold"
                                    >
                                        Skip
                                    </Button>
                                    <Button
                                        onClick={handleCreateSubcategory}
                                        disabled={!newCategoryName.trim() || isCreatingCategory}
                                        className="flex-1 h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                                    >
                                        {isCreatingCategory ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Plus className="h-3 w-3 mr-2" />}
                                        Create
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* AI Suggestion Display */}
                        {aiSuggestion && !isAddingCategory && (
                            <div className="flex items-center gap-2 p-2 bg-indigo-50 dark:bg-indigo-950/30 rounded-md border border-indigo-200 dark:border-indigo-900/50">
                                <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300 flex-1">
                                    AI suggests: "{aiSuggestion}"
                                </span>
                            </div>
                        )}

                        {!isAddingCategory && (
                            <div className="relative">
                                <input
                                    type="text"
                                    value={categorySearch}
                                    onChange={(e) => setCategorySearch(e.target.value)}
                                    placeholder={categoryId
                                        ? categories.find(c => c.id === categoryId)?.name || "Search categories..."
                                        : "Search or click to browse..."
                                    }
                                    onFocus={() => setCategorySearch(categorySearch || ' ')}
                                    onBlur={() => setTimeout(() => setCategorySearch(''), 150)}
                                    className="h-11 w-full rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                {categorySearch && (
                                    <div className="absolute z-50 top-12 left-0 right-0 max-h-60 overflow-auto rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-lg">
                                        {(() => {
                                            const searchLower = categorySearch.trim().toLowerCase()
                                            const transactionType = transaction.amount < 0 ? 'expense' : 'income'

                                            // Get filtered parent categories
                                            const parentCategories = categories
                                                .filter(c => !c.parent_id && c.type === transactionType)
                                                .filter(c => {
                                                    if (!searchLower) return true
                                                    // Show parent if it or any child matches
                                                    const childMatches = categories.some(
                                                        child => child.parent_id === c.id &&
                                                            child.name.toLowerCase().includes(searchLower)
                                                    )
                                                    return c.name.toLowerCase().includes(searchLower) || childMatches
                                                })

                                            if (parentCategories.length === 0) {
                                                return <p className="p-3 text-sm text-muted-foreground">No categories found</p>
                                            }

                                            return parentCategories.map(parent => {
                                                const children = categories.filter(c =>
                                                    c.parent_id === parent.id &&
                                                    (!searchLower || c.name.toLowerCase().includes(searchLower) || parent.name.toLowerCase().includes(searchLower))
                                                )

                                                return (
                                                    <div key={parent.id}>
                                                        <p className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-slate-50 dark:bg-zinc-900/50 sticky top-0">
                                                            {parent.name}
                                                        </p>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setCategoryId(parent.id)
                                                                setCategorySearch('')
                                                            }}
                                                            className={`w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-sm ${categoryId === parent.id ? 'bg-indigo-100 dark:bg-indigo-900/30' : ''}`}
                                                        >
                                                            {parent.name} (General)
                                                        </button>
                                                        {children.map(child => (
                                                            <button
                                                                key={child.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    setCategoryId(child.id)
                                                                    setCategorySearch('')
                                                                }}
                                                                className={`w-full text-left px-3 py-2 pl-6 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-sm ${categoryId === child.id ? 'bg-indigo-100 dark:bg-indigo-900/30 font-bold' : ''}`}
                                                            >
                                                                {child.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )
                                            })
                                        })()}
                                    </div>
                                )}
                                {categoryId && !categorySearch && (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setCategoryId(null)}
                                            className="text-muted-foreground hover:text-foreground"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="grid gap-2">
                        <Label className="text-[11px] uppercase font-black tracking-widest text-muted-foreground flex items-center gap-2">
                            <MessageSquare className="h-3 w-3" /> Internal Notes
                        </Label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="min-h-[80px] w-full rounded-md border border-slate-200 dark:border-zinc-800 bg-transparent px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                            placeholder="Add a memo or context for this transaction..."
                        />
                    </div>

                    {/* Debt Linking Section */}
                    <div className="grid gap-2">
                        <Label className="text-[11px] uppercase font-black tracking-widest text-muted-foreground flex items-center gap-2">
                            <CreditCard className="h-3 w-3" /> Link to Debt / Liability
                        </Label>

                        {!isCreatingDebtFromTx ? (
                            <div className="space-y-2">
                                {/* Existing Debt Dropdown */}
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setDebtDropdownOpen(!debtDropdownOpen)}
                                        className={`w-full h-11 px-3 rounded-lg border text-left text-sm font-medium flex items-center justify-between transition-colors ${debtId
                                            ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800'
                                            : 'bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 hover:border-amber-300'
                                            }`}
                                    >
                                        <span className={debtId ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}>
                                            {debtId
                                                ? (() => {
                                                    const d = debts.find(d => d.id === debtId)
                                                    return d?.name ? `${d.name} (${d.creditor_name})` : d?.creditor_name || 'Linked Debt'
                                                })()
                                                : 'Select existing debt...'
                                            }
                                        </span>
                                        <ChevronRight className={`h-4 w-4 transition-transform ${debtDropdownOpen ? 'rotate-90' : ''}`} />
                                    </button>

                                    {debtDropdownOpen && (
                                        <div className="absolute z-50 top-12 left-0 right-0 max-h-48 overflow-auto rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-lg">
                                            <button
                                                type="button"
                                                onClick={() => { setDebtId(null); setDebtDropdownOpen(false) }}
                                                className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-zinc-900 ${!debtId ? 'bg-slate-100 dark:bg-zinc-800 font-bold' : ''}`}
                                            >
                                                No debt linked
                                            </button>
                                            {debts.map(debt => (
                                                <button
                                                    key={debt.id}
                                                    type="button"
                                                    onClick={() => { setDebtId(debt.id); setDebtDropdownOpen(false) }}
                                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-amber-50 dark:hover:bg-amber-950/20 flex justify-between items-center ${debtId === debt.id ? 'bg-amber-100 dark:bg-amber-900/30 font-bold' : ''
                                                        }`}
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{debt.name || debt.creditor_name}</span>
                                                        {debt.name && (
                                                            <span className="text-[10px] text-muted-foreground">{debt.creditor_name}</span>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">
                                                        £{parseFloat(debt.remaining_balance).toLocaleString()}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Info about what linking does */}
                                {/* Info about what linking does */}
                                {debtId && (
                                    <>
                                        {transaction?.amount > 0 ? (
                                            <div className="flex items-center space-x-3 mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-100 dark:border-amber-900/30">
                                                <Switch
                                                    id="update-balance"
                                                    checked={updateDebtBalance}
                                                    onCheckedChange={setUpdateDebtBalance}
                                                    className="data-[state=checked]:bg-amber-600"
                                                />
                                                <div className="flex flex-col gap-0.5">
                                                    <Label htmlFor="update-balance" className="text-xs font-bold text-amber-900 dark:text-amber-300 cursor-pointer">
                                                        Increase Debt Balance?
                                                    </Label>
                                                    <span className="text-[10px] text-amber-700/80 dark:text-amber-400/80 font-medium leading-tight">
                                                        {updateDebtBalance
                                                            ? `Add £${transaction?.amount.toFixed(2)} to total debt remaining`
                                                            : "Link transaction without increasing balance"
                                                        }
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center space-x-3 mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-100 dark:border-amber-900/30">
                                                <Switch
                                                    id="update-balance-repay"
                                                    checked={updateDebtBalance}
                                                    onCheckedChange={setUpdateDebtBalance}
                                                    className="data-[state=checked]:bg-amber-600"
                                                />
                                                <div className="flex flex-col gap-0.5">
                                                    <Label htmlFor="update-balance-repay" className="text-xs font-bold text-amber-900 dark:text-amber-300 cursor-pointer">
                                                        Decrease Debt Balance?
                                                    </Label>
                                                    <span className="text-[10px] text-amber-700/80 dark:text-amber-400/80 font-medium leading-tight">
                                                        {updateDebtBalance
                                                            ? `Subtract £${Math.abs(transaction?.amount || 0).toFixed(2)} from debt remaining (repayment)`
                                                            : "Link transaction without decreasing balance"
                                                        }
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Create New Debt Button (only for incoming transactions) */}
                                {transaction?.amount > 0 && !debtId && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsCreatingDebtFromTx(true)
                                            setNewDebtCreditor(transaction?.raw_party || transaction?.vendors?.name || '')
                                        }}
                                        className="w-full h-10 px-3 rounded-lg border border-dashed border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 text-sm font-bold flex items-center justify-center gap-2 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors"
                                    >
                                        <Plus className="h-4 w-4" /> Create New Debt from This Transaction
                                    </button>
                                )}
                            </div>
                        ) : (
                            /* Create Debt Form */
                            <div className="space-y-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">
                                        New Debt from £{Math.abs(transaction?.amount || 0).toLocaleString()}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setIsCreatingDebtFromTx(false)}
                                        className="p-1 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Creditor Name</label>
                                    <input
                                        type="text"
                                        value={newDebtCreditor}
                                        onChange={(e) => setNewDebtCreditor(e.target.value)}
                                        placeholder="e.g., Bank of Scotland"
                                        className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Monthly Payment (Optional)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">£</span>
                                        <input
                                            type="number"
                                            value={newDebtMonthlyPayment}
                                            onChange={(e) => setNewDebtMonthlyPayment(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full h-10 pl-7 pr-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Asset Linking & Creation (for expense/outgoing transactions) */}
                    {transaction?.amount < 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-sky-500" />
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Asset Linking</h4>
                            </div>

                            {transactionHasAsset ? (
                                <div className="w-full h-10 px-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 text-sm font-bold flex items-center justify-center gap-2">
                                    <Package className="h-4 w-4" /> Already Linked to Asset
                                </div>
                            ) : !isCreatingAsset ? (
                                <div className="space-y-3">
                                    {/* Link to Existing Asset Dropdown */}
                                    {assets.length > 0 && (
                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={() => setAssetDropdownOpen(!assetDropdownOpen)}
                                                className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm flex items-center justify-between"
                                            >
                                                <span className={assetId ? 'text-foreground' : 'text-muted-foreground'}>
                                                    {assetId ? assets.find(a => a.id === assetId)?.name || 'Select asset...' : 'Link to existing asset (installment)'}
                                                </span>
                                                <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${assetDropdownOpen ? 'rotate-90' : ''}`} />
                                            </button>
                                            {assetDropdownOpen && (
                                                <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                                                    <div
                                                        onClick={() => { setAssetId(null); setAssetDropdownOpen(false); }}
                                                        className={`px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-900 ${!assetId ? 'bg-sky-50 dark:bg-sky-950/30 font-bold' : ''}`}
                                                    >
                                                        No asset link
                                                    </div>
                                                    {assets.map(asset => (
                                                        <div
                                                            key={asset.id}
                                                            onClick={() => { setAssetId(asset.id); setAssetDropdownOpen(false); }}
                                                            className={`px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-900 ${assetId === asset.id ? 'bg-sky-50 dark:bg-sky-950/30 font-bold' : ''}`}
                                                        >
                                                            <div className="text-sm font-medium">{asset.name}</div>
                                                            <div className="text-[10px] text-muted-foreground">
                                                                £{(asset.amount_paid || 0).toFixed(2)} paid of £{asset.purchase_price?.toFixed(2)}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Create New Asset Button */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsCreatingAsset(true)
                                            setNewAssetName(transaction?.description || '')
                                            setAssetId(null)
                                        }}
                                        className="w-full h-10 px-3 rounded-lg border border-dashed border-sky-300 dark:border-sky-700 text-sky-600 dark:text-sky-400 text-sm font-bold flex items-center justify-center gap-2 hover:bg-sky-50 dark:hover:bg-sky-950/20 transition-colors"
                                    >
                                        <Plus className="h-4 w-4" /> Create New Asset
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3 p-4 rounded-xl bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold uppercase tracking-widest text-sky-700 dark:text-sky-400">
                                            New Asset from £{Math.abs(transaction?.amount || 0).toLocaleString()}
                                        </span>
                                        <button type="button" onClick={() => setIsCreatingAsset(false)} className="text-sky-600 hover:text-sky-800">
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Asset Name *</label>
                                        <input
                                            type="text"
                                            value={newAssetName}
                                            onChange={(e) => setNewAssetName(e.target.value)}
                                            placeholder="e.g., MacBook Pro"
                                            className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Asset Type</label>
                                            <select
                                                value={newAssetType}
                                                onChange={(e) => setNewAssetType(e.target.value as 'fixed' | 'current')}
                                                className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm"
                                            >
                                                <option value="fixed">Fixed Asset</option>
                                                <option value="current">Current Asset</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Category</label>
                                            <select
                                                value={newAssetCategory}
                                                onChange={(e) => setNewAssetCategory(e.target.value)}
                                                className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm"
                                            >
                                                <option value="">Select...</option>
                                                <option value="equipment">Equipment</option>
                                                <option value="technology">Technology</option>
                                                <option value="furniture">Furniture</option>
                                                <option value="vehicle">Vehicle</option>
                                                <option value="inventory">Inventory</option>
                                            </select>
                                        </div>
                                    </div>
                                    {/* Installment toggle */}
                                    <div className="flex items-center gap-3 py-2">
                                        <input
                                            type="checkbox"
                                            id="installment-toggle"
                                            checked={isInstallmentPurchase}
                                            onChange={(e) => setIsInstallmentPurchase(e.target.checked)}
                                            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                                        />
                                        <label htmlFor="installment-toggle" className="text-sm text-muted-foreground">
                                            This is an installment purchase (paying over time)
                                        </label>
                                    </div>
                                    {isInstallmentPurchase && (
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Total Purchase Price</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">£</span>
                                                <input
                                                    type="number"
                                                    value={newAssetPurchasePrice}
                                                    onChange={(e) => setNewAssetPurchasePrice(e.target.value)}
                                                    placeholder="Enter full price..."
                                                    className="w-full h-10 pl-7 pr-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm"
                                                />
                                            </div>
                                            <p className="text-[9px] text-muted-foreground mt-1">This payment: £{Math.abs(transaction?.amount || 0).toFixed(2)} (first installment)</p>
                                        </div>
                                    )}
                                    <p className="text-[10px] text-sky-600/70 dark:text-sky-400/70">
                                        {isInstallmentPurchase ? 'This transaction will be recorded as the first payment' : 'Paid in full with this transaction'}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {(vendorId || staffId) && (
                        <div className="space-y-3">
                            <div
                                onClick={() => setShouldCreateRule(!shouldCreateRule)}
                                className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${shouldCreateRule ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-900/50' : 'bg-slate-50 dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-800 opacity-60 hover:opacity-100'}`}
                            >
                                <div className={`h-5 w-5 rounded flex items-center justify-center border transition-colors ${shouldCreateRule ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-zinc-700'}`}>
                                    {shouldCreateRule && <ChevronRight className="h-3 w-3" />}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[11px] font-black uppercase tracking-tight flex items-center gap-1.5">
                                        <Wand2 className="h-3 w-3" /> Create Auto-Rule
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-medium">
                                        {payeeType === 'vendor'
                                            ? `Always categorize ${vendors.find(v => v.id === vendorId)?.name || 'this vendor'} this way`
                                            : `Always categorize ${staffList.find((s: any) => s.id === staffId)?.name || 'this staff member'} this way`
                                        }
                                    </span>
                                </div>
                            </div>

                            {/* Expanded Rule Options */}
                            {shouldCreateRule && (
                                <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/50 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                                            Conditions (ALL must match)
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => setRuleConditions(prev => [...prev, { field: 'counter_party', operator: 'contains', value: '' }])}
                                            className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                                        >
                                            <Plus className="h-3 w-3" /> Add Condition
                                        </button>
                                    </div>

                                    {ruleConditions.length === 0 && (
                                        <p className="text-xs text-muted-foreground text-center py-2">
                                            Click "Add Condition" to define matching criteria
                                        </p>
                                    )}

                                    {ruleConditions.map((cond, index) => (
                                        <div key={index} className="bg-white dark:bg-zinc-900 p-2 rounded-md border space-y-2">
                                            <div className="flex items-center gap-2">
                                                <select
                                                    value={cond.field}
                                                    onChange={e => setRuleConditions(prev => prev.map((c, i) => i === index ? { ...c, field: e.target.value as any } : c))}
                                                    className="h-8 rounded border px-2 text-xs flex-1 min-w-0"
                                                >
                                                    <option value="counter_party">Bank Party</option>
                                                    <option value="reference">Reference</option>
                                                    <option value="amount">Amount</option>
                                                    <option value="transaction_type">Type</option>
                                                </select>

                                                {cond.field === 'transaction_type' ? (
                                                    <select
                                                        value={String(cond.value)}
                                                        onChange={e => setRuleConditions(prev => prev.map((c, i) => i === index ? { ...c, operator: 'equals', value: e.target.value } : c))}
                                                        className="h-8 rounded border px-2 text-xs flex-1 min-w-0"
                                                    >
                                                        <option value="expense">Expense</option>
                                                        <option value="income">Income</option>
                                                    </select>
                                                ) : cond.field === 'amount' ? (
                                                    <select
                                                        value={cond.operator}
                                                        onChange={e => setRuleConditions(prev => prev.map((c, i) => i === index ? { ...c, operator: e.target.value as any } : c))}
                                                        className="h-8 rounded border px-2 text-xs flex-1 min-w-0"
                                                    >
                                                        <option value="equals">=</option>
                                                        <option value="greater_than">&gt;</option>
                                                        <option value="less_than">&lt;</option>
                                                        <option value="between">between</option>
                                                    </select>
                                                ) : (
                                                    <select
                                                        value={cond.operator}
                                                        onChange={e => setRuleConditions(prev => prev.map((c, i) => i === index ? { ...c, operator: e.target.value as any } : c))}
                                                        className="h-8 rounded border px-2 text-xs flex-1 min-w-0"
                                                    >
                                                        <option value="contains">contains</option>
                                                        <option value="not_contains">NOT</option>
                                                        <option value="equals">=</option>
                                                    </select>
                                                )}

                                                <button
                                                    type="button"
                                                    onClick={() => setRuleConditions(prev => prev.filter((_, i) => i !== index))}
                                                    className="h-8 w-8 flex-shrink-0 flex items-center justify-center text-red-500 hover:text-red-700"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>

                                            {/* Value row */}
                                            {cond.field !== 'transaction_type' && (
                                                <div className="flex items-center gap-2">
                                                    {cond.field === 'amount' ? (
                                                        <>
                                                            <input
                                                                type="number"
                                                                value={cond.value}
                                                                onChange={e => setRuleConditions(prev => prev.map((c, i) => i === index ? { ...c, value: parseFloat(e.target.value) || 0 } : c))}
                                                                placeholder="Amount"
                                                                className="h-8 flex-1 min-w-0 rounded border px-2 text-xs"
                                                            />
                                                            {cond.operator === 'between' && (
                                                                <>
                                                                    <span className="text-xs text-muted-foreground">to</span>
                                                                    <input
                                                                        type="number"
                                                                        value={cond.value2 || ''}
                                                                        onChange={e => setRuleConditions(prev => prev.map((c, i) => i === index ? { ...c, value2: parseFloat(e.target.value) || 0 } : c))}
                                                                        placeholder="Max"
                                                                        className="h-8 flex-1 min-w-0 rounded border px-2 text-xs"
                                                                    />
                                                                </>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <input
                                                            value={String(cond.value)}
                                                            onChange={e => setRuleConditions(prev => prev.map((c, i) => i === index ? { ...c, value: e.target.value } : c))}
                                                            placeholder="Enter value..."
                                                            className="h-8 w-full rounded border px-2 text-xs"
                                                        />
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {/* Auto Notes */}
                                    <div className="grid gap-1.5">
                                        <label className="text-[10px] font-bold uppercase text-muted-foreground">
                                            Auto-Add Notes (optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={ruleNotesTemplate}
                                            onChange={e => setRuleNotesTemplate(e.target.value)}
                                            placeholder="Notes added to matched transactions"
                                            className="h-9 rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 text-sm"
                                        />
                                    </div>

                                    {/* Require Approval Toggle */}
                                    <div
                                        onClick={() => setRuleRequiresApproval(!ruleRequiresApproval)}
                                        className="flex items-center gap-3 cursor-pointer"
                                    >
                                        <div className={`h-4 w-4 rounded border transition-colors ${ruleRequiresApproval ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-zinc-700'}`}>
                                            {ruleRequiresApproval && <Check className="h-3 w-3 text-white" />}
                                        </div>
                                        <span className="text-xs font-medium">Require my approval before applying</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className="p-6 bg-slate-50 dark:bg-zinc-900/50 border-t border-slate-100 dark:border-zinc-800 gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="font-bold">Cancel</Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 px-6 gap-2"
                    >
                        {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                        Save & Reconcile
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
