"use client"

import * as React from "react"
import { Loader2, TrendingUp, Landmark, Scale, ChevronDown, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Card,
} from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { getOpeningBalance } from "@/lib/actions/transactions"

interface Asset {
    id: string
    name: string
    asset_type: 'fixed' | 'current'
    category?: string
    purchase_date?: string
    purchase_price: number
    current_value?: number
    depreciation_method?: string
    useful_life_years?: number
    salvage_value?: number
    status: string
}

interface Debt {
    id: string
    name?: string
    creditor_name: string
    remaining_balance: number
    status: string
}

export default function BalanceSheetPage() {
    const [assets, setAssets] = React.useState<Asset[]>([])
    const [debts, setDebts] = React.useState<Debt[]>([])
    const [cashBalance, setCashBalance] = React.useState(0)
    const [openingBalance, setOpeningBalance] = React.useState(0)
    const [isLoading, setIsLoading] = React.useState(true)
    const [expandedSections, setExpandedSections] = React.useState<Set<string>>(new Set(['assets', 'liabilities', 'equity']))

    const supabase = createClient()

    const fetchData = React.useCallback(async () => {
        setIsLoading(true)

        // Fetch assets
        const { data: assetsData } = await supabase
            .from('assets')
            .select('*')
            .eq('status', 'active')

        if (assetsData) setAssets(assetsData)

        // Fetch debts
        const { data: debtsData } = await supabase
            .from('debts')
            .select('*')
            .neq('status', 'paid_off')

        if (debtsData) setDebts(debtsData)

        // Fetch cash from transactions
        const { data: txData } = await supabase
            .from('transactions')
            .select('amount')

        const totalTransactions = txData?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0

        // Get opening balance
        const opening = await getOpeningBalance()
        setOpeningBalance(opening)
        setCashBalance(opening + totalTransactions)

        setIsLoading(false)
    }, [supabase])

    React.useEffect(() => {
        fetchData()
    }, [fetchData])

    const toggleSection = (section: string) => {
        const newSet = new Set(expandedSections)
        if (newSet.has(section)) {
            newSet.delete(section)
        } else {
            newSet.add(section)
        }
        setExpandedSections(newSet)
    }

    // Calculate depreciation for fixed assets
    const calculateDepreciation = (asset: Asset): number => {
        if (!asset.purchase_date || !asset.useful_life_years || asset.depreciation_method === 'none') {
            return asset.purchase_price
        }
        const purchaseDate = new Date(asset.purchase_date)
        const now = new Date()
        const yearsElapsed = (now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365)
        const salvage = asset.salvage_value || 0
        const annualDepreciation = (asset.purchase_price - salvage) / asset.useful_life_years
        const totalDepreciation = Math.min(annualDepreciation * yearsElapsed, asset.purchase_price - salvage)
        return Math.max(asset.purchase_price - totalDepreciation, salvage)
    }

    // Calculate totals
    const fixedAssets = assets.filter(a => a.asset_type === 'fixed')
    const currentAssets = assets.filter(a => a.asset_type === 'current')

    const totalFixedAssets = fixedAssets.reduce((sum, a) => sum + calculateDepreciation(a), 0)
    const totalCurrentAssets = currentAssets.reduce((sum, a) => sum + (a.current_value || a.purchase_price), 0)
    const totalAssets = cashBalance + totalFixedAssets + totalCurrentAssets

    const totalLiabilities = debts.reduce((sum, d) => sum + d.remaining_balance, 0)
    const totalEquity = totalAssets - totalLiabilities

    const formatCurrency = (amount: number) => {
        const sign = amount < 0 ? '-' : ''
        return `${sign}£${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
            </div>
        )
    }

    return (
        <div className="max-w-[1000px] mx-auto pb-20 space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">Balance Sheet</h1>
                <p className="text-zinc-500 font-medium">Financial position as of {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>

            {/* Balance Sheet Card */}
            <Card className="bg-zinc-950 border-zinc-900 overflow-hidden">
                {/* ASSETS */}
                <div className="border-b border-zinc-900">
                    <button
                        onClick={() => toggleSection('assets')}
                        className="w-full p-5 flex justify-between items-center hover:bg-zinc-900/30 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            {expandedSections.has('assets') ? <ChevronDown className="h-4 w-4 text-zinc-500" /> : <ChevronRight className="h-4 w-4 text-zinc-500" />}
                            <TrendingUp className="h-5 w-5 text-emerald-500" />
                            <span className="font-bold text-white uppercase tracking-wider text-sm">Assets</span>
                        </div>
                        <span className="text-xl font-bold text-emerald-500 tabular-nums">{formatCurrency(totalAssets)}</span>
                    </button>

                    {expandedSections.has('assets') && (
                        <div className="px-5 pb-5 pt-0 space-y-3">
                            {/* Cash */}
                            <div className="flex justify-between items-center py-2 border-b border-zinc-900/50">
                                <span className="text-zinc-400 font-medium">Cash & Bank</span>
                                <span className="font-bold text-white tabular-nums">{formatCurrency(cashBalance)}</span>
                            </div>

                            {/* Fixed Assets */}
                            {fixedAssets.length > 0 && (
                                <div className="py-2 border-b border-zinc-900/50">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-zinc-400 font-medium">Fixed Assets</span>
                                        <span className="font-bold text-white tabular-nums">{formatCurrency(totalFixedAssets)}</span>
                                    </div>
                                    <div className="pl-4 space-y-1">
                                        {fixedAssets.map(asset => (
                                            <div key={asset.id} className="flex justify-between text-sm">
                                                <span className="text-zinc-600">{asset.name}</span>
                                                <span className="text-zinc-400 tabular-nums">{formatCurrency(calculateDepreciation(asset))}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Current Assets */}
                            {currentAssets.length > 0 && (
                                <div className="py-2">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-zinc-400 font-medium">Current Assets</span>
                                        <span className="font-bold text-white tabular-nums">{formatCurrency(totalCurrentAssets)}</span>
                                    </div>
                                    <div className="pl-4 space-y-1">
                                        {currentAssets.map(asset => (
                                            <div key={asset.id} className="flex justify-between text-sm">
                                                <span className="text-zinc-600">{asset.name}</span>
                                                <span className="text-zinc-400 tabular-nums">{formatCurrency(asset.current_value || asset.purchase_price)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* LIABILITIES */}
                <div className="border-b border-zinc-900">
                    <button
                        onClick={() => toggleSection('liabilities')}
                        className="w-full p-5 flex justify-between items-center hover:bg-zinc-900/30 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            {expandedSections.has('liabilities') ? <ChevronDown className="h-4 w-4 text-zinc-500" /> : <ChevronRight className="h-4 w-4 text-zinc-500" />}
                            <Landmark className="h-5 w-5 text-rose-500" />
                            <span className="font-bold text-white uppercase tracking-wider text-sm">Liabilities</span>
                        </div>
                        <span className="text-xl font-bold text-rose-500 tabular-nums">{formatCurrency(totalLiabilities)}</span>
                    </button>

                    {expandedSections.has('liabilities') && (
                        <div className="px-5 pb-5 pt-0 space-y-1">
                            {debts.length === 0 ? (
                                <p className="text-zinc-600 text-sm py-2">No outstanding liabilities</p>
                            ) : (
                                debts.map(debt => (
                                    <div key={debt.id} className="flex justify-between py-2 border-b border-zinc-900/50 last:border-0">
                                        <div>
                                            <span className="text-zinc-400 font-medium">{debt.name || debt.creditor_name}</span>
                                            {debt.name && <span className="text-zinc-600 text-xs ml-2">({debt.creditor_name})</span>}
                                        </div>
                                        <span className="font-bold text-white tabular-nums">{formatCurrency(debt.remaining_balance)}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* EQUITY */}
                <div>
                    <button
                        onClick={() => toggleSection('equity')}
                        className="w-full p-5 flex justify-between items-center hover:bg-zinc-900/30 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            {expandedSections.has('equity') ? <ChevronDown className="h-4 w-4 text-zinc-500" /> : <ChevronRight className="h-4 w-4 text-zinc-500" />}
                            <Scale className="h-5 w-5 text-indigo-500" />
                            <span className="font-bold text-white uppercase tracking-wider text-sm">Equity</span>
                        </div>
                        <span className={cn("text-xl font-bold tabular-nums", totalEquity >= 0 ? "text-indigo-500" : "text-rose-500")}>{formatCurrency(totalEquity)}</span>
                    </button>

                    {expandedSections.has('equity') && (
                        <div className="px-5 pb-5 pt-0">
                            <div className="flex justify-between py-2 border-b border-zinc-900/50">
                                <span className="text-zinc-400 font-medium">Retained Earnings</span>
                                <span className="font-bold text-white tabular-nums">{formatCurrency(totalEquity)}</span>
                            </div>
                            <p className="text-[10px] text-zinc-600 mt-2 uppercase tracking-wider">
                                Calculated as: Total Assets - Total Liabilities
                            </p>
                        </div>
                    )}
                </div>
            </Card>

            {/* Accounting Equation */}
            <Card className="bg-white text-black border-none p-6">
                <div className="flex items-center justify-center gap-4 text-center">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1">Assets</p>
                        <p className="text-2xl font-black">{formatCurrency(totalAssets)}</p>
                    </div>
                    <span className="text-2xl font-bold text-black/20">=</span>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1">Liabilities</p>
                        <p className="text-2xl font-black">{formatCurrency(totalLiabilities)}</p>
                    </div>
                    <span className="text-2xl font-bold text-black/20">+</span>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1">Equity</p>
                        <p className="text-2xl font-black">{formatCurrency(totalEquity)}</p>
                    </div>
                </div>
            </Card>
        </div>
    )
}
