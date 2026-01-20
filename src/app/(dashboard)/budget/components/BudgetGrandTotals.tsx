'use client'

import { formatCurrency, GrandTotals } from '../utils'

interface BudgetGrandTotalsProps {
    totals: GrandTotals
    gridColumns?: string
}

/**
 * Displays P&L summary with Revenue, Expenses, and Net totals.
 * Used in both CategoryHierarchyTable and MonthlyBudgetEditor.
 */
export function BudgetGrandTotals({ totals, gridColumns = '1fr 130px 130px 100px' }: BudgetGrandTotalsProps) {
    const { revenue, expenses, net } = totals

    const rows = [
        { label: 'Total Revenue', data: revenue, isIncome: true },
        { label: 'Total Expenses', data: expenses, isIncome: false },
        { label: 'Net Profit/Loss', data: net, isNet: true }
    ]

    return (
        <div className="border-t-2 border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800/50">
            {rows.map(({ label, data, isIncome, isNet }) => {
                // For Net: positive is good, negative is bad
                // For Revenue change: positive is good (more than reference)
                // For Expenses change: negative is good (less than reference)
                const changeColor = isNet
                    ? data.change >= 0 ? 'text-emerald-600' : 'text-red-600'
                    : isIncome
                        ? data.change >= 0 ? 'text-emerald-600' : 'text-red-600'
                        : data.change <= 0 ? 'text-emerald-600' : 'text-red-600'

                return (
                    <div
                        key={label}
                        className={`grid gap-3 px-4 py-2 text-sm font-semibold ${isNet ? 'bg-zinc-200 dark:bg-zinc-700/50' : ''}`}
                        style={{ gridTemplateColumns: gridColumns }}
                    >
                        <div className="sticky left-0 z-10 bg-inherit">{label}</div>
                        <div className="text-right tabular-nums text-muted-foreground">
                            £{formatCurrency(data.reference)}
                        </div>
                        <div className="text-right tabular-nums">
                            £{formatCurrency(data.budget)}
                        </div>
                        <div className={`text-right tabular-nums ${changeColor}`}>
                            {data.change >= 0 ? '+' : ''}£{formatCurrency(data.change)}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
