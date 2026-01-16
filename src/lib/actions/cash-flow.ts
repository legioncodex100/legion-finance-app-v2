"use server"

import { createClient } from "@/lib/supabase/server"

// Types
export interface CashFlowPattern {
    id: string
    patternType: string
    weekOfMonth: number
    month: number
    averageAmount: number
    transactionCount: number
    confidence: number
}

export interface ForecastWeek {
    weekNumber: number
    weekStart: Date
    weekEnd: Date
    expectedInflows: number
    expectedOutflows: number
    netCashFlow: number
    runningBalance: number
    isHistorical: boolean
    isDanger: boolean
    sources: {
        income: { source: string; amount: number }[]
        expenses: { source: string; amount: number }[]
    }
}

export interface DataFreshness {
    bank: { lastImport: Date | null; recordCount: number; isStale: boolean }
    mindbodyScheduled: { lastImport: Date | null; recordCount: number; isStale: boolean }
    mindbodyFailed: { lastImport: Date | null; recordCount: number; isStale: boolean }
    patterns: { lastCalculated: Date | null; isStale: boolean }
}

// Analyze historical patterns from transactions
export async function analyzeHistoricalPatterns(): Promise<{ success: boolean; patternsCreated: number }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Get all transactions from the past year
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

    const { data: transactions, error } = await supabase
        .from('transactions')
        .select('id, transaction_date, amount, type, category_id, confirmed')
        .eq('user_id', user.id)
        .gte('transaction_date', oneYearAgo.toISOString().split('T')[0])
        .order('transaction_date', { ascending: true })

    if (error) throw error
    if (!transactions || transactions.length === 0) {
        return { success: true, patternsCreated: 0 }
    }

    // Step 1: Group transactions by actual week and calculate weekly totals
    const weeklyTotals: Map<string, { income: number; expense: number; weekOfMonth: number; month: number }> = new Map()

    transactions.forEach(tx => {
        const date = new Date(tx.transaction_date)
        const weekOfYear = Math.ceil((date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))
        const year = date.getFullYear()
        const weekKey = `${year}-W${weekOfYear}`

        const weekOfMonth = Math.ceil(date.getDate() / 7) // 1-5
        const month = date.getMonth() + 1 // 1-12

        if (!weeklyTotals.has(weekKey)) {
            weeklyTotals.set(weekKey, { income: 0, expense: 0, weekOfMonth, month })
        }

        const amount = Math.abs(Number(tx.amount))
        if (Number(tx.amount) > 0) {
            weeklyTotals.get(weekKey)!.income += amount
        } else {
            weeklyTotals.get(weekKey)!.expense += amount
        }
    })

    // Step 2: Group weekly totals by week-of-month + month pattern
    const incomeByPattern: Map<string, number[]> = new Map()
    const expenseByPattern: Map<string, number[]> = new Map()

    weeklyTotals.forEach((totals, weekKey) => {
        const patternKey = `${totals.weekOfMonth}-${totals.month}`

        if (!incomeByPattern.has(patternKey)) {
            incomeByPattern.set(patternKey, [])
        }
        if (!expenseByPattern.has(patternKey)) {
            expenseByPattern.set(patternKey, [])
        }

        incomeByPattern.get(patternKey)!.push(totals.income)
        expenseByPattern.get(patternKey)!.push(totals.expense)
    })

    // First, clear existing patterns
    await supabase
        .from('cash_flow_patterns')
        .delete()
        .eq('user_id', user.id)

    let patternsCreated = 0

    // Step 3: Calculate average weekly totals for each pattern and store
    for (const [patternKey, weeklyIncomes] of incomeByPattern) {
        const [weekOfMonth, month] = patternKey.split('-').map(Number)
        const sum = weeklyIncomes.reduce((a, b) => a + b, 0)
        const avg = sum / weeklyIncomes.length

        // Calculate standard deviation
        const variance = weeklyIncomes.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / weeklyIncomes.length
        const stdDev = Math.sqrt(variance)
        const confidence = avg > 0 ? Math.max(0.3, 1 - (stdDev / avg / 2)) : 0.5

        if (avg > 0) {
            await supabase
                .from('cash_flow_patterns')
                .insert({
                    user_id: user.id,
                    pattern_type: 'weekly_income',
                    week_of_month: weekOfMonth,
                    month: month,
                    average_amount: Math.round(avg * 100) / 100,
                    total_amount: sum,
                    transaction_count: weeklyIncomes.length,
                    std_deviation: Math.round(stdDev * 100) / 100,
                    confidence: Math.round(confidence * 100) / 100,
                    calculated_at: new Date().toISOString()
                })
            patternsCreated++
        }
    }

    for (const [patternKey, weeklyExpenses] of expenseByPattern) {
        const [weekOfMonth, month] = patternKey.split('-').map(Number)
        const sum = weeklyExpenses.reduce((a, b) => a + b, 0)
        const avg = sum / weeklyExpenses.length

        // Calculate standard deviation
        const variance = weeklyExpenses.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / weeklyExpenses.length
        const stdDev = Math.sqrt(variance)
        const confidence = avg > 0 ? Math.max(0.3, 1 - (stdDev / avg / 2)) : 0.5

        if (avg > 0) {
            await supabase
                .from('cash_flow_patterns')
                .insert({
                    user_id: user.id,
                    pattern_type: 'weekly_expense',
                    week_of_month: weekOfMonth,
                    month: month,
                    average_amount: Math.round(avg * 100) / 100,
                    total_amount: sum,
                    transaction_count: weeklyExpenses.length,
                    std_deviation: Math.round(stdDev * 100) / 100,
                    confidence: Math.round(confidence * 100) / 100,
                    calculated_at: new Date().toISOString()
                })
            patternsCreated++
        }
    }

    // Record that we did the analysis
    await supabase
        .from('cash_flow_sources')
        .upsert({
            user_id: user.id,
            source_type: 'historical_analysis',
            last_import_at: new Date().toISOString(),
            import_start_date: oneYearAgo.toISOString().split('T')[0],
            import_end_date: new Date().toISOString().split('T')[0],
            record_count: patternsCreated,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'user_id,source_type'
        })

    return { success: true, patternsCreated }
}

// Get current bank balance (opening balance + sum of all transactions)
export async function getCurrentBankBalance(): Promise<number> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Get user's opening balance
    const { data: settings } = await supabase
        .from('user_settings')
        .select('opening_balance')
        .eq('user_id', user.id)
        .single()

    const openingBalance = Number(settings?.opening_balance) || 0

    // Use direct SQL sum to bypass row limits
    const { data, error } = await supabase.rpc('get_transaction_balance', {
        p_user_id: user.id
    }).single()

    if (error) {
        // Fallback: paginate through all transactions if RPC doesn't exist
        let allTransactions: { amount: string | number }[] = []
        let offset = 0
        const pageSize = 1000

        while (true) {
            const { data: page } = await supabase
                .from('transactions')
                .select('amount')
                .eq('user_id', user.id)
                .range(offset, offset + pageSize - 1)

            if (!page || page.length === 0) break
            allTransactions = allTransactions.concat(page)
            if (page.length < pageSize) break
            offset += pageSize
        }

        const txSum = allTransactions.reduce((sum, tx) => sum + Number(tx.amount), 0)
        const balance = openingBalance + txSum
        console.log('[CashFlow] getCurrentBankBalance (paginated):', { openingBalance, txSum, balance: balance.toFixed(2) })
        return balance
    }

    const txSum = Number((data as { balance?: number })?.balance) || 0
    const balance = openingBalance + txSum
    console.log('[CashFlow] getCurrentBankBalance (RPC):', { openingBalance, txSum, balance: balance.toFixed(2) })
    return balance
}

// Set opening balance
export async function setOpeningBalance(balance: number, date?: string): Promise<{ success: boolean }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    await supabase
        .from('user_settings')
        .upsert({
            user_id: user.id,
            opening_balance: balance,
            opening_balance_date: date || new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'user_id'
        })

    return { success: true }
}

// Get user settings (gracefully handle missing table/columns)
export async function getUserSettings(): Promise<{ openingBalance: number; openingBalanceDate: string | null; dangerThreshold: number }> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("Unauthorized")

        const { data: settings, error } = await supabase
            .from('user_settings')
            .select('opening_balance, opening_balance_date, danger_threshold')
            .eq('user_id', user.id)
            .single()

        if (error) {
            // Table doesn't exist or columns don't exist - return defaults
            return {
                openingBalance: 0,
                openingBalanceDate: null,
                dangerThreshold: 2000
            }
        }

        return {
            openingBalance: Number(settings?.opening_balance) || 0,
            openingBalanceDate: settings?.opening_balance_date || null,
            dangerThreshold: Number(settings?.danger_threshold) || 2000
        }
    } catch (e) {
        // Return defaults if anything fails
        return {
            openingBalance: 0,
            openingBalanceDate: null,
            dangerThreshold: 2000
        }
    }
}

// Generate forecast for N weeks
export async function generateForecast(weeks: number): Promise<ForecastWeek[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Get current balance
    const currentBalance = await getCurrentBankBalance()

    // Get patterns
    const { data: patterns } = await supabase
        .from('cash_flow_patterns')
        .select('*')
        .eq('user_id', user.id)

    // Calculate future date for queries
    const futureEndDate = new Date()
    futureEndDate.setDate(futureEndDate.getDate() + (weeks * 7))

    // Get payables (unified accounts payable - replaces bills + invoices)
    const { data: payables } = await supabase
        .from('payables')
        .select('*, vendor:vendor_id(name), staff:staff_id(name)')
        .eq('user_id', user.id)
        .eq('is_paid', false)
        .in('bill_status', ['approved', 'scheduled', 'overdue'])

    // Get staff with weekly salary for payroll (keep for recurring weekly salaries)
    const { data: staff } = await supabase
        .from('staff')
        .select('id, name, weekly_salary, is_owner')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .gt('weekly_salary', 0)

    // Get scheduled payments (from Mindbody if imported)
    const { data: scheduledPayments } = await supabase
        .from('scheduled_payments')
        .select('*')
        .eq('user_id', user.id)
        .eq('payment_status', 'scheduled')
        .gte('scheduled_date', new Date().toISOString().split('T')[0])
        .lte('scheduled_date', futureEndDate.toISOString().split('T')[0])

    // Build forecast
    const forecast: ForecastWeek[] = []
    let runningBalance = currentBalance
    const today = new Date()
    const dangerThreshold = 2000 // Configurable later

    for (let w = 0; w < weeks; w++) {
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() + (w * 7))
        weekStart.setHours(0, 0, 0, 0)

        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 6)

        const weekOfMonth = Math.ceil(weekStart.getDate() / 7)
        const month = weekStart.getMonth() + 1

        let expectedInflows = 0
        let expectedOutflows = 0
        const incomeSources: { source: string; amount: number }[] = []
        const expenseSources: { source: string; amount: number }[] = []

        // 1. Check for scheduled payments in this week
        const weekScheduled = scheduledPayments?.filter(p => {
            const d = new Date(p.scheduled_date)
            return d >= weekStart && d <= weekEnd
        }) || []

        if (weekScheduled.length > 0) {
            const scheduledTotal = weekScheduled.reduce((sum, p) => sum + Number(p.amount), 0)
            expectedInflows += scheduledTotal
            incomeSources.push({ source: 'Mindbody Scheduled', amount: scheduledTotal })
        } else {
            // 2. Fall back to patterns
            const incomePatterns = patterns?.filter(p =>
                p.pattern_type === 'weekly_income' &&
                p.week_of_month === weekOfMonth &&
                p.month === month
            ) || []

            const patternIncome = incomePatterns.reduce((sum, p) => sum + Number(p.average_amount), 0)
            if (patternIncome > 0) {
                expectedInflows += patternIncome
                incomeSources.push({ source: 'Historical Pattern', amount: patternIncome })
            }
        }

        // OUTFLOWS: From Payables (unified - replaces bills + invoices)

        // Add payables due this week (or overdue in Week 1)
        payables?.forEach(payable => {
            if (payable.next_due) {
                const dueDate = new Date(payable.next_due)
                const isOverdue = dueDate < today

                // Include payable if:
                // 1. Due date falls within this week, OR
                // 2. It's overdue AND this is Week 1 (current week) - push to now
                if (dueDate >= weekStart && dueDate <= weekEnd) {
                    expectedOutflows += Number(payable.amount)
                    const payeeName = payable.vendor?.name || payable.staff?.name || payable.name
                    expenseSources.push({ source: payeeName, amount: Number(payable.amount) })
                } else if (isOverdue && w === 0) {
                    // Overdue payables appear in Week 1 as they need to be paid NOW
                    expectedOutflows += Number(payable.amount)
                    const payeeName = payable.vendor?.name || payable.staff?.name || payable.name
                    expenseSources.push({ source: `${payeeName} (Overdue)`, amount: Number(payable.amount) })
                }
            }
        })

        // 5. Add staff weekly salaries (every week)
        staff?.forEach(s => {
            if (s.weekly_salary && Number(s.weekly_salary) > 0) {
                const label = s.is_owner ? `Owner: ${s.name}` : `Staff: ${s.name}`
                expectedOutflows += Number(s.weekly_salary)
                expenseSources.push({ source: label, amount: Number(s.weekly_salary) })
            }
        })

        const netCashFlow = expectedInflows - expectedOutflows
        runningBalance += netCashFlow

        forecast.push({
            weekNumber: w + 1,
            weekStart,
            weekEnd,
            expectedInflows,
            expectedOutflows,
            netCashFlow,
            runningBalance,
            isHistorical: weekScheduled.length === 0,
            isDanger: runningBalance < dangerThreshold,
            sources: {
                income: incomeSources,
                expenses: expenseSources
            }
        })
    }

    return forecast
}

// Historical week type (with actuals)
export interface HistoricalWeek {
    weekNumber: number
    weekStart: Date
    weekEnd: Date
    actualInflows: number
    actualOutflows: number
    netCashFlow: number
    runningBalance: number
    isActual: true
    sources: {
        income: { source: string; amount: number }[]
        expenses: { source: string; amount: number }[]
    }
}

// Generate historical weeks with actual transaction data
export async function generateHistoricalWeeks(weeksBack: number): Promise<HistoricalWeek[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    if (weeksBack === 0) return []

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Calculate the start of the current week (Monday)
    const dayOfWeek = today.getDay()
    const diffToMonday = (dayOfWeek === 0 ? 6 : dayOfWeek - 1)
    const currentWeekStart = new Date(today)
    currentWeekStart.setDate(today.getDate() - diffToMonday)

    // Go back N weeks from current week start
    const historicalStartDate = new Date(currentWeekStart)
    historicalStartDate.setDate(historicalStartDate.getDate() - (weeksBack * 7))

    // Get opening balance setting
    const { data: settings } = await supabase
        .from('user_settings')
        .select('opening_balance')
        .eq('user_id', user.id)
        .single()
    const openingBalance = Number(settings?.opening_balance) || 0

    // Fetch ALL transactions up to the start of current week
    // This is needed to calculate running balance at end of each historical week
    const { data: allTransactions } = await supabase
        .from('transactions')
        .select('id, transaction_date, amount, raw_party, description, type')
        .eq('user_id', user.id)
        .lt('transaction_date', currentWeekStart.toISOString().split('T')[0])
        .order('transaction_date', { ascending: true })

    const historical: HistoricalWeek[] = []

    for (let w = weeksBack; w >= 1; w--) {
        const weekStart = new Date(currentWeekStart)
        weekStart.setDate(currentWeekStart.getDate() - (w * 7))

        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 6)

        // Use string dates for comparison to avoid timezone issues
        const weekStartStr = weekStart.toISOString().split('T')[0]
        const weekEndStr = weekEnd.toISOString().split('T')[0]

        // Transactions for THIS week only (for inflows/outflows display)
        const weekTransactions = allTransactions?.filter(tx => {
            return tx.transaction_date >= weekStartStr && tx.transaction_date <= weekEndStr
        }) || []

        // ALL transactions up to and including the end of this week (for balance)
        const transactionsUpToWeekEnd = allTransactions?.filter(tx => {
            return tx.transaction_date <= weekEndStr
        }) || []

        const incomeSources: { source: string; amount: number }[] = []
        const expenseSources: { source: string; amount: number }[] = []
        let actualInflows = 0
        let actualOutflows = 0

        weekTransactions.forEach(tx => {
            const amount = Math.abs(Number(tx.amount))
            const source = tx.raw_party || tx.description || 'Transaction'

            if (Number(tx.amount) > 0) {
                actualInflows += amount
                const existing = incomeSources.find(s => s.source === source)
                if (existing) {
                    existing.amount += amount
                } else {
                    incomeSources.push({ source, amount })
                }
            } else {
                actualOutflows += amount
                const existing = expenseSources.find(s => s.source === source)
                if (existing) {
                    existing.amount += amount
                } else {
                    expenseSources.push({ source, amount })
                }
            }
        })

        // Calculate balance at end of this week = opening balance + sum of all transactions up to this week
        const balanceAtWeekEnd = openingBalance + transactionsUpToWeekEnd.reduce((sum, tx) => sum + Number(tx.amount), 0)

        historical.push({
            weekNumber: -w,
            weekStart,
            weekEnd,
            actualInflows,
            actualOutflows,
            netCashFlow: actualInflows - actualOutflows,
            runningBalance: balanceAtWeekEnd,
            isActual: true,
            sources: {
                income: incomeSources.slice(0, 5),
                expenses: expenseSources.slice(0, 5)
            }
        })
    }

    return historical
}

// Get data freshness status
export async function getDataFreshness(): Promise<DataFreshness> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { data: sources } = await supabase
        .from('cash_flow_sources')
        .select('*')
        .eq('user_id', user.id)

    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const bankSource = sources?.find(s => s.source_type === 'bank')
    const mindbodyScheduled = sources?.find(s => s.source_type === 'mindbody_scheduled')
    const mindbodyFailed = sources?.find(s => s.source_type === 'mindbody_failed')
    const historicalAnalysis = sources?.find(s => s.source_type === 'historical_analysis')

    // Also check latest transaction date as proxy for bank freshness
    const { data: latestTx } = await supabase
        .from('transactions')
        .select('transaction_date')
        .eq('user_id', user.id)
        .order('transaction_date', { ascending: false })
        .limit(1)
        .single()

    const latestTxDate = latestTx ? new Date(latestTx.transaction_date) : null

    return {
        bank: {
            lastImport: latestTxDate,
            recordCount: 0,
            isStale: !latestTxDate || latestTxDate < sevenDaysAgo
        },
        mindbodyScheduled: {
            lastImport: mindbodyScheduled?.last_import_at ? new Date(mindbodyScheduled.last_import_at) : null,
            recordCount: mindbodyScheduled?.record_count || 0,
            isStale: !mindbodyScheduled || new Date(mindbodyScheduled.last_import_at) < sevenDaysAgo
        },
        mindbodyFailed: {
            lastImport: mindbodyFailed?.last_import_at ? new Date(mindbodyFailed.last_import_at) : null,
            recordCount: mindbodyFailed?.record_count || 0,
            isStale: !mindbodyFailed || new Date(mindbodyFailed.last_import_at) < sevenDaysAgo
        },
        patterns: {
            lastCalculated: historicalAnalysis?.last_import_at ? new Date(historicalAnalysis.last_import_at) : null,
            isStale: !historicalAnalysis
        }
    }
}

// Get pattern insights for display
export async function getPatternInsights(): Promise<{
    topIncomeWeeks: { weekOfMonth: number; month: number; avgAmount: number }[]
    topExpenseWeeks: { weekOfMonth: number; month: number; avgAmount: number }[]
    dangerWeeks: { weekOfMonth: number; month: number; netAmount: number }[]
    overallStats: { avgWeeklyIncome: number; avgWeeklyExpense: number; avgNet: number }
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { data: patterns } = await supabase
        .from('cash_flow_patterns')
        .select('*')
        .eq('user_id', user.id)

    if (!patterns || patterns.length === 0) {
        return {
            topIncomeWeeks: [],
            topExpenseWeeks: [],
            dangerWeeks: [],
            overallStats: { avgWeeklyIncome: 0, avgWeeklyExpense: 0, avgNet: 0 }
        }
    }

    const incomePatterns = patterns.filter(p => p.pattern_type === 'weekly_income')
    const expensePatterns = patterns.filter(p => p.pattern_type === 'weekly_expense')

    // Top income weeks
    const topIncomeWeeks = [...incomePatterns]
        .sort((a, b) => Number(b.average_amount) - Number(a.average_amount))
        .slice(0, 5)
        .map(p => ({
            weekOfMonth: p.week_of_month,
            month: p.month,
            avgAmount: Number(p.average_amount)
        }))

    // Top expense weeks
    const topExpenseWeeks = [...expensePatterns]
        .sort((a, b) => Number(b.average_amount) - Number(a.average_amount))
        .slice(0, 5)
        .map(p => ({
            weekOfMonth: p.week_of_month,
            month: p.month,
            avgAmount: Number(p.average_amount)
        }))

    // Calculate overall stats
    const totalIncome = incomePatterns.reduce((sum, p) => sum + Number(p.average_amount), 0)
    const totalExpense = expensePatterns.reduce((sum, p) => sum + Number(p.average_amount), 0)
    const avgWeeklyIncome = incomePatterns.length > 0 ? totalIncome / incomePatterns.length : 0
    const avgWeeklyExpense = expensePatterns.length > 0 ? totalExpense / expensePatterns.length : 0

    return {
        topIncomeWeeks,
        topExpenseWeeks,
        dangerWeeks: [], // TODO: Calculate based on net
        overallStats: {
            avgWeeklyIncome,
            avgWeeklyExpense,
            avgNet: avgWeeklyIncome - avgWeeklyExpense
        }
    }
}
