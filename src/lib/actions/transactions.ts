"use server"

import { createClient } from "@/lib/supabase/server"
import { categorizeTransaction, suggestCategoryName } from "@/lib/ai/gemini"
import { runRulesEngine } from "@/lib/actions/rules"

export async function importTransactions(data: any[]) {
    const supabase = await createClient()

    // 0. Get current user for RLS
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        console.error("IMPORT ERROR: No authenticated user found")
        throw new Error("Unauthorized: Please log in to import transactions.")
    }

    console.log(`[IMPORT] Starting import of ${data.length} transactions from CSV`)

    // Skip duplicate check - user should wipe data before re-importing
    // This ensures all transactions get imported without filtering issues
    const newTransactions = data

    if (newTransactions.length === 0) return { count: 0, message: "No transactions to import.", pendingApprovals: 0 }

    // Fetch all staff and vendors for auto-linking
    const [staffResult, vendorsResult] = await Promise.all([
        supabase.from('staff').select('id, name').eq('user_id', user.id),
        supabase.from('vendors').select('id, name').eq('user_id', user.id)
    ])

    const staffList = staffResult.data || []
    const vendorList = vendorsResult.data || []

    // Helper: Find matching staff/vendor by counter party name (case-insensitive contains)
    const findMatch = (partyName: string | null): { staffId: string | null, vendorId: string | null } => {
        if (!partyName) return { staffId: null, vendorId: null }

        const partyLower = partyName.toLowerCase().trim()

        // Check staff first (prioritize staff over vendors for same-name matches)
        for (const s of staffList) {
            const staffLower = s.name.toLowerCase().trim()
            // Check if party contains staff name OR staff name contains party
            if (partyLower.includes(staffLower) || staffLower.includes(partyLower)) {
                console.log(`[AUTO-LINK] "${partyName}" matched to staff: ${s.name}`)
                return { staffId: s.id, vendorId: null }
            }
        }

        // Then check vendors
        for (const v of vendorList) {
            const vendorLower = v.name.toLowerCase().trim()
            if (partyLower.includes(vendorLower) || vendorLower.includes(partyLower)) {
                console.log(`[AUTO-LINK] "${partyName}" matched to vendor: ${v.name}`)
                return { staffId: null, vendorId: v.id }
            }
        }

        return { staffId: null, vendorId: null }
    }

    // Build transaction records with auto-linking
    const BATCH_SIZE = 500
    let autoLinkedCount = 0

    const dbTransactions = newTransactions.map(t => {
        const numericAmount = Number(parseFloat(String(t.amount)) || 0)
        const { staffId, vendorId } = findMatch(t.party)

        if (staffId || vendorId) autoLinkedCount++

        return {
            amount: t.type === 'expense' ? -Math.abs(numericAmount) : Math.abs(numericAmount),
            description: t.description,
            raw_party: t.party || null,
            vendor_id: vendorId,
            staff_id: staffId,
            transaction_date: t.date,
            confirmed: false,
            type: t.type,
            import_hash: t.importHash,
            user_id: user.id,
            ai_suggested: 'UNIDENTIFIED',
            reconciliation_status: 'unreconciled',
            bank_category: t.aiSuggestedCategory || null
        }
    })

    console.log(`[IMPORT] Auto-linked ${autoLinkedCount} of ${dbTransactions.length} transactions to staff/vendors`)

    // Insert in batches to avoid Supabase limits
    for (let i = 0; i < dbTransactions.length; i += BATCH_SIZE) {
        const batch = dbTransactions.slice(i, i + BATCH_SIZE)
        const { error: insertError } = await supabase
            .from('transactions')
            .insert(batch)

        if (insertError) {
            console.error(`DB Insert Error (Batch ${i / BATCH_SIZE + 1}):`, insertError)
            throw new Error(`Failed to save transactions: ${insertError.message}`)
        }
    }

    // 4. Run reconciliation rules engine to generate pending matches
    let pendingApprovals = 0
    try {
        const rulesResult = await runRulesEngine()
        pendingApprovals = rulesResult.matched
        console.log(`[IMPORT] Rules engine matched ${pendingApprovals} transactions`)
    } catch (e) {
        console.error("[IMPORT] Rules engine error:", e)
        // Don't fail the import if rules engine fails
    }

    return {
        count: newTransactions.length,
        message: `Successfully imported ${newTransactions.length} transactions.${autoLinkedCount > 0 ? ` ${autoLinkedCount} auto-linked to staff/vendors.` : ''}${pendingApprovals > 0 ? ` ${pendingApprovals} matched by rules and awaiting approval.` : ''}`,
        pendingApprovals,
        autoLinkedCount
    }
}

export async function runAICategorization() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Find transactions needing categorization
    const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('ai_suggested', 'UNIDENTIFIED')
        .limit(50) // Batch for Gemini safety

    if (!transactions || transactions.length === 0) return { count: 0 }

    const categoryCache = new Map<string, string>();

    const toProcess = transactions;
    let processedCount = 0;

    for (const t of toProcess) {
        try {
            const categoryString = await categorizeTransaction(t.description, Math.abs(parseFloat(t.amount)), t.type)

            let categoryId = null;
            if (categoryString && !categoryString.includes("UNIDENTIFIED")) {
                if (categoryCache.has(categoryString)) {
                    categoryId = categoryCache.get(categoryString);
                } else {
                    const parts = categoryString.split('>').map(s => s.trim());
                    const parentName = parts[0];
                    const subName = parts[1];

                    // Find/Create Parent
                    let { data: parent } = await supabase
                        .from('categories')
                        .select('id')
                        .eq('name', parentName)
                        .is('parent_id', null)
                        .maybeSingle();

                    if (!parent) {
                        const { data: newParent, error: pErr } = await supabase
                            .from('categories')
                            .insert({ name: parentName, type: t.type, user_id: user.id })
                            .select('id')
                            .single();

                        if (pErr) {
                            // Fetch again to be sure
                            const { data: retryParent } = await supabase
                                .from('categories')
                                .select('id')
                                .eq('name', parentName)
                                .is('parent_id', null)
                                .single();
                            parent = retryParent;
                        } else {
                            parent = newParent;
                        }
                    }

                    if (subName && parent) {
                        // Find/Create Sub
                        let { data: sub } = await supabase
                            .from('categories')
                            .select('id')
                            .eq('name', subName)
                            .eq('parent_id', parent.id)
                            .maybeSingle();

                        if (!sub) {
                            const { data: newSub, error: sErr } = await supabase
                                .from('categories')
                                .insert({ name: subName, parent_id: parent.id, type: t.type, user_id: user.id })
                                .select('id')
                                .single();

                            if (sErr) {
                                const { data: retrySub } = await supabase
                                    .from('categories')
                                    .select('id')
                                    .eq('name', subName)
                                    .eq('parent_id', parent.id)
                                    .single();
                                sub = retrySub;
                            } else {
                                sub = newSub;
                            }
                        }
                        categoryId = sub?.id;
                    } else {
                        categoryId = parent?.id;
                    }
                    if (categoryId) categoryCache.set(categoryString, categoryId);
                }
            }

            // Update individual transaction
            await supabase
                .from('transactions')
                .update({
                    ai_suggested: categoryString,
                    category_id: categoryId
                })
                .eq('id', t.id)

            processedCount++;
        } catch (err) {
            console.error(`Error categorizing transaction ${t.id}:`, err);
        }
    }

    return { count: processedCount }
}

export async function deleteTransactions(ids: string[]) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { error } = await supabase
        .from('transactions')
        .delete()
        .in('id', ids)
        .eq('user_id', user.id)

    if (error) throw error
    return { success: true }
}

export async function uncategorizeTransactions(ids: string[]) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { error } = await supabase
        .from('transactions')
        .update({
            category_id: null,
            confirmed: false
        })
        .in('id', ids)
        .eq('user_id', user.id)

    if (error) throw error
    return { success: true }
}

export async function bulkReconcileTransactions(ids: string[], categoryId?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const updateData: any = {
        confirmed: true,
        reconciliation_status: 'reconciled'
    }

    if (categoryId) {
        updateData.category_id = categoryId
    }

    const { error } = await supabase
        .from('transactions')
        .update(updateData)
        .in('id', ids)
        .eq('user_id', user.id)

    if (error) throw error
    return { success: true }
}

export async function deleteCategories(ids: string[]) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // First, clear references in reconciliation_rules
    await supabase
        .from('reconciliation_rules')
        .update({ action_category_id: null })
        .in('action_category_id', ids)
        .eq('user_id', user.id)

    // Clear category from transactions
    await supabase
        .from('transactions')
        .update({ category_id: null, confirmed: false })
        .in('category_id', ids)
        .eq('user_id', user.id)

    // Delete subcategories first (children)
    const { data: subcats } = await supabase
        .from('categories')
        .select('id')
        .in('parent_id', ids)
        .eq('user_id', user.id)

    if (subcats && subcats.length > 0) {
        const subIds = subcats.map(s => s.id)
        // Recursively handle subcategory references
        await supabase
            .from('reconciliation_rules')
            .update({ action_category_id: null })
            .in('action_category_id', subIds)
            .eq('user_id', user.id)

        await supabase
            .from('transactions')
            .update({ category_id: null, confirmed: false })
            .in('category_id', subIds)
            .eq('user_id', user.id)

        await supabase
            .from('categories')
            .delete()
            .in('id', subIds)
            .eq('user_id', user.id)
    }

    // Now delete the main categories
    const { error } = await supabase
        .from('categories')
        .delete()
        .in('id', ids)
        .eq('user_id', user.id)

    if (error) throw error
    return { success: true }
}

export async function getCategoryTransactionCount(categoryId: string): Promise<number> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { count } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', categoryId)
        .eq('user_id', user.id)

    return count || 0
}

export async function migrateTransactionsToCategory(fromCategoryId: string, toCategoryId: string | null): Promise<{ success: boolean, count: number }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Get count first
    const { count } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', fromCategoryId)
        .eq('user_id', user.id)

    // Migrate transactions
    const { error } = await supabase
        .from('transactions')
        .update({
            category_id: toCategoryId,
            confirmed: toCategoryId ? true : false // Re-set to unconfirmed if uncategorizing
        })
        .eq('category_id', fromCategoryId)
        .eq('user_id', user.id)

    if (error) throw error
    return { success: true, count: count || 0 }
}

export async function clearLedgerData() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // L1: Clear transactions & pending matches
    await supabase.from('pending_matches').delete().eq('user_id', user.id)
    await supabase.from('transactions').delete().eq('user_id', user.id)

    return { success: true }
}

export async function clearConfigurationData() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // L2: Clear categories & vendors
    // Transactions must be gone or updated first to avoid FK errors
    await supabase.from('categories').delete().eq('user_id', user.id)
    await supabase.from('vendors').delete().eq('user_id', user.id)

    return { success: true }
}

export async function clearAllFinancialData() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // L3: Factory Reset
    await supabase.from('pending_matches').delete().eq('user_id', user.id)
    await supabase.from('transactions').delete().eq('user_id', user.id)
    await supabase.from('coach_invoices').delete().eq('user_id', user.id)
    await supabase.from('client_invoices').delete().eq('user_id', user.id)
    await supabase.from('recurring_bills').delete().eq('user_id', user.id)
    await supabase.from('debts').delete().eq('user_id', user.id)
    await supabase.from('categories').delete().eq('user_id', user.id)
    await supabase.from('vendors').delete().eq('user_id', user.id)

    return { success: true }
}

export async function updateTransactionDetails(transactionId: string, data: { categoryId?: string | null, notes?: string, vendorId?: string | null, staffId?: string | null }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const updateData: any = {
        confirmed: true
    }

    if (data.categoryId !== undefined) updateData.category_id = data.categoryId
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.vendorId !== undefined) updateData.vendor_id = data.vendorId
    if (data.staffId !== undefined) updateData.staff_id = data.staffId

    const { error } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', transactionId)
        .eq('user_id', user.id)

    if (error) throw error
    return { success: true }
}

export async function quickCreateCategory(name: string, type: 'income' | 'expense', parentId?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { data, error } = await supabase
        .from('categories')
        .insert({
            name,
            type,
            parent_id: parentId || null,
            user_id: user.id
        })
        .select()
        .single()

    if (error) throw error
    return data
}

export async function migrateCategoriesToClasses() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // 1. Fetch Classes for mapping
    const { data: classes } = await supabase.from('financial_classes').select('id, name')
    if (!classes) return { success: false, message: "No classes found" }

    const findClassId = (name: string) => classes.find(c => c.name === name)?.id

    // 2. Fetch all categories that lack a class_id
    const { data: categories } = await supabase
        .from('categories')
        .select('*')
        .is('class_id', null)
        .eq('user_id', user.id)

    if (!categories || categories.length === 0) return { success: true, message: "No categories need migration" }

    // 3. Perform mapping
    for (const cat of categories) {
        let classId = null

        if (cat.group_name === 'operating') {
            classId = cat.type === 'income' ? findClassId('Revenue') : findClassId('Operating Expenses (OPEX)')
        } else if (cat.group_name === 'financing') {
            classId = findClassId('Financing')
        } else if (cat.group_name === 'investing') {
            classId = findClassId('Investing')
        }

        if (classId) {
            await supabase.from('categories').update({ class_id: classId }).eq('id', cat.id)
        }
    }

    return { success: true, count: categories.length }
}

export async function getFinancialClasses() {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('financial_classes')
        .select('*')
        .order('sort_order', { ascending: true })

    if (error) throw error
    return data || []
}

export async function createCategory(data: { name: string, type: 'income' | 'expense', parentId?: string, groupName?: string, classId?: string | null, code?: string, description?: string }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // If creating a subcategory and classId not provided, inherit from parent
    let finalClassId = data.classId ?? null
    let finalCode = data.code ?? null

    if (data.parentId) {
        // Fetch parent for class_id and code
        const { data: parent, error: parentErr } = await supabase
            .from('categories')
            .select('class_id, code')
            .eq('id', data.parentId)
            .single()

        if (parentErr) {
            console.error('Failed to fetch parent:', parentErr)
        } else {
            // Inherit class_id if not provided
            if (finalClassId === null) {
                finalClassId = parent?.class_id ?? null
            }

            // Auto-generate code for subcategory - find next available
            if (!finalCode && parent?.code) {
                const parentCodeNum = parseInt(parent.code, 10)
                const maxCode = parentCodeNum + 999 // e.g., 2000 → max 2999

                // Get all existing codes in the same series (e.g., 2100-2999 for parent 2000)
                const { data: existingCodes } = await supabase
                    .from('categories')
                    .select('code')
                    .eq('user_id', user.id)
                    .gt('code', String(parentCodeNum))
                    .lte('code', String(maxCode))

                const usedCodes = new Set((existingCodes || []).map(c => c.code))

                // Find next available code in increments of 100 (2100, 2200, ..., 2900)
                for (let i = 1; i <= 9; i++) {
                    const candidateCode = String(parentCodeNum + (i * 100))
                    if (parseInt(candidateCode, 10) <= maxCode && !usedCodes.has(candidateCode)) {
                        finalCode = candidateCode
                        break
                    }
                }

                // If all X100 codes used, try X10 increments (2010, 2020, ..., 2990)
                if (!finalCode) {
                    for (let i = 1; i <= 99; i++) {
                        const candidateCode = String(parentCodeNum + i * 10)
                        if (parseInt(candidateCode, 10) <= maxCode && !usedCodes.has(candidateCode)) {
                            finalCode = candidateCode
                            break
                        }
                    }
                }

                // If still no code, category range is full
                if (!finalCode) {
                    throw new Error(`No available code slots under parent ${parent.code}. Max subcategories reached.`)
                }
            }
        }
    }

    const { data: result, error } = await supabase
        .from('categories')
        .insert({
            code: finalCode,
            name: data.name,
            description: data.description || null,
            type: data.type,
            parent_id: data.parentId || null,
            group_name: data.groupName || 'operating',
            class_id: finalClassId,
            user_id: user.id
        })
        .select()
        .single()

    if (error) throw error
    return result
}

export async function updateCategory(id: string, data: { name?: string, type?: 'income' | 'expense', groupName?: string, classId?: string | null, code?: string, description?: string }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const updateData: any = {}
    if (data.name) updateData.name = data.name
    if (data.type) updateData.type = data.type
    if (data.groupName) updateData.group_name = data.groupName
    if (data.classId !== undefined) updateData.class_id = data.classId ?? null
    if (data.code !== undefined) updateData.code = data.code
    if (data.description !== undefined) updateData.description = data.description || null

    const { error } = await supabase
        .from('categories')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error

    // If code was updated, regenerate subcategory codes
    if (data.code) {
        const { data: subcategories } = await supabase
            .from('categories')
            .select('id')
            .eq('parent_id', id)
            .order('sort_order', { ascending: true })

        if (subcategories && subcategories.length > 0) {
            const parentCodeNum = parseInt(data.code, 10)
            for (let i = 0; i < subcategories.length; i++) {
                const subCode = String(parentCodeNum + ((i + 1) * 100))
                await supabase
                    .from('categories')
                    .update({ code: subCode })
                    .eq('id', subcategories[i].id)
            }
        }
    }

    return { success: true }
}

export async function getOpeningBalance(): Promise<number> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { data } = await supabase
        .from('user_settings')
        .select('setting_value')
        .eq('user_id', user.id)
        .eq('setting_key', 'opening_balance')
        .maybeSingle()

    return data ? parseFloat(data.setting_value || '0') : 0
}

export async function setOpeningBalance(amount: number): Promise<{ success: boolean }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { error } = await supabase
        .from('user_settings')
        .upsert({
            user_id: user.id,
            setting_key: 'opening_balance',
            setting_value: amount.toString(),
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,setting_key' })

    if (error) throw error
    return { success: true }
}

// Fetch transactions and calculate summary stats (with optional date filters)
export async function getSummaryStats(month?: number, year?: number): Promise<{ income: number, expense: number, net: number, count: number }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // If month and year are provided, filter by date range
    let dateFilter: { gte?: string, lte?: string } | null = null
    if (month && year) {
        const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0]
        const endDate = new Date(year, month, 0).toISOString().split('T')[0]
        dateFilter = { gte: startDate, lte: endDate }
    } else if (year) {
        const startDate = new Date(year, 0, 1).toISOString().split('T')[0]
        const endDate = new Date(year, 11, 31).toISOString().split('T')[0]
        dateFilter = { gte: startDate, lte: endDate }
    }

    // Fetch transactions in batches (with optional date filter)
    const BATCH_SIZE = 1000
    let allAmounts: number[] = []
    let offset = 0
    let hasMore = true

    while (hasMore) {
        let query = supabase
            .from('transactions')
            .select('amount')

        // Apply date filter if provided
        if (dateFilter) {
            query = query.gte('transaction_date', dateFilter.gte!).lte('transaction_date', dateFilter.lte!)
        }

        const { data, error } = await query.range(offset, offset + BATCH_SIZE - 1)

        if (error) throw error

        if (data && data.length > 0) {
            allAmounts = allAmounts.concat(data.map(t => Number(t.amount)))
            offset += BATCH_SIZE
            hasMore = data.length === BATCH_SIZE
        } else {
            hasMore = false
        }
    }

    const income = allAmounts.filter(a => a > 0).reduce((sum, a) => sum + a, 0)
    const expense = allAmounts.filter(a => a < 0).reduce((sum, a) => sum + Math.abs(a), 0)

    return {
        income,
        expense,
        net: income - expense,
        count: allAmounts.length
    }
}

// On-demand AI category name suggestion
export async function getAICategorySuggestion(label: string, reference: string, bankCategory?: string): Promise<string> {
    return await suggestCategoryName(label, reference, bankCategory)
}

// Link a transaction to a recurring bill and mark it as paid
export async function linkTransactionToBill(
    transactionId: string,
    billId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Get the bill to find its frequency
    const { data: bill, error: billError } = await supabase
        .from('recurring_bills')
        .select('*')
        .eq('id', billId)
        .eq('user_id', user.id)
        .single()

    if (billError || !bill) {
        return { success: false, error: 'Bill not found' }
    }

    // Link the transaction to the bill
    const { error: txError } = await supabase
        .from('transactions')
        .update({ bill_id: billId })
        .eq('id', transactionId)
        .eq('user_id', user.id)

    if (txError) {
        return { success: false, error: 'Failed to link transaction' }
    }

    // Build update object: always mark as paid and set last_paid_date
    const updateData: any = {
        is_paid: true,
        last_paid_date: new Date().toISOString().split('T')[0]
    }

    // Only advance next_due if autopay is enabled
    if (bill.autopay) {
        let nextDue = new Date(bill.next_due || new Date())
        switch (bill.frequency) {
            case 'weekly':
                nextDue.setDate(nextDue.getDate() + 7)
                break
            case 'fortnightly':
                nextDue.setDate(nextDue.getDate() + 14)
                break
            case 'monthly':
                nextDue.setMonth(nextDue.getMonth() + 1)
                break
            case 'quarterly':
                nextDue.setMonth(nextDue.getMonth() + 3)
                break
            case 'yearly':
            case 'annually':
                nextDue.setFullYear(nextDue.getFullYear() + 1)
                break
            default:
                nextDue.setMonth(nextDue.getMonth() + 1)
        }
        updateData.next_due = nextDue.toISOString().split('T')[0]
        updateData.is_paid = false // Reset for next period since autopay creates new bill
    }

    // Update bill
    const { error: updateError } = await supabase
        .from('recurring_bills')
        .update(updateData)
        .eq('id', billId)
        .eq('user_id', user.id)

    if (updateError) {
        return { success: false, error: 'Failed to update bill' }
    }

    return { success: true }
}

// Unlink a transaction from a bill
export async function unlinkTransactionFromBill(
    transactionId: string
): Promise<{ success: boolean }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { error } = await supabase
        .from('transactions')
        .update({ bill_id: null })
        .eq('id', transactionId)
        .eq('user_id', user.id)

    if (error) throw error
    return { success: true }
}

// Get active bills for linking dropdown
export async function getActiveBillsForLinking(): Promise<{ id: string; name: string; amount: number; next_due: string | null }[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { data: bills } = await supabase
        .from('recurring_bills')
        .select('id, name, amount, next_due')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('name')

    return bills || []
}

// ============================================
// ACCOUNTS PAYABLE LINKING (Unified - replaces bills/invoices)
// ============================================

// Link a transaction to a payable via junction table
export async function linkTransactionToPayable(
    transactionId: string,
    payableId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Get the payable
    const { data: payable, error: payableError } = await supabase
        .from('payables')
        .select('*')
        .eq('id', payableId)
        .eq('user_id', user.id)
        .single()

    if (payableError || !payable) {
        return { success: false, error: 'Payable not found' }
    }

    // Get the transaction amount
    const { data: transaction } = await supabase
        .from('transactions')
        .select('amount')
        .eq('id', transactionId)
        .eq('user_id', user.id)
        .single()

    if (!transaction) {
        return { success: false, error: 'Transaction not found' }
    }

    const txAmount = Math.abs(Number(transaction.amount))

    // Insert into junction table
    const { error: junctionError } = await supabase
        .from('payable_transactions')
        .insert({
            payable_id: payableId,
            transaction_id: transactionId,
            amount: txAmount,
            linked_at: new Date().toISOString(),
            linked_by: user.id
        })

    if (junctionError) {
        if (junctionError.code === '23505') {
            return { success: false, error: 'Transaction already linked to this payable' }
        }
        return { success: false, error: junctionError.message }
    }

    // Calculate total amount_paid from ALL linked transactions
    const { data: allLinks } = await supabase
        .from('payable_transactions')
        .select('amount')
        .eq('payable_id', payableId)

    const totalPaid = (allLinks || []).reduce((sum, link) => sum + Number(link.amount), 0)
    const totalAmount = Number(payable.amount)
    const isFullyPaid = totalPaid >= totalAmount

    // Update transaction to mark it as linked
    const { error: txError } = await supabase
        .from('transactions')
        .update({
            linked_payable_id: payableId,
            reconciliation_status: 'reconciled',
            confirmed: true
        })
        .eq('id', transactionId)
        .eq('user_id', user.id)

    if (txError) {
        return { success: false, error: 'Failed to update transaction' }
    }

    // Build update for payable - only mark paid if fully covered
    const updateData: Record<string, any> = {
        amount_paid: totalPaid,
        last_paid_date: new Date().toISOString().split('T')[0],
        is_paid: isFullyPaid,
        bill_status: isFullyPaid ? 'paid' : 'scheduled',
        reconciled_at: isFullyPaid ? new Date().toISOString() : null
    }

    // For recurring payables that are fully paid, advance next_due
    if (isFullyPaid && payable.is_recurring && payable.frequency !== 'one-time') {
        let nextDue = new Date(payable.next_due || new Date())
        switch (payable.frequency) {
            case 'weekly':
                nextDue.setDate(nextDue.getDate() + 7)
                break
            case 'monthly':
                nextDue.setMonth(nextDue.getMonth() + 1)
                break
            case 'quarterly':
                nextDue.setMonth(nextDue.getMonth() + 3)
                break
            case 'yearly':
                nextDue.setFullYear(nextDue.getFullYear() + 1)
                break
        }
        updateData.next_due = nextDue.toISOString().split('T')[0]
        updateData.is_paid = false // Reset for next period
        updateData.amount_paid = 0 // Reset amount_paid for next period
        updateData.bill_status = 'scheduled'
    }

    // Update payable
    const { error: updateError } = await supabase
        .from('payables')
        .update(updateData)
        .eq('id', payableId)
        .eq('user_id', user.id)

    if (updateError) {
        return { success: false, error: 'Failed to update payable' }
    }

    return { success: true }
}

// Unlink a transaction from a payable
export async function unlinkTransactionFromPayable(
    transactionId: string
): Promise<{ success: boolean }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Get the linked payable first
    const { data: tx } = await supabase
        .from('transactions')
        .select('linked_payable_id')
        .eq('id', transactionId)
        .eq('user_id', user.id)
        .single()

    if (tx?.linked_payable_id) {
        // Clear the link on the payable side
        await supabase
            .from('payables')
            .update({
                linked_transaction_id: null,
                reconciled_at: null,
                is_paid: false,
                bill_status: 'approved'
            })
            .eq('id', tx.linked_payable_id)
            .eq('user_id', user.id)
    }

    // Clear the link on the transaction
    const { error } = await supabase
        .from('transactions')
        .update({ linked_payable_id: null })
        .eq('id', transactionId)
        .eq('user_id', user.id)

    if (error) throw error
    return { success: true }
}

// Get unpaid payables for linking dropdown
export async function getPayablesForLinking(): Promise<{
    id: string
    name: string
    payee_type: string
    amount: number
    next_due: string | null
    vendor_name?: string
    staff_name?: string
}[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Show all payables that aren't fully paid (allows multi-transaction linking)
    // We use amount_paid < amount instead of is_paid = false because:
    // - is_paid may be true from legacy single-link but we now support multi-linking
    // - A payable with some payments can still accept more transactions
    const { data: payables } = await supabase
        .from('payables')
        .select('id, name, payee_type, amount, amount_paid, next_due, vendor:vendor_id(name), staff:staff_id(name)')
        .eq('user_id', user.id)
        .in('bill_status', ['approved', 'scheduled', 'overdue', 'paid'])
        .order('next_due', { ascending: true })

    // Filter to only include payables where amount_paid < amount (not fully paid)
    const unpaidPayables = (payables || []).filter(p =>
        Number(p.amount_paid || 0) < Number(p.amount)
    )

    return unpaidPayables.map(p => ({
        id: p.id,
        name: p.name,
        payee_type: p.payee_type,
        amount: Number(p.amount),
        amount_paid: Number(p.amount_paid || 0),
        next_due: p.next_due,
        vendor_name: (p.vendor as any)?.name,
        staff_name: (p.staff as any)?.name
    }))
}
