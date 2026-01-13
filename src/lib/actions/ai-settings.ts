"use server"

import { createClient } from "@/lib/supabase/server"
import { AISettings, DEFAULT_AI_SETTINGS } from "@/lib/ai/settings"

// Get AI settings for current user
export async function getAISettings(): Promise<AISettings> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return DEFAULT_AI_SETTINGS

    const { data } = await supabase
        .from('user_settings')
        .select('ai_settings')
        .eq('user_id', user.id)
        .single()

    if (!data?.ai_settings) return DEFAULT_AI_SETTINGS

    return {
        ...DEFAULT_AI_SETTINGS,
        ...data.ai_settings,
    }
}

// Update AI settings for current user
export async function updateAISettings(settings: Partial<AISettings>): Promise<{ success: boolean }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false }

    // Get existing settings
    const currentSettings = await getAISettings()
    const newSettings = { ...currentSettings, ...settings }

    // Upsert user_settings
    const { error } = await supabase
        .from('user_settings')
        .upsert({
            user_id: user.id,
            ai_settings: newSettings,
            updated_at: new Date().toISOString(),
        }, {
            onConflict: 'user_id'
        })

    return { success: !error }
}

// Get dynamic financial context for AI
export async function getFinancialContext(): Promise<{
    ytdRevenue: number
    ytdExpenses: number
    ytdNetProfit: number
    currentCashBalance: number
    topExpenseCategories: { name: string; amount: number }[]
    recentTransactionsCount: number
    lastSyncDate: string | null
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return {
            ytdRevenue: 0,
            ytdExpenses: 0,
            ytdNetProfit: 0,
            currentCashBalance: 0,
            topExpenseCategories: [],
            recentTransactionsCount: 0,
            lastSyncDate: null,
        }
    }

    const currentYear = new Date().getFullYear()
    const yearStart = `${currentYear}-01-01`

    // Fetch YTD transactions
    const { data: transactions } = await supabase
        .from('transactions')
        .select('amount, type, category_id, categories(name)')
        .eq('user_id', user.id)
        .gte('transaction_date', yearStart)

    let ytdRevenue = 0
    let ytdExpenses = 0
    const expensesByCategory: Record<string, number> = {}

    transactions?.forEach(tx => {
        if (tx.type === 'income' || tx.amount > 0) {
            ytdRevenue += Math.abs(tx.amount)
        } else {
            ytdExpenses += Math.abs(tx.amount)
            const catName = (tx.categories as any)?.name || 'Uncategorized'
            expensesByCategory[catName] = (expensesByCategory[catName] || 0) + Math.abs(tx.amount)
        }
    })

    // Get cash balance
    const { data: settings } = await supabase
        .from('user_settings')
        .select('opening_balance')
        .eq('user_id', user.id)
        .single()

    const openingBalance = settings?.opening_balance || 0
    const currentCashBalance = openingBalance + ytdRevenue - ytdExpenses

    // Sort expense categories
    const topExpenseCategories = Object.entries(expensesByCategory)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5)

    // Get last sync date
    const { data: lastSync } = await supabase
        .from('integrations')
        .select('last_sync_at')
        .eq('user_id', user.id)
        .eq('provider', 'mindbody')
        .single()

    return {
        ytdRevenue: Math.round(ytdRevenue * 100) / 100,
        ytdExpenses: Math.round(ytdExpenses * 100) / 100,
        ytdNetProfit: Math.round((ytdRevenue - ytdExpenses) * 100) / 100,
        currentCashBalance: Math.round(currentCashBalance * 100) / 100,
        topExpenseCategories,
        recentTransactionsCount: transactions?.length || 0,
        lastSyncDate: lastSync?.last_sync_at || null,
    }
}
