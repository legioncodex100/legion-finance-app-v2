"use server"

import { createClient } from "@/lib/supabase/server"

// Condition types for dynamic rule builder
export type ConditionField = 'counter_party' | 'reference' | 'amount' | 'transaction_type'
export type ConditionOperator = 'contains' | 'not_contains' | 'equals' | 'starts_with' | 'ends_with' | 'regex' | 'greater_than' | 'less_than' | 'between'

export interface RuleCondition {
    field: ConditionField
    operator: ConditionOperator
    value: string | number
    value2?: number // For 'between' operator
}

export interface CreateRuleData {
    name: string
    description?: string
    priority?: number
    matchType: 'vendor' | 'staff' | 'description' | 'amount' | 'regex' | 'composite' | 'counter_party' | 'conditions'
    conditions?: RuleCondition[]
    matchVendorId?: string
    matchStaffId?: string
    matchDescriptionPattern?: string
    matchCounterPartyPattern?: string
    matchAmountMin?: number
    matchAmountMax?: number
    matchTransactionType?: 'income' | 'expense'
    actionCategoryId?: string
    actionStaffId?: string
    actionVendorId?: string
    actionNotesTemplate?: string
    requiresApproval?: boolean
}

export async function createRule(data: CreateRuleData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { data: rule, error } = await supabase
        .from('reconciliation_rules')
        .insert({
            user_id: user.id,
            name: data.name,
            description: data.description,
            priority: data.priority ?? 100,
            match_type: data.matchType,
            conditions: data.conditions || [],
            match_vendor_id: data.matchVendorId || null,
            match_staff_id: data.matchStaffId || null,
            match_description_pattern: data.matchDescriptionPattern || null,
            match_counter_party_pattern: data.matchCounterPartyPattern || null,
            match_amount_min: data.matchAmountMin,
            match_amount_max: data.matchAmountMax,
            match_transaction_type: data.matchTransactionType || null,
            action_category_id: data.actionCategoryId || null,
            action_staff_id: data.actionStaffId || null,
            action_vendor_id: data.actionVendorId || null,
            action_notes_template: data.actionNotesTemplate || null,
            requires_approval: data.requiresApproval ?? true,
            is_active: true
        })
        .select()
        .single()

    if (error) throw error
    return rule
}

export async function updateRule(id: string, data: Partial<CreateRuleData> & { isActive?: boolean }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const updateData: any = { updated_at: new Date().toISOString() }

    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.priority !== undefined) updateData.priority = data.priority
    if (data.matchType !== undefined) updateData.match_type = data.matchType
    if (data.conditions !== undefined) updateData.conditions = data.conditions
    if (data.matchVendorId !== undefined) updateData.match_vendor_id = data.matchVendorId || null
    if (data.matchStaffId !== undefined) updateData.match_staff_id = data.matchStaffId || null
    if (data.matchDescriptionPattern !== undefined) updateData.match_description_pattern = data.matchDescriptionPattern || null
    if (data.matchCounterPartyPattern !== undefined) updateData.match_counter_party_pattern = data.matchCounterPartyPattern || null
    if (data.matchAmountMin !== undefined) updateData.match_amount_min = data.matchAmountMin
    if (data.matchAmountMax !== undefined) updateData.match_amount_max = data.matchAmountMax
    if (data.matchTransactionType !== undefined) updateData.match_transaction_type = data.matchTransactionType || null
    if (data.actionCategoryId !== undefined) updateData.action_category_id = data.actionCategoryId || null
    if (data.actionStaffId !== undefined) updateData.action_staff_id = data.actionStaffId || null
    if (data.actionVendorId !== undefined) updateData.action_vendor_id = data.actionVendorId || null
    if (data.actionNotesTemplate !== undefined) updateData.action_notes_template = data.actionNotesTemplate || null
    if (data.requiresApproval !== undefined) updateData.requires_approval = data.requiresApproval
    if (data.isActive !== undefined) updateData.is_active = data.isActive

    const { error } = await supabase
        .from('reconciliation_rules')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    return { success: true }
}

export async function deleteRule(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { error } = await supabase
        .from('reconciliation_rules')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    return { success: true }
}

export async function getRules() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { data: rules, error } = await supabase
        .from('reconciliation_rules')
        .select('*')
        .eq('user_id', user.id)
        .order('priority', { ascending: true })

    if (error) throw error

    if (!rules || rules.length === 0) return []

    // Fetch vendors, staff, and categories separately for name lookup
    const { data: vendors } = await supabase.from('vendors').select('id, name')
    const { data: staff } = await supabase.from('staff').select('id, name, role')
    const { data: categories } = await supabase.from('categories').select('id, name')

    const vendorMap = new Map((vendors || []).map(v => [v.id, v.name]))
    const staffMap = new Map((staff || []).map(s => [s.id, { name: s.name, role: s.role }]))
    const categoryMap = new Map((categories || []).map(c => [c.id, c.name]))

    return rules.map(rule => ({
        ...rule,
        match_vendor: rule.match_vendor_id ? { id: rule.match_vendor_id, name: vendorMap.get(rule.match_vendor_id) || 'Unknown' } : null,
        match_staff: rule.match_staff_id ? { id: rule.match_staff_id, ...staffMap.get(rule.match_staff_id) || { name: 'Unknown', role: 'staff' } } : null,
        action_category: rule.action_category_id ? { id: rule.action_category_id, name: categoryMap.get(rule.action_category_id) || 'Unknown' } : null
    }))
}

export async function toggleRuleActive(id: string, isActive: boolean) {
    return updateRule(id, { isActive })
}

export async function testRule(ruleId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Get the rule
    const { data: rule, error: ruleError } = await supabase
        .from('reconciliation_rules')
        .select('*')
        .eq('id', ruleId)
        .eq('user_id', user.id)
        .single()

    if (ruleError || !rule) throw new Error("Rule not found")

    // Find matching transactions (preview only)
    let query = supabase
        .from('transactions')
        .select('id, description, amount, transaction_date, type, vendors(name)')
        .eq('user_id', user.id)
        .eq('reconciliation_status', 'unreconciled')
        .limit(50)

    // Apply match criteria based on rule type
    if (rule.match_type === 'vendor' && rule.match_vendor_id) {
        query = query.eq('vendor_id', rule.match_vendor_id)
    }
    if (rule.match_type === 'description' && rule.match_description_pattern) {
        query = query.ilike('description', `%${rule.match_description_pattern}%`)
    }
    if (rule.match_type === 'amount') {
        if (rule.match_amount_min) query = query.gte('amount', rule.match_amount_min)
        if (rule.match_amount_max) query = query.lte('amount', rule.match_amount_max)
    }
    if (rule.match_transaction_type) {
        query = query.eq('type', rule.match_transaction_type)
    }

    const { data: matches, error } = await query

    if (error) throw error
    return {
        rule,
        matchCount: matches?.length || 0,
        sampleMatches: matches || []
    }
}

export async function previewRule(data: CreateRuleData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Find matching transactions (preview only)
    let query = supabase
        .from('transactions')
        .select('id, description, amount, transaction_date, type, raw_party, vendor_id, staff_id, vendors(name)')
        .eq('user_id', user.id)
        .eq('reconciliation_status', 'unreconciled')
        .limit(100)

    // Apply match criteria based on rule type
    if (data.matchType === 'vendor' && data.matchVendorId) {
        query = query.eq('vendor_id', data.matchVendorId)
    }
    if (data.matchType === 'description' && data.matchDescriptionPattern) {
        query = query.ilike('description', `%${data.matchDescriptionPattern}%`)
    }
    if (data.matchType === 'amount') {
        if (data.matchAmountMin) query = query.gte('amount', data.matchAmountMin)
        if (data.matchAmountMax) query = query.lte('amount', data.matchAmountMax)
    }
    if (data.matchTransactionType) {
        query = query.eq('type', data.matchTransactionType)
    }

    // For regex, composite, counter_party, and conditions - fetch and filter in memory
    const { data: candidates, error } = await query

    if (error) throw error
    if (!candidates) return { matchCount: 0, sampleMatches: [] }

    // In-memory filter for complex types
    const matches = candidates.filter(tx => {
        // We construct a mock rule object to reuse evaluateRule logic
        const mockRule = {
            match_type: data.matchType,
            conditions: data.conditions || [],
            match_vendor_id: data.matchVendorId,
            match_staff_id: data.matchStaffId,
            match_description_pattern: data.matchDescriptionPattern,
            match_counter_party_pattern: data.matchCounterPartyPattern,
            match_amount_min: data.matchAmountMin,
            match_amount_max: data.matchAmountMax,
            match_transaction_type: data.matchTransactionType
        }
        return evaluateRule(mockRule, tx)
    })

    return {
        matchCount: matches.length,
        sampleMatches: matches.slice(0, 20)
    }
}

// Run all active rules against unreconciled transactions
export async function runRulesEngine(options?: { includeConfirmed?: boolean }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const includeConfirmed = options?.includeConfirmed ?? false

    // 1. Get all active rules ordered by priority
    const { data: rules, error: rulesError } = await supabase
        .from('reconciliation_rules')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('priority', { ascending: true })

    if (rulesError) throw rulesError
    if (!rules || rules.length === 0) return { processed: 0, matched: 0, alreadyReconciled: 0 }

    // 2. Fetch transactions in batches
    const BATCH_SIZE = 1000
    let processedCount = 0
    let matchedCount = 0
    let alreadyReconciledCount = 0
    const pendingMatches: any[] = []

    let offset = 0
    let hasMore = true

    while (hasMore) {
        let query = supabase
            .from('transactions')
            .select('*')
            .eq('user_id', user.id)

        // If not including confirmed, only get unreconciled
        if (!includeConfirmed) {
            query = query.eq('reconciliation_status', 'unreconciled')
        }

        const { data: transactions, error: txError } = await query.range(offset, offset + BATCH_SIZE - 1)

        if (txError) throw txError
        if (!transactions || transactions.length === 0) {
            hasMore = false
            break
        }

        processedCount += transactions.length

        // Process this batch
        for (const tx of transactions) {
            for (const rule of rules) {
                if (evaluateRule(rule, tx)) {
                    const isAlreadyReconciled = tx.confirmed === true || tx.reconciliation_status === 'reconciled'

                    pendingMatches.push({
                        user_id: user.id,
                        transaction_id: tx.id,
                        rule_id: rule.id,
                        suggested_category_id: rule.action_category_id,
                        suggested_staff_id: rule.action_staff_id,
                        suggested_vendor_id: rule.action_vendor_id,
                        suggested_notes: rule.action_notes_template,
                        match_confidence: 1.0,
                        status: 'pending',
                        // Track locally for counting
                        _wasReconciled: isAlreadyReconciled
                    })

                    if (isAlreadyReconciled) {
                        alreadyReconciledCount++
                    }
                    matchedCount++
                    break // First rule wins
                }
            }
        }

        offset += BATCH_SIZE
        hasMore = transactions.length === BATCH_SIZE
    }

    // 3. Bulk insert pending matches
    if (pendingMatches.length > 0) {
        // Strip internal tracking properties before DB insert
        const dbMatches = pendingMatches.map(({ _wasReconciled, ...rest }) => rest)

        const { error: insertError } = await supabase
            .from('pending_matches')
            .upsert(dbMatches, { onConflict: 'transaction_id,rule_id' })

        if (insertError) throw insertError

        // Update transaction statuses (only for non-reconciled ones)
        const matchedTxIds = pendingMatches
            .filter(m => !m._wasReconciled)
            .map(m => m.transaction_id)

        // Chunk status updates if too many
        for (let i = 0; i < matchedTxIds.length; i += 100) {
            const batchIds = matchedTxIds.slice(i, i + 100)
            await supabase
                .from('transactions')
                .update({ reconciliation_status: 'pending_approval' })
                .in('id', batchIds)
        }

        // Update rule match counts
        for (const rule of rules) {
            const ruleMatches = pendingMatches.filter(m => m.rule_id === rule.id).length
            if (ruleMatches > 0) {
                await supabase
                    .from('reconciliation_rules')
                    .update({
                        match_count: (rule.match_count || 0) + ruleMatches,
                        last_matched_at: new Date().toISOString()
                    })
                    .eq('id', rule.id)
            }
        }
    }

    return { processed: processedCount, matched: matchedCount, alreadyReconciled: alreadyReconciledCount }
}

// Helper function to evaluate if a transaction matches a rule
function evaluateRule(rule: any, tx: any): boolean {
    // Check transaction type filter first (income/expense)
    if (rule.match_transaction_type && rule.match_transaction_type !== tx.type) {
        return false
    }

    const description = tx.description || ''
    const pattern = rule.match_description_pattern || ''

    // Inner helper for text matching logic (shared by multiple match types)
    const matchText = (text: string, pat: string, type: string) => {
        if (!pat) return true // No pattern means it matches (pass-through)

        if (type === 'regex') {
            try {
                const regex = new RegExp(pat, 'i')
                return regex.test(text)
            } catch {
                return false
            }
        }

        // Default to contains (case-insensitive)
        return text.toLowerCase().includes(pat.toLowerCase())
    }

    switch (rule.match_type) {
        case 'vendor':
            // Must match vendor ID
            if (!rule.match_vendor_id || tx.vendor_id !== rule.match_vendor_id) {
                return false
            }
            // Optional: Must ALSO match reference if pattern is provided
            return matchText(description, pattern, 'regex')

        case 'staff':
            // Must match staff ID
            if (!rule.match_staff_id || tx.staff_id !== rule.match_staff_id) {
                return false
            }
            // Optional: Must ALSO match reference if pattern is provided
            return matchText(description, pattern, 'regex')

        case 'counter_party':
            // Match against the raw_party (bank counter party name)
            const partyName = tx.raw_party?.toLowerCase() || ''
            const partyPattern = rule.match_counter_party_pattern?.toLowerCase() || ''
            return partyName.includes(partyPattern) || partyPattern.includes(partyName)

        case 'description':
        case 'regex':
            return matchText(description, pattern, rule.match_type)

        case 'amount':
            const amount = Math.abs(parseFloat(tx.amount))
            const minOk = !rule.match_amount_min || amount >= parseFloat(rule.match_amount_min)
            const maxOk = !rule.match_amount_max || amount <= parseFloat(rule.match_amount_max)
            return minOk && maxOk

        case 'composite':
            // Composite matches all specified criteria
            if (rule.match_vendor_id && tx.vendor_id !== rule.match_vendor_id) return false
            if (rule.match_staff_id && tx.staff_id !== rule.match_staff_id) return false
            if (rule.match_description_pattern && !matchText(description, pattern, 'regex')) return false

            if (rule.match_amount_min || rule.match_amount_max) {
                const amt = Math.abs(parseFloat(tx.amount))
                if (rule.match_amount_min && amt < parseFloat(rule.match_amount_min)) return false
                if (rule.match_amount_max && amt > parseFloat(rule.match_amount_max)) return false
            }
            return true

        case 'conditions':
            // Dynamic conditions - ALL must match (AND logic)
            const conditions = rule.conditions as Array<{ field: string, operator: string, value: string | number, value2?: number }> || []
            if (conditions.length === 0) return false

            for (const cond of conditions) {
                const condValue = String(cond.value).toLowerCase()
                let fieldValue = ''

                // Get the field value
                switch (cond.field) {
                    case 'counter_party':
                        fieldValue = (tx.raw_party || '').toLowerCase()
                        break
                    case 'reference':
                        fieldValue = description.toLowerCase()
                        break
                    case 'amount':
                        // Handle amount separately
                        const txAmount = Math.abs(parseFloat(tx.amount))
                        const condAmount = parseFloat(String(cond.value))
                        switch (cond.operator) {
                            case 'equals':
                                if (txAmount !== condAmount) return false
                                break
                            case 'greater_than':
                                if (txAmount <= condAmount) return false
                                break
                            case 'less_than':
                                if (txAmount >= condAmount) return false
                                break
                            case 'between':
                                const max = cond.value2 || condAmount
                                if (txAmount < condAmount || txAmount > max) return false
                                break
                        }
                        continue // Skip text operators
                    case 'transaction_type':
                        const isExpense = parseFloat(tx.amount) < 0
                        const wantsExpense = condValue === 'expense'
                        if (isExpense !== wantsExpense) return false
                        continue
                    default:
                        continue
                }

                // Apply text operators
                switch (cond.operator) {
                    case 'contains':
                        if (!fieldValue.includes(condValue)) return false
                        break
                    case 'not_contains':
                        if (fieldValue.includes(condValue)) return false
                        break
                    case 'equals':
                        if (fieldValue !== condValue) return false
                        break
                    case 'starts_with':
                        if (!fieldValue.startsWith(condValue)) return false
                        break
                    case 'ends_with':
                        if (!fieldValue.endsWith(condValue)) return false
                        break
                    case 'regex':
                        try {
                            const regex = new RegExp(String(cond.value), 'i')
                            if (!regex.test(fieldValue)) return false
                        } catch {
                            return false
                        }
                        break
                }
            }
            return true // All conditions passed

        default:
            return false
    }
}
