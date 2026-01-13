"use server"

import { createClient } from "@/lib/supabase/server"

export interface BudgetScenario {
    id: string
    user_id: string
    year: number
    name: string
    is_active: boolean
    inflation_rate: number
    revenue_growth_rate: number
    created_at: string
    status: 'draft' | 'active' | 'archived'
    yearly_confirmed: boolean
    q1_locked: boolean
    q2_locked: boolean
    q3_locked: boolean
    q4_locked: boolean
    notes: string | null
}

export interface BudgetItem {
    id: string
    scenario_id: string
    category_id: string
    month: number
    budgeted_amount: number
    is_auto_populated: boolean
    notes: string | null
    category?: {
        name: string
        code: string
        parent_id: string | null
    }
}

// Get all budget scenarios for current user
export async function getBudgetScenarios(year: number = 2026): Promise<BudgetScenario[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
        .from('budget_scenarios')
        .select('*')
        .eq('user_id', user.id)
        .eq('year', year)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching budget scenarios:', error)
        return []
    }
    return data || []
}

// Create a new budget scenario (optionally seed from previous year)
export async function createBudgetScenario(
    name: string,
    year: number = 2026,
    seedFromPreviousYear: boolean = false
): Promise<{ success: boolean; scenarioId?: string; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // Create the scenario
    const { data: scenario, error: scenarioError } = await supabase
        .from('budget_scenarios')
        .insert({
            user_id: user.id,
            year,
            name,
            inflation_rate: 0,
            revenue_growth_rate: 0,
            is_active: false,
            status: 'draft',
            q1_locked: false,
            q2_locked: false,
            q3_locked: false,
            q4_locked: false
        })
        .select('id')
        .single()

    if (scenarioError) {
        console.error('Error creating scenario:', scenarioError)
        return { success: false, error: scenarioError.message }
    }

    // If seeding from previous year, copy EXACT previous year amounts (no growth applied)
    if (seedFromPreviousYear) {
        const previousYear = year - 1

        // Fetch previous year actuals with pagination
        let allTransactions: any[] = []
        let page = 0
        const pageSize = 1000
        let hasMore = true

        while (hasMore) {
            const { data: batch } = await supabase
                .from('transactions')
                .select('amount, category_id, transaction_date')
                .eq('user_id', user.id)
                .eq('confirmed', true)
                .gte('transaction_date', `${previousYear}-01-01`)
                .lt('transaction_date', `${year}-01-01`)
                .not('category_id', 'is', null)
                .range(page * pageSize, (page + 1) * pageSize - 1)

            if (batch && batch.length > 0) {
                allTransactions = [...allTransactions, ...batch]
                page++
                hasMore = batch.length === pageSize
            } else {
                hasMore = false
            }
        }

        if (allTransactions.length > 0) {
            // Group by category and month
            const categoryMonthTotals: Record<string, Record<number, number>> = {}
            allTransactions.forEach(tx => {
                if (!tx.category_id) return
                const month = new Date(tx.transaction_date).getMonth() + 1
                if (!categoryMonthTotals[tx.category_id]) {
                    categoryMonthTotals[tx.category_id] = {}
                }
                categoryMonthTotals[tx.category_id][month] =
                    (categoryMonthTotals[tx.category_id][month] || 0) + Math.abs(tx.amount)
            })

            // Create budget items (exact amounts, no growth applied)
            const budgetItems: any[] = []
            Object.entries(categoryMonthTotals).forEach(([categoryId, monthData]) => {
                Object.entries(monthData).forEach(([month, amount]) => {
                    budgetItems.push({
                        scenario_id: scenario.id,
                        category_id: categoryId,
                        month: parseInt(month),
                        budgeted_amount: Math.round(amount * 100) / 100,
                        is_auto_populated: true
                    })
                })
            })

            if (budgetItems.length > 0) {
                const { error: itemsError } = await supabase
                    .from('budget_items')
                    .insert(budgetItems)

                if (itemsError) {
                    console.error('Error inserting budget items:', itemsError)
                }
            }
        }
    }

    return { success: true, scenarioId: scenario.id }
}

// Set a scenario as the active one (unset others)
export async function setActiveScenario(scenarioId: string): Promise<{ success: boolean }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false }

    // First, unset all active scenarios for this user
    await supabase
        .from('budget_scenarios')
        .update({ is_active: false })
        .eq('user_id', user.id)

    // Set the new active scenario
    const { error } = await supabase
        .from('budget_scenarios')
        .update({ is_active: true })
        .eq('id', scenarioId)

    return { success: !error }
}

// Rename a budget scenario
export async function renameScenario(scenarioId: string, newName: string): Promise<{ success: boolean }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false }

    const { error } = await supabase
        .from('budget_scenarios')
        .update({ name: newName })
        .eq('id', scenarioId)
        .eq('user_id', user.id)

    return { success: !error }
}

// Update scenario notes
export async function updateScenarioNotes(scenarioId: string, notes: string | null): Promise<{ success: boolean }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false }

    const { error } = await supabase
        .from('budget_scenarios')
        .update({ notes })
        .eq('id', scenarioId)
        .eq('user_id', user.id)

    return { success: !error }
}

// AI-powered cleanup of budget notes with context
export async function cleanupBudgetNotes(
    notes: string,
    budgetContext: {
        scenarioName: string
        year: number
        totalBudgetIncome: number
        totalBudgetExpenses: number
        netBudget: number
        totalReferenceIncome: number
        totalReferenceExpenses: number
    }
): Promise<{ success: boolean; cleanedNotes: string }> {
    try {
        const { getGeminiModel, isGeminiConfigured } = await import('@/lib/integrations')

        if (!isGeminiConfigured()) {
            return { success: false, cleanedNotes: notes }
        }

        const model = getGeminiModel('notesCleanup')

        const prompt = `You are a financial planning assistant. Clean up and improve these budget scenario notes while preserving the original intent and key information.

BUDGET CONTEXT:
- Scenario: "${budgetContext.scenarioName}" for ${budgetContext.year}
- Budgeted Income: £${budgetContext.totalBudgetIncome.toLocaleString()}
- Budgeted Expenses: £${budgetContext.totalBudgetExpenses.toLocaleString()}
- Net Budget: £${budgetContext.netBudget.toLocaleString()}
- Reference Year Income: £${budgetContext.totalReferenceIncome.toLocaleString()}
- Reference Year Expenses: £${budgetContext.totalReferenceExpenses.toLocaleString()}

ORIGINAL NOTES:
${notes}

INSTRUCTIONS:
1. Fix grammar and spelling
2. Make it clear and professional
3. Add relevant context from the budget numbers if helpful
4. Keep it concise (max 2-3 sentences)
5. Preserve the original meaning and key points
6. Output ONLY the cleaned notes, nothing else

CLEANED NOTES:`

        const result = await model.generateContent(prompt)
        const cleanedNotes = result.response.text().trim()

        return { success: true, cleanedNotes }
    } catch (error) {
        console.error('AI cleanup error:', error)
        return { success: false, cleanedNotes: notes }
    }
}

// Get budget items for a scenario
export async function getBudgetItems(scenarioId: string): Promise<BudgetItem[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('budget_items')
        .select('*, categories(name, code, parent_id)')
        .eq('scenario_id', scenarioId)
        .order('month')

    if (error) {
        console.error('Error fetching budget items:', error)
        return []
    }

    return (data || []).map(item => ({
        ...item,
        category: item.categories
    }))
}

// Update a single budget item amount
export async function updateBudgetItem(
    itemId: string,
    amount: number
): Promise<{ success: boolean }> {
    const supabase = await createClient()

    const { error } = await supabase
        .from('budget_items')
        .update({
            budgeted_amount: amount,
            is_auto_populated: false // Mark as manually edited
        })
        .eq('id', itemId)

    return { success: !error }
}

// Duplicate a scenario
export async function duplicateScenario(
    scenarioId: string,
    newName: string
): Promise<{ success: boolean; newScenarioId?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false }

    // Get the original scenario
    const { data: original } = await supabase
        .from('budget_scenarios')
        .select('*')
        .eq('id', scenarioId)
        .single()

    if (!original) return { success: false }

    // Create new scenario
    const { data: newScenario, error: scenarioError } = await supabase
        .from('budget_scenarios')
        .insert({
            user_id: user.id,
            year: original.year,
            name: newName,
            inflation_rate: original.inflation_rate,
            revenue_growth_rate: original.revenue_growth_rate,
            is_active: false
        })
        .select('id')
        .single()

    if (scenarioError) return { success: false }

    // Copy budget items
    const { data: items } = await supabase
        .from('budget_items')
        .select('*')
        .eq('scenario_id', scenarioId)

    if (items && items.length > 0) {
        const newItems = items.map(item => ({
            scenario_id: newScenario.id,
            category_id: item.category_id,
            month: item.month,
            budgeted_amount: item.budgeted_amount,
            is_auto_populated: item.is_auto_populated,
            notes: item.notes
        }))

        await supabase.from('budget_items').insert(newItems)
    }

    return { success: true, newScenarioId: newScenario.id }
}

// Delete a scenario
export async function deleteScenario(scenarioId: string): Promise<{ success: boolean }> {
    const supabase = await createClient()

    const { error } = await supabase
        .from('budget_scenarios')
        .delete()
        .eq('id', scenarioId)

    return { success: !error }
}

// ============= LIVE ACTUALS =============
// Get actuals from categorized transactions
// Month is determined by linked payable due_date (for late payments) or transaction_date
export interface ActualsByMonth {
    [categoryId: string]: {
        [month: number]: number  // month 1-12, amount
    }
}

export async function getLiveActuals(year: number, months?: number[]): Promise<ActualsByMonth> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return {}

    // Get transactions with their linked payables
    const { data: transactions } = await supabase
        .from('transactions')
        .select(`
            id,
            amount,
            category_id,
            transaction_date,
            linked_payable_id,
            payables:linked_payable_id (next_due)
        `)
        .eq('user_id', user.id)
        .gte('transaction_date', `${year}-01-01`)
        .lt('transaction_date', `${year + 1}-01-01`)
        .not('category_id', 'is', null)

    const actualsByMonth: ActualsByMonth = {}

    transactions?.forEach(tx => {
        if (!tx.category_id) return

        // Determine which month this transaction belongs to
        let month: number

        const payableData = tx.payables as { next_due: string }[] | null
        const payable = Array.isArray(payableData) ? payableData[0] : payableData
        if (payable?.next_due) {
            // Use payable due date for month (handles late payments)
            month = new Date(payable.next_due).getMonth() + 1
        } else {
            // Use transaction date for month
            month = new Date(tx.transaction_date).getMonth() + 1
        }

        // Filter by requested months if specified
        if (months && !months.includes(month)) return

        // Initialize category if not exists
        if (!actualsByMonth[tx.category_id]) {
            actualsByMonth[tx.category_id] = {}
        }

        // Add to the month (use absolute value for consistent positive amounts)
        actualsByMonth[tx.category_id][month] =
            (actualsByMonth[tx.category_id][month] || 0) + Math.abs(tx.amount)
    })

    return actualsByMonth
}

// Get Budget vs Actual data organized by Class > Category Group > Sub-category
export interface BvASubCategory {
    categoryId: string
    categoryName: string
    categoryCode: string
    budgeted: number
    actual: number
    variance: number
    remaining: number  // Budget - Actual (positive = under budget)
}

export interface BvACategoryGroup {
    categoryId: string
    categoryName: string
    categoryCode: string
    subCategories: BvASubCategory[]
    totalBudgeted: number
    totalActual: number
    totalVariance: number
    totalRemaining: number
}

export interface BvAClass {
    classId: string
    classCode: string
    className: string
    categoryGroups: BvACategoryGroup[]
    totalBudgeted: number
    totalActual: number
    totalVariance: number
    totalRemaining: number
}

export async function getBudgetVsActual(year: number = 2026, lockedQuarters?: { q1: boolean, q2: boolean, q3: boolean, q4: boolean }): Promise<BvAClass[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    // Get financial classes from database
    const { data: financialClasses } = await supabase
        .from('financial_classes')
        .select('id, code, name, sort_order')
        .eq('user_id', user.id)
        .order('sort_order')

    // Get active scenario (including lock states)
    const { data: activeScenario } = await supabase
        .from('budget_scenarios')
        .select('id, q1_locked, q2_locked, q3_locked, q4_locked')
        .eq('user_id', user.id)
        .eq('year', year)
        .eq('is_active', true)
        .single()

    if (!activeScenario) return []

    // Use passed lockedQuarters or get from scenario (for filtering, but not for actuals)
    const quarters = lockedQuarters || {
        q1: activeScenario.q1_locked,
        q2: activeScenario.q2_locked,
        q3: activeScenario.q3_locked,
        q4: activeScenario.q4_locked
    }

    // Get all categories with their class_id and parent_id
    const { data: allCategories } = await supabase
        .from('categories')
        .select('id, name, code, class_id, parent_id')
        .eq('user_id', user.id)
        .order('code')

    // Get ALL budget items (no month filtering)
    const { data: budgetItems } = await supabase
        .from('budget_items')
        .select('category_id, budgeted_amount, month')
        .eq('scenario_id', activeScenario.id)

    // Group budget by category (all months)
    const budgetByCategory: Record<string, number> = {}
    budgetItems?.forEach(item => {
        budgetByCategory[item.category_id] =
            (budgetByCategory[item.category_id] || 0) + item.budgeted_amount
    })

    // Get LIVE actuals from transactions (no lock filtering)
    // This uses the new getLiveActuals function which handles late payments correctly
    const liveActuals = await getLiveActuals(year)

    // Flatten to category totals
    const actualByCategory: Record<string, number> = {}
    Object.entries(liveActuals).forEach(([categoryId, monthlyActuals]) => {
        actualByCategory[categoryId] = Object.values(monthlyActuals).reduce((sum, amt) => sum + amt, 0)
    })

    // Separate parent categories (groups) and sub-categories
    const parentCategories = allCategories?.filter(c => !c.parent_id) || []
    const subCategories = allCategories?.filter(c => c.parent_id) || []

    // Build 3-level hierarchical structure: Class > Category Group > Sub-category
    const classesById: Record<string, BvAClass> = {}

    // Initialize classes
    financialClasses?.forEach(fc => {
        classesById[fc.id] = {
            classId: fc.id,
            classCode: fc.code,
            className: fc.name,
            categoryGroups: [],
            totalBudgeted: 0,
            totalActual: 0,
            totalVariance: 0,
            totalRemaining: 0
        }
    })

    // Build category groups with their sub-categories
    parentCategories.forEach(parent => {
        if (!parent.class_id || !classesById[parent.class_id]) return

        const subs = subCategories.filter(s => s.parent_id === parent.id)

        // Include ALL sub-categories (not just those with data)
        const subCatData: BvASubCategory[] = []
        let groupBudgeted = 0
        let groupActual = 0

        subs.forEach(sub => {
            const budgeted = budgetByCategory[sub.id] || 0
            const actual = actualByCategory[sub.id] || 0
            const remaining = budgeted - actual

            // Include ALL sub-categories
            subCatData.push({
                categoryId: sub.id,
                categoryName: sub.name,
                categoryCode: sub.code || '',
                budgeted,
                actual,
                variance: actual - budgeted,
                remaining
            })
            groupBudgeted += budgeted
            groupActual += actual
        })

        // Also check if parent itself has direct budget/actuals
        const parentBudgeted = budgetByCategory[parent.id] || 0
        const parentActual = actualByCategory[parent.id] || 0
        groupBudgeted += parentBudgeted
        groupActual += parentActual

        // Include ALL category groups (not just those with data)
        classesById[parent.class_id].categoryGroups.push({
            categoryId: parent.id,
            categoryName: parent.name,
            categoryCode: parent.code || '',
            subCategories: subCatData,
            totalBudgeted: groupBudgeted,
            totalActual: groupActual,
            totalVariance: groupActual - groupBudgeted,
            totalRemaining: groupBudgeted - groupActual
        })

        classesById[parent.class_id].totalBudgeted += groupBudgeted
        classesById[parent.class_id].totalActual += groupActual
        classesById[parent.class_id].totalVariance += (groupActual - groupBudgeted)
        classesById[parent.class_id].totalRemaining += (groupBudgeted - groupActual)
    })

    // Sort and filter result - only include classes with category groups
    const result = financialClasses
        ?.filter(fc => classesById[fc.id]?.categoryGroups.length > 0)
        .map(fc => classesById[fc.id]) || []

    // Sort category groups within each class
    result.forEach(cls => {
        cls.categoryGroups.sort((a, b) => a.categoryCode.localeCompare(b.categoryCode))
        cls.categoryGroups.forEach(grp => {
            grp.subCategories.sort((a, b) => a.categoryCode.localeCompare(b.categoryCode))
        })
    })

    return result
}

// Get transactions for a specific category (for drill-down)
export async function getCategoryTransactions(categoryId: string, year: number = 2026): Promise<{
    id: string
    date: string
    description: string
    amount: number
    counterParty: string | null
    reference: string | null
}[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    console.log('getCategoryTransactions called with:', { categoryId, year, userId: user.id })

    // First, check if this category has child categories
    const { data: childCategories } = await supabase
        .from('categories')
        .select('id')
        .eq('parent_id', categoryId)

    // Include both the category itself and any children
    const categoryIds = [categoryId, ...(childCategories?.map(c => c.id) || [])]

    console.log('Searching in categories:', categoryIds)

    const { data: transactions, error } = await supabase
        .from('transactions')
        .select('id, transaction_date, description, amount, raw_party')
        .eq('user_id', user.id)
        .in('category_id', categoryIds)
        .gte('transaction_date', `${year}-01-01`)
        .lt('transaction_date', `${year + 1}-01-01`)
        .order('transaction_date', { ascending: false })
        .limit(50)

    console.log('getCategoryTransactions result:', {
        categoryId,
        year,
        transactionCount: transactions?.length || 0,
        error: error?.message
    })

    return (transactions || []).map(tx => ({
        id: tx.id,
        date: tx.transaction_date,
        description: tx.description || 'No description',
        amount: tx.amount,
        counterParty: tx.raw_party || null,
        reference: null
    }))
}

// Get previous year actuals by category and month (for reference column in editor)
export interface PreviousYearActual {
    categoryId: string
    categoryName: string
    categoryCode: string
    parentId: string | null
    monthlyAmounts: Record<number, number> // month (1-12) -> amount
    yearTotal: number
}

export async function getPreviousYearActuals(year: number = 2025): Promise<PreviousYearActual[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    // Get all categories
    const { data: categories } = await supabase
        .from('categories')
        .select('id, name, code, parent_id')
        .eq('user_id', user.id)

    // Fetch transactions with pagination
    let allTransactions: any[] = []
    let page = 0
    const pageSize = 1000
    let hasMore = true

    while (hasMore) {
        const { data: batch } = await supabase
            .from('transactions')
            .select('amount, category_id, transaction_date')
            .eq('user_id', user.id)
            .eq('confirmed', true)
            .gte('transaction_date', `${year}-01-01`)
            .lt('transaction_date', `${year + 1}-01-01`)
            .not('category_id', 'is', null)
            .range(page * pageSize, (page + 1) * pageSize - 1)

        if (batch && batch.length > 0) {
            allTransactions = [...allTransactions, ...batch]
            page++
            hasMore = batch.length === pageSize
        } else {
            hasMore = false
        }
    }

    // Group by category and month
    const categoryData: Record<string, Record<number, number>> = {}
    allTransactions.forEach(tx => {
        if (!tx.category_id) return
        const month = new Date(tx.transaction_date).getMonth() + 1
        if (!categoryData[tx.category_id]) {
            categoryData[tx.category_id] = {}
        }
        categoryData[tx.category_id][month] =
            (categoryData[tx.category_id][month] || 0) + Math.abs(tx.amount)
    })

    // Build result
    const result: PreviousYearActual[] = []
    categories?.forEach(cat => {
        const monthlyAmounts = categoryData[cat.id] || {}
        const yearTotal = Object.values(monthlyAmounts).reduce((sum, amt) => sum + amt, 0)

        // Only include categories with data
        if (yearTotal > 0) {
            result.push({
                categoryId: cat.id,
                categoryName: cat.name,
                categoryCode: cat.code || '',
                parentId: cat.parent_id,
                monthlyAmounts,
                yearTotal
            })
        }
    })

    return result.sort((a, b) => a.categoryCode.localeCompare(b.categoryCode))
}

// Lock a quarter (only for active scenarios)
export async function lockQuarter(scenarioId: string, quarter: 1 | 2 | 3 | 4): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const column = `q${quarter}_locked` as const

    const { error } = await supabase
        .from('budget_scenarios')
        .update({ [column]: true, status: 'active' })
        .eq('id', scenarioId)
        .eq('user_id', user.id)

    if (error) {
        return { success: false, error: error.message }
    }
    return { success: true }
}

// Unlock a quarter (with confirmation assumed by caller)
export async function unlockQuarter(scenarioId: string, quarter: 1 | 2 | 3 | 4): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const column = `q${quarter}_locked` as const

    const { error } = await supabase
        .from('budget_scenarios')
        .update({ [column]: false })
        .eq('id', scenarioId)
        .eq('user_id', user.id)

    if (error) {
        return { success: false, error: error.message }
    }
    return { success: true }
}

// Get budget items for editor (with option to include previous year reference)
export interface BudgetEditorData {
    categories: {
        id: string
        name: string
        code: string
        parentId: string | null
        classId: string | null
        months: Record<number, number> // month -> budgeted amount
        previousYear: Record<number, number> // month -> previous year actual
        yearTotal: number
        previousYearTotal: number
    }[]
}

export async function getBudgetEditorData(scenarioId: string, previousYear: number = 2025): Promise<BudgetEditorData> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { categories: [] }

    // Get scenario info
    const { data: scenario } = await supabase
        .from('budget_scenarios')
        .select('year')
        .eq('id', scenarioId)
        .single()

    if (!scenario) return { categories: [] }

    // Get all categories with their class_id
    const { data: categories } = await supabase
        .from('categories')
        .select('id, name, code, parent_id, class_id')
        .eq('user_id', user.id)
        .order('code')

    // Get budget items for this scenario
    const { data: budgetItems } = await supabase
        .from('budget_items')
        .select('category_id, month, budgeted_amount')
        .eq('scenario_id', scenarioId)

    // Get previous year actuals
    const previousYearActuals = await getPreviousYearActuals(previousYear)
    const previousYearMap = new Map(previousYearActuals.map(p => [p.categoryId, p]))

    // Build budget by category/month
    const budgetByCatMonth: Record<string, Record<number, number>> = {}
    budgetItems?.forEach(item => {
        if (!budgetByCatMonth[item.category_id]) {
            budgetByCatMonth[item.category_id] = {}
        }
        budgetByCatMonth[item.category_id][item.month] = item.budgeted_amount
    })

    // Build result
    const result: BudgetEditorData['categories'] = []
    categories?.forEach(cat => {
        const months = budgetByCatMonth[cat.id] || {}
        const prevYear = previousYearMap.get(cat.id)
        const previousYearMonths = prevYear?.monthlyAmounts || {}

        const yearTotal = Object.values(months).reduce((sum, amt) => sum + (amt || 0), 0)
        const previousYearTotal = Object.values(previousYearMonths).reduce((sum, amt) => sum + amt, 0)

        // Include all categories (even without data) so user can budget them
        result.push({
            id: cat.id,
            name: cat.name,
            code: cat.code || '',
            parentId: cat.parent_id,
            classId: cat.class_id,
            months,
            previousYear: previousYearMonths,
            yearTotal,
            previousYearTotal
        })
    })

    return { categories: result }
}

// Update a single budget cell
export async function updateBudgetCell(
    scenarioId: string,
    categoryId: string,
    month: number,
    amount: number
): Promise<{ success: boolean }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false }

    // Check if entry exists
    const { data: existing } = await supabase
        .from('budget_items')
        .select('id')
        .eq('scenario_id', scenarioId)
        .eq('category_id', categoryId)
        .eq('month', month)
        .single()

    if (existing) {
        // Update
        await supabase
            .from('budget_items')
            .update({ budgeted_amount: amount, is_auto_populated: false })
            .eq('id', existing.id)
    } else {
        // Insert
        await supabase
            .from('budget_items')
            .insert({
                scenario_id: scenarioId,
                category_id: categoryId,
                month,
                budgeted_amount: amount,
                is_auto_populated: false
            })
    }

    return { success: true }
}

// Get hierarchical budget editor data: Class > Group > SubCategory with Reference, Budget, Change
export interface EditorSubCategory {
    id: string
    name: string
    code: string
    reference: number  // Previous year actual spending
    budget: number     // User's planned budget
    change: number     // Budget minus Reference
    changePercent: number
}

export interface EditorCategoryGroup {
    id: string
    name: string
    code: string
    subCategories: EditorSubCategory[]
    totalReference: number
    totalBudget: number
    totalChange: number
}

export interface EditorClass {
    id: string
    code: string
    name: string
    categoryGroups: EditorCategoryGroup[]
    totalReference: number
    totalBudget: number
    totalChange: number
}

export async function getBudgetEditorHierarchy(scenarioId: string): Promise<EditorClass[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    // Get scenario info
    const { data: scenario } = await supabase
        .from('budget_scenarios')
        .select('year')
        .eq('id', scenarioId)
        .single()

    if (!scenario) return []

    const year = scenario.year

    // Get financial classes
    const { data: financialClasses } = await supabase
        .from('financial_classes')
        .select('id, code, name, sort_order')
        .eq('user_id', user.id)
        .order('sort_order')

    // Get all categories
    const { data: allCategories } = await supabase
        .from('categories')
        .select('id, name, code, class_id, parent_id')
        .eq('user_id', user.id)
        .order('code')

    // Get budget items for this scenario
    const { data: budgetItems } = await supabase
        .from('budget_items')
        .select('category_id, budgeted_amount')
        .eq('scenario_id', scenarioId)

    // Get PREVIOUS year transactions as reference (2025 actuals)
    const prevYear = year - 1
    let allTransactions: any[] = []
    let page = 0
    const pageSize = 1000
    let hasMore = true

    while (hasMore) {
        const { data: batch } = await supabase
            .from('transactions')
            .select('amount, category_id, type')
            .eq('user_id', user.id)
            .eq('confirmed', true)
            .gte('transaction_date', `${prevYear}-01-01`)
            .lt('transaction_date', `${prevYear + 1}-01-01`)
            .not('category_id', 'is', null)
            .range(page * pageSize, (page + 1) * pageSize - 1)

        if (batch && batch.length > 0) {
            allTransactions = [...allTransactions, ...batch]
            page++
            hasMore = batch.length === pageSize
        } else {
            hasMore = false
        }
    }

    // Build budget totals by category (sum all months)
    const budgetByCategory: Record<string, number> = {}
    budgetItems?.forEach(item => {
        budgetByCategory[item.category_id] = (budgetByCategory[item.category_id] || 0) + item.budgeted_amount
    })

    // Build reference totals by category (previous year's spending)
    // Match P&L logic: separate by transaction type field, not category class
    const referenceByCategory: Record<string, number> = {}
    const incomeRefByCategory: Record<string, number> = {}
    const expenseRefByCategory: Record<string, number> = {}

    allTransactions.forEach(tx => {
        if (tx.category_id) {
            const absAmount = Math.abs(tx.amount)
            // Sum all transactions by category (for display)
            referenceByCategory[tx.category_id] = (referenceByCategory[tx.category_id] || 0) + absAmount

            // Also track by type for P&L-consistent totals
            if (tx.type === 'income') {
                incomeRefByCategory[tx.category_id] = (incomeRefByCategory[tx.category_id] || 0) + absAmount
            } else {
                expenseRefByCategory[tx.category_id] = (expenseRefByCategory[tx.category_id] || 0) + absAmount
            }
        }
    })

    // Build category map
    const categoryMap = new Map(allCategories?.map(c => [c.id, c]) || [])

    // Build result
    const result: EditorClass[] = []

    financialClasses?.forEach(fc => {
        // Get parent categories (those with class_id = this class and no parent)
        const parentCategories = allCategories?.filter(c => c.class_id === fc.id && !c.parent_id) || []

        const categoryGroups: EditorCategoryGroup[] = []

        parentCategories.forEach(parent => {
            // Get subcategories
            const subCats = allCategories?.filter(c => c.parent_id === parent.id) || []

            const subCategories: EditorSubCategory[] = subCats.map(sub => {
                const budget = budgetByCategory[sub.id] || 0
                // Use type-specific reference to match P&L logic:
                // REVENUE class uses income-type transactions, others use expense-type
                const refMap = fc.code === 'REVENUE' ? incomeRefByCategory : expenseRefByCategory
                const reference = refMap[sub.id] || 0
                const change = budget - reference  // How much more/less than last year
                const changePercent = reference > 0 ? ((budget - reference) / reference) * 100 : 0

                return {
                    id: sub.id,
                    name: sub.name,
                    code: sub.code || '',
                    reference,
                    budget,
                    change,
                    changePercent
                }
            })

            // Include parent's own budget/reference if no subcategories, or sum of subcategories
            let totalReference = subCategories.reduce((sum, s) => sum + s.reference, 0)
            let totalBudget = subCategories.reduce((sum, s) => sum + s.budget, 0)

            // If no subcategories, use parent's own amounts
            if (subCategories.length === 0) {
                const refMap = fc.code === 'REVENUE' ? incomeRefByCategory : expenseRefByCategory
                totalReference = refMap[parent.id] || 0
                totalBudget = budgetByCategory[parent.id] || 0
            }

            categoryGroups.push({
                id: parent.id,
                name: parent.name,
                code: parent.code || '',
                subCategories,
                totalReference,
                totalBudget,
                totalChange: totalBudget - totalReference
            })
        })

        const classTotalReference = categoryGroups.reduce((sum, g) => sum + g.totalReference, 0)
        const classTotalBudget = categoryGroups.reduce((sum, g) => sum + g.totalBudget, 0)

        if (categoryGroups.length > 0) {
            result.push({
                id: fc.id,
                code: fc.code,
                name: fc.name,
                categoryGroups,
                totalReference: classTotalReference,
                totalBudget: classTotalBudget,
                totalChange: classTotalBudget - classTotalReference
            })
        }
    })

    return result
}

// Confirm yearly budget - enables monthly view
export async function confirmYearlyBudget(scenarioId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { error } = await supabase
        .from('budget_scenarios')
        .update({ yearly_confirmed: true })
        .eq('id', scenarioId)
        .eq('user_id', user.id)

    if (error) return { success: false, error: error.message }
    return { success: true }
}

// Check if scenario can be edited (not locked)
export async function canEditYearly(scenarioId: string): Promise<boolean> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const { data: scenario } = await supabase
        .from('budget_scenarios')
        .select('q1_locked, q2_locked, q3_locked, q4_locked')
        .eq('id', scenarioId)
        .single()

    if (!scenario) return false
    // Can edit yearly if NO quarters are locked
    return !scenario.q1_locked && !scenario.q2_locked && !scenario.q3_locked && !scenario.q4_locked
}

// Get monthly budget data for a specific quarter
export interface MonthlyBudgetRow {
    categoryId: string
    categoryName: string
    categoryCode: string
    parentId: string | null
    classId: string | null
    className: string
    month1Budget: number
    month2Budget: number
    month3Budget: number
    month1Ref: number // 2025 reference
    month2Ref: number
    month3Ref: number
    month1Actual: number
    month2Actual: number
    month3Actual: number
    qTotal: number
    qRefTotal: number
    qActualTotal: number
}

export async function getMonthlyBudgetData(scenarioId: string, quarter: 1 | 2 | 3 | 4): Promise<MonthlyBudgetRow[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    // Get scenario
    const { data: scenario } = await supabase
        .from('budget_scenarios')
        .select('year')
        .eq('id', scenarioId)
        .single()
    if (!scenario) return []

    const year = scenario.year
    const prevYear = year - 1
    const months = quarter === 1 ? [1, 2, 3] : quarter === 2 ? [4, 5, 6] : quarter === 3 ? [7, 8, 9] : [10, 11, 12]

    // Get categories with class info
    const { data: categories } = await supabase
        .from('categories')
        .select('id, name, code, parent_id, class_id, financial_classes(name)')
        .eq('user_id', user.id)
        .order('code')

    // Get budget items for this scenario and these months
    const { data: budgetItems } = await supabase
        .from('budget_items')
        .select('category_id, month, budgeted_amount')
        .eq('scenario_id', scenarioId)
        .in('month', months)

    // Get previous year reference data (actuals from previous year)
    const { data: prevYearTxs } = await supabase
        .from('transactions')
        .select('amount, category_id, transaction_date')
        .eq('user_id', user.id)
        .eq('confirmed', true)
        .gte('transaction_date', `${prevYear}-01-01`)
        .lt('transaction_date', `${prevYear + 1}-01-01`)

    // Get current year actuals
    const { data: currentYearTxs } = await supabase
        .from('transactions')
        .select('amount, category_id, transaction_date')
        .eq('user_id', user.id)
        .eq('confirmed', true)
        .gte('transaction_date', `${year}-01-01`)
        .lt('transaction_date', `${year + 1}-01-01`)

    // Build lookup maps
    const budgetMap: Record<string, Record<number, number>> = {}
    budgetItems?.forEach(item => {
        if (!budgetMap[item.category_id]) budgetMap[item.category_id] = {}
        budgetMap[item.category_id][item.month] = item.budgeted_amount
    })

    const prevYearByMonth: Record<string, Record<number, number>> = {}
    prevYearTxs?.forEach(tx => {
        if (!tx.category_id) return
        const m = new Date(tx.transaction_date).getMonth() + 1
        if (!prevYearByMonth[tx.category_id]) prevYearByMonth[tx.category_id] = {}
        prevYearByMonth[tx.category_id][m] = (prevYearByMonth[tx.category_id][m] || 0) + Math.abs(tx.amount)
    })

    const currentYearByMonth: Record<string, Record<number, number>> = {}
    currentYearTxs?.forEach(tx => {
        if (!tx.category_id) return
        const m = new Date(tx.transaction_date).getMonth() + 1
        if (!currentYearByMonth[tx.category_id]) currentYearByMonth[tx.category_id] = {}
        currentYearByMonth[tx.category_id][m] = (currentYearByMonth[tx.category_id][m] || 0) + Math.abs(tx.amount)
    })

    // Build result - only leaf categories (those with parent_id)
    const result: MonthlyBudgetRow[] = []
    categories?.forEach(cat => {
        const budgets = budgetMap[cat.id] || {}
        const refs = prevYearByMonth[cat.id] || {}
        const actuals = currentYearByMonth[cat.id] || {}
        const className = (cat.financial_classes as any)?.name || ''

        const month1Budget = budgets[months[0]] || 0
        const month2Budget = budgets[months[1]] || 0
        const month3Budget = budgets[months[2]] || 0
        const month1Ref = refs[months[0]] || 0
        const month2Ref = refs[months[1]] || 0
        const month3Ref = refs[months[2]] || 0
        const month1Actual = actuals[months[0]] || 0
        const month2Actual = actuals[months[1]] || 0
        const month3Actual = actuals[months[2]] || 0

        result.push({
            categoryId: cat.id,
            categoryName: cat.name,
            categoryCode: cat.code || '',
            parentId: cat.parent_id,
            classId: cat.class_id,
            className,
            month1Budget,
            month2Budget,
            month3Budget,
            month1Ref,
            month2Ref,
            month3Ref,
            month1Actual,
            month2Actual,
            month3Actual,
            qTotal: month1Budget + month2Budget + month3Budget,
            qRefTotal: month1Ref + month2Ref + month3Ref,
            qActualTotal: month1Actual + month2Actual + month3Actual
        })
    })

    return result.sort((a, b) => a.categoryCode.localeCompare(b.categoryCode))
}

// Update budget for a specific month
export async function updateMonthlyBudget(
    scenarioId: string,
    categoryId: string,
    month: number,
    amount: number
): Promise<{ success: boolean }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false }

    // Check if entry exists
    const { data: existing } = await supabase
        .from('budget_items')
        .select('id')
        .eq('scenario_id', scenarioId)
        .eq('category_id', categoryId)
        .eq('month', month)
        .single()

    if (existing) {
        await supabase
            .from('budget_items')
            .update({ budgeted_amount: amount, is_auto_populated: false })
            .eq('id', existing.id)
    } else {
        await supabase
            .from('budget_items')
            .insert({
                scenario_id: scenarioId,
                category_id: categoryId,
                month,
                budgeted_amount: amount,
                is_auto_populated: false
            })
    }

    return { success: true }
}
