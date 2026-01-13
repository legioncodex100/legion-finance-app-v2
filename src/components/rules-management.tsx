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
import {
    Plus,
    Pencil,
    Trash2,
    Loader2,
    Zap,
    ToggleLeft,
    ToggleRight,
    TestTube,
    GripVertical,
    X,
    Copy,
    ArrowRight
} from "lucide-react"
import {
    getRules,
    createRule,
    updateRule,
    deleteRule,
    toggleRuleActive,
    testRule,
    previewRule,
    CreateRuleData,
    RuleCondition
} from "@/lib/actions/rules"

interface RulesManagementProps {
    vendors: any[]
    staff: any[]
    categories: any[]
}

export function RulesManagement({ vendors, staff, categories }: RulesManagementProps) {
    const [rules, setRules] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)
    const [processing, setProcessing] = React.useState<string | null>(null)
    const [isModalOpen, setIsModalOpen] = React.useState(false)
    const [editingRule, setEditingRule] = React.useState<any | null>(null)
    const [testResults, setTestResults] = React.useState<any | null>(null)
    const [searchQuery, setSearchQuery] = React.useState('')

    // Conditions for dynamic rule builder
    const [conditions, setConditions] = React.useState<RuleCondition[]>([])

    // Form state
    const [formData, setFormData] = React.useState<CreateRuleData>({
        name: '',
        description: '',
        priority: 100,
        matchType: 'vendor',
        conditions: [],
        matchVendorId: '',
        matchStaffId: '',
        matchDescriptionPattern: '',
        matchCounterPartyPattern: '',
        matchAmountMin: undefined,
        matchAmountMax: undefined,
        matchTransactionType: undefined,
        actionCategoryId: '',
        actionStaffId: '',
        actionVendorId: '',
        actionNotesTemplate: '',
        requiresApproval: true
    })

    // Enhanced UI state for "Match Mode"
    const [descriptionMode, setDescriptionMode] = React.useState<'contains' | 'exact' | 'starts_with' | 'ends_with' | 'regex'>('contains')

    const loadRules = React.useCallback(async () => {
        setLoading(true)
        try {
            const data = await getRules()
            setRules(data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => { loadRules() }, [loadRules])

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            priority: 100,
            matchType: 'vendor',
            conditions: [],
            matchVendorId: '',
            matchStaffId: '',
            matchDescriptionPattern: '',
            matchCounterPartyPattern: '',
            matchAmountMin: undefined,
            matchAmountMax: undefined,
            matchTransactionType: undefined,
            actionCategoryId: '',
            actionStaffId: '',
            actionVendorId: '',
            actionNotesTemplate: '',
            requiresApproval: true
        })
        setConditions([])
        setEditingRule(null)
    }

    // Condition helper functions
    const addCondition = () => {
        setConditions(prev => [...prev, { field: 'counter_party', operator: 'contains', value: '' }])
    }

    const removeCondition = (index: number) => {
        setConditions(prev => prev.filter((_, i) => i !== index))
    }

    const updateCondition = (index: number, updates: Partial<RuleCondition>) => {
        setConditions(prev => prev.map((c, i) => i === index ? { ...c, ...updates } : c))
    }

    const openCreateModal = () => {
        resetForm()
        setIsModalOpen(true)
    }

    const openEditModal = (rule: any) => {
        setEditingRule(rule)
        setFormData({
            name: rule.name,
            description: rule.description || '',
            priority: rule.priority,
            matchType: rule.match_type,
            conditions: rule.conditions || [],
            matchVendorId: rule.match_vendor_id || '',
            matchStaffId: rule.match_staff_id || '',
            matchDescriptionPattern: rule.match_description_pattern || '',
            matchCounterPartyPattern: rule.match_counter_party_pattern || '',
            matchAmountMin: rule.match_amount_min ? parseFloat(rule.match_amount_min) : undefined,
            matchAmountMax: rule.match_amount_max ? parseFloat(rule.match_amount_max) : undefined,
            matchTransactionType: rule.match_transaction_type,
            actionCategoryId: rule.action_category_id || '',
            actionStaffId: rule.action_staff_id || '',
            actionVendorId: rule.action_vendor_id || '',
            actionNotesTemplate: rule.action_notes_template || '',
            requiresApproval: rule.requires_approval
        })

        // Load conditions for dynamic rule builder
        setConditions(rule.conditions || [])

        // Reverse-engineer the description mode from the rule data
        if (rule.match_type === 'description') {
            setDescriptionMode('contains')
        } else if (rule.match_type === 'regex') {
            const pattern = rule.match_description_pattern || ''
            if (pattern.startsWith('^') && pattern.endsWith('$')) setDescriptionMode('exact')
            else if (pattern.startsWith('^')) setDescriptionMode('starts_with')
            else if (pattern.endsWith('$')) setDescriptionMode('ends_with')
            else setDescriptionMode('regex')
        } else {
            setDescriptionMode('contains')
        }

        setIsModalOpen(true)
    }

    const handleTest = async (id: string) => {
        setProcessing(id)
        try {
            const results = await testRule(id)
            setTestResults(results)
        } catch (e) {
            console.error(e)
        } finally {
            setProcessing(null)
        }
    }

    const handlePreview = async () => {
        setProcessing('preview')
        try {
            // Transform logic for saving/previewing
            const finalData = { ...formData }

            // If using dynamic conditions, attach them
            if (finalData.matchType === 'conditions') {
                finalData.conditions = conditions
            }

            // Apply Reference Mode transformation
            if (descriptionMode !== 'contains' || finalData.matchType === 'regex') {
                let pattern = finalData.matchDescriptionPattern || ''
                // Escape special regex chars if not in raw regex mode
                if (descriptionMode !== 'regex') {
                    pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                }

                if (descriptionMode === 'exact') pattern = `^${pattern}$`
                else if (descriptionMode === 'starts_with') pattern = `^${pattern}`
                else if (descriptionMode === 'ends_with') pattern = `${pattern}$`

                finalData.matchDescriptionPattern = pattern

                // If it was a simple description match but now has regex anchors, 
                // set type to 'regex'
                if (finalData.matchType === 'description' && descriptionMode !== 'contains') {
                    finalData.matchType = 'regex'
                }
            }

            const results = await previewRule(finalData)
            setTestResults({ ...results, rule: { name: 'Preview Rule' } })
        } catch (e) {
            console.error(e)
        } finally {
            setProcessing(null)
        }
    }

    const handleSave = async () => {
        setProcessing('save')
        try {
            // Transform logic for saving (same as preview)
            const finalData = { ...formData }

            // If using dynamic conditions, attach them
            if (finalData.matchType === 'conditions') {
                finalData.conditions = conditions
            }

            if (finalData.matchType === 'description') {
                if (descriptionMode === 'contains') {
                    // Standard description match
                } else {
                    // Convert UI mode to regex match
                    finalData.matchType = 'regex'
                    let pattern = finalData.matchDescriptionPattern || ''
                    // Escape special regex chars if not in raw regex mode
                    if (descriptionMode !== 'regex') {
                        pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    }

                    if (descriptionMode === 'exact') pattern = `^${pattern}$`
                    else if (descriptionMode === 'starts_with') pattern = `^${pattern}`
                    else if (descriptionMode === 'ends_with') pattern = `${pattern}$`

                    finalData.matchDescriptionPattern = pattern
                }
            }

            if (editingRule) {
                await updateRule(editingRule.id, finalData)
            } else {
                await createRule(finalData)
            }
            await loadRules()
            setIsModalOpen(false)
            resetForm()
        } catch (e) {
            console.error(e)
        } finally {
            setProcessing(null)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this rule? This will also remove all pending matches for this rule.')) return
        setProcessing(id)
        try {
            await deleteRule(id)
            setRules(prev => prev.filter(r => r.id !== id))
        } catch (e) {
            console.error(e)
        } finally {
            setProcessing(null)
        }
    }

    const handleToggle = async (id: string, currentState: boolean) => {
        setProcessing(id)
        try {
            await toggleRuleActive(id, !currentState)
            setRules(prev => prev.map(r => r.id === id ? { ...r, is_active: !currentState } : r))
        } catch (e) {
            console.error(e)
        } finally {
            setProcessing(null)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                    <h2 className="text-lg font-black">Reconciliation Rules</h2>
                    <p className="text-sm text-muted-foreground">
                        Define rules to automatically categorize incoming transactions.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search rules..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-9 w-48 rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 pr-8 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                    <Button onClick={openCreateModal} className="bg-indigo-600 hover:bg-indigo-700">
                        <Plus className="h-4 w-4 mr-2" /> New Rule
                    </Button>
                </div>
            </div>

            {/* Rules List */}
            {rules.length === 0 ? (
                <div className="text-center p-12 border border-dashed rounded-lg">
                    <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-bold">No Rules Yet</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        Create your first rule to automate transaction categorization.
                    </p>
                    <Button onClick={openCreateModal} className="mt-4">
                        <Plus className="h-4 w-4 mr-2" /> Create Rule
                    </Button>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Group rules by category */}
                    {(() => {
                        // Filter rules by search query
                        const query = searchQuery.toLowerCase().trim()
                        const filteredRules = query
                            ? rules.filter(rule =>
                                rule.name?.toLowerCase().includes(query) ||
                                rule.action_category?.name?.toLowerCase().includes(query) ||
                                rule.match_description_pattern?.toLowerCase().includes(query)
                            )
                            : rules

                        // Create a map of category -> rules
                        const grouped = new Map<string, any[]>()
                        const uncategorized: any[] = []

                        filteredRules.forEach(rule => {
                            const catName = rule.action_category?.name || null
                            if (catName) {
                                if (!grouped.has(catName)) grouped.set(catName, [])
                                grouped.get(catName)!.push(rule)
                            } else {
                                uncategorized.push(rule)
                            }
                        })

                        // Sort categories alphabetically
                        const sortedCategories = Array.from(grouped.entries())
                            .sort((a, b) => a[0].localeCompare(b[0]))

                        return (
                            <>
                                {sortedCategories.map(([categoryName, categoryRules]) => (
                                    <div key={categoryName} className="rounded-lg border border-slate-200 dark:border-zinc-800 overflow-hidden">
                                        {/* Category Header */}
                                        <div className="px-4 py-2 bg-slate-100 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                                            <h4 className="font-bold text-sm flex items-center gap-2">
                                                <ArrowRight className="h-3 w-3 text-emerald-500" />
                                                {categoryName}
                                            </h4>
                                            <span className="text-xs text-muted-foreground">
                                                {categoryRules.length} rule{categoryRules.length !== 1 ? 's' : ''}
                                            </span>
                                        </div>

                                        {/* Rules in this category */}
                                        <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                                            {categoryRules.map((rule, index) => (
                                                <div
                                                    key={rule.id}
                                                    className={`flex items-center gap-4 p-3 transition-all ${rule.is_active
                                                        ? 'bg-white dark:bg-zinc-950'
                                                        : 'bg-slate-50 dark:bg-zinc-900/50 opacity-60'
                                                        }`}
                                                >
                                                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-bold bg-slate-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded">
                                                                P{rule.priority || 100}
                                                            </span>
                                                            <h3 className="font-bold text-sm truncate">{rule.name}</h3>
                                                            {!rule.is_active && (
                                                                <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                                                                    OFF
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="text-right text-xs text-muted-foreground shrink-0">
                                                        <div className="font-bold text-foreground">{rule.match_count || 0}</div>
                                                        <div>matches</div>
                                                    </div>

                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            onClick={() => handleToggle(rule.id, rule.is_active)}
                                                            disabled={processing === rule.id}
                                                            className="h-7 w-7"
                                                            title={rule.is_active ? 'Disable' : 'Enable'}
                                                        >
                                                            {rule.is_active ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4" />}
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            onClick={() => openEditModal(rule)}
                                                            disabled={processing === rule.id}
                                                            className="h-7 w-7"
                                                            title="Edit"
                                                        >
                                                            <Pencil className="h-3 w-3" />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            onClick={() => handleDelete(rule.id)}
                                                            disabled={processing === rule.id}
                                                            className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                            title="Delete"
                                                        >
                                                            {processing === rule.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}

                                {uncategorized.length > 0 && (
                                    <div className="rounded-lg border border-dashed border-slate-300 dark:border-zinc-700 overflow-hidden">
                                        <div className="px-4 py-2 bg-slate-50 dark:bg-zinc-900/50 border-b border-dashed border-slate-300 dark:border-zinc-700">
                                            <h4 className="font-bold text-sm text-muted-foreground">Uncategorized Rules</h4>
                                        </div>
                                        <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                                            {uncategorized.map(rule => (
                                                <div key={rule.id} className="flex items-center gap-4 p-3">
                                                    <span className="text-sm">{rule.name}</span>
                                                    <Button size="sm" variant="outline" onClick={() => openEditModal(rule)}>
                                                        Fix
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )
                    })()}
                </div>
            )}

            {/* Create/Edit Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Zap className="h-5 w-5" />
                            {editingRule ? 'Edit Rule' : 'Create Rule'}
                        </DialogTitle>
                        <DialogDescription>
                            Define matching criteria and the category to apply.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="grid gap-2">
                            <Label>Rule Name</Label>
                            <Input
                                value={formData.name}
                                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="e.g. Amazon Orders"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>Description (optional)</Label>
                            <Input
                                value={formData.description}
                                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="What this rule does..."
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Match Type</Label>
                                <select
                                    value={formData.matchType}
                                    onChange={e => setFormData(prev => ({ ...prev, matchType: e.target.value as any }))}
                                    className="h-10 rounded-md border px-3 text-sm"
                                >
                                    <option value="conditions">⚡ Dynamic Builder</option>
                                    <option value="vendor">By Vendor</option>
                                    <option value="staff">By Staff</option>
                                    <option value="counter_party">By Bank Party Name</option>
                                    <option value="description">By Reference</option>
                                    <option value="amount">By Amount Range</option>
                                    <option value="regex">By Reference Regex</option>
                                    <option value="composite">Composite (Legacy)</option>
                                </select>
                            </div>
                            <div className="grid gap-2">
                                <Label>Transaction Type</Label>
                                <select
                                    value={formData.matchTransactionType || ''}
                                    onChange={e => setFormData(prev => ({ ...prev, matchTransactionType: e.target.value as any || undefined }))}
                                    className="h-10 rounded-md border px-3 text-sm"
                                >
                                    <option value="">Any</option>
                                    <option value="income">Income Only</option>
                                    <option value="expense">Expense Only</option>
                                </select>
                            </div>
                        </div>

                        {/* Dynamic Condition Builder */}
                        {formData.matchType === 'conditions' && (
                            <div className="space-y-3 p-4 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                                        Conditions (ALL must match)
                                    </Label>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={addCondition}
                                        className="h-7 text-xs gap-1"
                                    >
                                        <Plus className="h-3 w-3" /> Add Condition
                                    </Button>
                                </div>

                                {conditions.length === 0 && (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        No conditions yet. Click "Add Condition" to get started.
                                    </p>
                                )}

                                {conditions.map((cond, index) => (
                                    <div key={index} className="flex items-center gap-2 bg-white dark:bg-zinc-900 p-2 rounded-md border">
                                        <select
                                            value={cond.field}
                                            onChange={e => updateCondition(index, { field: e.target.value as any })}
                                            className="h-8 rounded border px-2 text-xs flex-1"
                                        >
                                            <option value="counter_party">Bank Party Name</option>
                                            <option value="reference">Reference/Description</option>
                                            <option value="amount">Amount</option>
                                            <option value="transaction_type">Transaction Type</option>
                                        </select>

                                        {cond.field === 'transaction_type' ? (
                                            <select
                                                value={String(cond.value)}
                                                onChange={e => updateCondition(index, { operator: 'equals', value: e.target.value })}
                                                className="h-8 rounded border px-2 text-xs flex-1"
                                            >
                                                <option value="expense">Is Expense</option>
                                                <option value="income">Is Income</option>
                                            </select>
                                        ) : cond.field === 'amount' ? (
                                            <>
                                                <select
                                                    value={cond.operator}
                                                    onChange={e => updateCondition(index, { operator: e.target.value as any })}
                                                    className="h-8 rounded border px-2 text-xs"
                                                >
                                                    <option value="equals">equals</option>
                                                    <option value="greater_than">greater than</option>
                                                    <option value="less_than">less than</option>
                                                    <option value="between">between</option>
                                                </select>
                                                <Input
                                                    type="number"
                                                    value={cond.value}
                                                    onChange={e => updateCondition(index, { value: parseFloat(e.target.value) || 0 })}
                                                    placeholder="Amount"
                                                    className="h-8 w-20 text-xs"
                                                />
                                                {cond.operator === 'between' && (
                                                    <>
                                                        <span className="text-xs">and</span>
                                                        <Input
                                                            type="number"
                                                            value={cond.value2 || ''}
                                                            onChange={e => updateCondition(index, { value2: parseFloat(e.target.value) || 0 })}
                                                            placeholder="Max"
                                                            className="h-8 w-20 text-xs"
                                                        />
                                                    </>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <select
                                                    value={cond.operator}
                                                    onChange={e => updateCondition(index, { operator: e.target.value as any })}
                                                    className="h-8 rounded border px-2 text-xs"
                                                >
                                                    <option value="contains">contains</option>
                                                    <option value="not_contains">NOT contains</option>
                                                    <option value="equals">equals</option>
                                                    <option value="starts_with">starts with</option>
                                                    <option value="ends_with">ends with</option>
                                                    <option value="regex">regex</option>
                                                </select>
                                                <Input
                                                    value={String(cond.value)}
                                                    onChange={e => updateCondition(index, { value: e.target.value })}
                                                    placeholder="Value"
                                                    className="h-8 flex-1 text-xs"
                                                />
                                            </>
                                        )}

                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeCondition(index)}
                                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Conditional Match Criteria */}
                        {(formData.matchType === 'vendor' || formData.matchType === 'composite') && (
                            <div className="grid gap-2">
                                <Label>Vendor</Label>
                                <select
                                    value={formData.matchVendorId}
                                    onChange={e => setFormData(prev => ({ ...prev, matchVendorId: e.target.value }))}
                                    className="h-10 rounded-md border px-3 text-sm"
                                >
                                    <option value="">— Select Vendor —</option>
                                    {vendors.map(v => (
                                        <option key={v.id} value={v.id}>{v.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {(formData.matchType === 'staff' || formData.matchType === 'composite') && (
                            <div className="grid gap-2">
                                <Label>Staff Member</Label>
                                <select
                                    value={formData.matchStaffId}
                                    onChange={e => setFormData(prev => ({ ...prev, matchStaffId: e.target.value }))}
                                    className="h-10 rounded-md border px-3 text-sm"
                                >
                                    <option value="">— Select Staff —</option>
                                    {staff.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {formData.matchType === 'counter_party' && (
                            <div className="grid gap-2">
                                <Label>Bank Party Name Contains</Label>
                                <Input
                                    value={formData.matchCounterPartyPattern || ''}
                                    onChange={e => setFormData(prev => ({ ...prev, matchCounterPartyPattern: e.target.value }))}
                                    placeholder="e.g. MARYAM or MINDBODY"
                                />
                                <p className="text-[10px] text-muted-foreground">
                                    Matches if the bank counter party name contains this text (case-insensitive).
                                </p>
                            </div>
                        )}

                        {(formData.matchType === 'vendor' || formData.matchType === 'description' || formData.matchType === 'regex' || formData.matchType === 'composite') && (
                            <div className="space-y-3 p-3 bg-slate-50 dark:bg-zinc-900 border rounded-lg">
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="col-span-1">
                                        <Label className="text-xs">
                                            {formData.matchType === 'vendor' ? 'Reference (Optional)' : 'Match Operator'}
                                        </Label>
                                        <select
                                            value={descriptionMode}
                                            onChange={e => setDescriptionMode(e.target.value as any)}
                                            className="w-full mt-1 h-9 rounded-md border px-2 text-xs"
                                        >
                                            <option value="contains">Contains</option>
                                            <option value="exact">Exact Match</option>
                                            <option value="starts_with">Starts With</option>
                                            <option value="ends_with">Ends With</option>
                                            <option value="regex">Regex (Advanced)</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <Label className="text-xs">
                                            {descriptionMode === 'regex' ? 'Regular Expression' : 'Reference Text'}
                                        </Label>
                                        <Input
                                            value={formData.matchDescriptionPattern}
                                            onChange={e => setFormData(prev => ({ ...prev, matchDescriptionPattern: e.target.value }))}
                                            placeholder={descriptionMode === 'regex' ? '^SALARY.*' : 'AMAZON'}
                                            className="mt-1 h-9"
                                        />
                                    </div>
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                    {descriptionMode === 'contains' && "Matches if the text appears anywhere in the reference."}
                                    {descriptionMode === 'exact' && "Matches only if the reference is exactly this text."}
                                    {descriptionMode === 'starts_with' && "Matches if the reference starts with this text."}
                                    {descriptionMode === 'regex' && "Use standard Regex syntax manually."}
                                </p>
                            </div>
                        )}

                        {(formData.matchType === 'amount' || formData.matchType === 'composite') && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Min Amount (£)</Label>
                                    <Input
                                        type="number"
                                        value={formData.matchAmountMin || ''}
                                        onChange={e => setFormData(prev => ({ ...prev, matchAmountMin: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Max Amount (£)</Label>
                                    <Input
                                        type="number"
                                        value={formData.matchAmountMax || ''}
                                        onChange={e => setFormData(prev => ({ ...prev, matchAmountMax: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                        placeholder="∞"
                                    />
                                </div>
                            </div>
                        )}

                        <hr className="my-4" />

                        <div className="grid gap-2">
                            <Label>Assign Category</Label>
                            <select
                                value={formData.actionCategoryId}
                                onChange={e => setFormData(prev => ({ ...prev, actionCategoryId: e.target.value }))}
                                className="h-10 rounded-md border px-3 text-sm"
                            >
                                <option value="">— Select Category —</option>
                                {categories.filter(c => !c.parent_id).map(parent => (
                                    <optgroup key={parent.id} label={parent.name}>
                                        <option value={parent.id}>{parent.name}</option>
                                        {categories.filter(c => c.parent_id === parent.id).map(sub => (
                                            <option key={sub.id} value={sub.id}>{sub.name}</option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Assign Vendor (optional)</Label>
                                <select
                                    value={formData.actionVendorId}
                                    onChange={e => setFormData(prev => ({ ...prev, actionVendorId: e.target.value }))}
                                    className="h-10 rounded-md border px-3 text-sm"
                                >
                                    <option value="">— No Vendor —</option>
                                    {vendors.map(v => (
                                        <option key={v.id} value={v.id}>{v.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid gap-2">
                                <Label>Assign Staff (optional)</Label>
                                <select
                                    value={formData.actionStaffId}
                                    onChange={e => setFormData(prev => ({ ...prev, actionStaffId: e.target.value }))}
                                    className="h-10 rounded-md border px-3 text-sm"
                                >
                                    <option value="">— No Staff —</option>
                                    {staff.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label>Auto-Add Notes (optional)</Label>
                            <Input
                                value={formData.actionNotesTemplate}
                                onChange={e => setFormData(prev => ({ ...prev, actionNotesTemplate: e.target.value }))}
                                placeholder="Auto-categorized by rule"
                            />
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                            <input
                                type="checkbox"
                                checked={formData.requiresApproval}
                                onChange={e => setFormData(prev => ({ ...prev, requiresApproval: e.target.checked }))}
                                className="rounded"
                            />
                            <div>
                                <p className="text-sm font-bold">Require Approval</p>
                                <p className="text-xs text-muted-foreground">
                                    When enabled, matches queue for your review before applying.
                                </p>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
                        <Button type="button" variant="ghost" onClick={handlePreview} disabled={processing === 'preview'} className="gap-2 text-indigo-600">
                            {processing === 'preview' ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
                            Test Rule
                        </Button>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                            <Button
                                onClick={handleSave}
                                disabled={!formData.name || processing === 'save'}
                                className="bg-indigo-600 hover:bg-indigo-700"
                            >
                                {processing === 'save' && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                {editingRule ? 'Update Rule' : 'Create Rule'}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Test Results Modal */}
            <Dialog open={!!testResults} onOpenChange={() => setTestResults(null)}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <TestTube className="h-5 w-5" />
                            Test Results: {testResults?.rule?.name}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="py-4">
                        <div className="text-center p-4 bg-slate-50 dark:bg-zinc-900 rounded-lg mb-4">
                            <div className="text-3xl font-black">{testResults?.matchCount || 0}</div>
                            <div className="text-sm text-muted-foreground">unreconciled transactions would match</div>
                        </div>

                        {testResults?.sampleMatches?.length > 0 && (
                            <div className="space-y-2">
                                <Label>Sample Matches</Label>
                                <div className="max-h-48 overflow-y-auto space-y-1">
                                    {testResults.sampleMatches.slice(0, 10).map((tx: any) => (
                                        <div key={tx.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-zinc-900 rounded text-sm">
                                            <span className="truncate flex-1">{tx.description}</span>
                                            <span className="font-bold ml-2">£{Math.abs(tx.amount).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button onClick={() => setTestResults(null)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
