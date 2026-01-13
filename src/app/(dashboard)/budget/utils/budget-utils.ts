// Budget utility functions
import type { EditorCategoryGroup, EditorSubCategory } from '@/lib/actions/budget'

// Format currency with UK locale and commas
export function formatCurrency(amount: number): string {
    return amount.toLocaleString('en-GB', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })
}

// Get months for a quarter (1-based)
export function getQuarterMonths(quarter: 1 | 2 | 3 | 4): number[] {
    switch (quarter) {
        case 1: return [1, 2, 3]
        case 2: return [4, 5, 6]
        case 3: return [7, 8, 9]
        case 4: return [10, 11, 12]
    }
}

// Get month names for a quarter
export function getQuarterMonthNames(quarter: 1 | 2 | 3 | 4): string[] {
    const allMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const months = getQuarterMonths(quarter)
    return months.map(m => allMonths[m - 1])
}

// Get quarter description string
export function getQuarterDescription(quarter: 1 | 2 | 3 | 4): string {
    switch (quarter) {
        case 1: return 'Jan · Feb · Mar'
        case 2: return 'Apr · May · Jun'
        case 3: return 'Jul · Aug · Sep'
        case 4: return 'Oct · Nov · Dec'
    }
}

// Calculate group totals from subcategories
export function calculateGroupTotals(subCategories: EditorSubCategory[]): {
    budget: number
    reference: number
    change: number
} {
    const budget = subCategories.reduce((sum, s) => sum + s.budget, 0)
    const reference = subCategories.reduce((sum, s) => sum + s.reference, 0)
    return {
        budget,
        reference,
        change: budget - reference
    }
}

// Calculate class totals from groups
export function calculateClassTotals(categoryGroups: EditorCategoryGroup[]): {
    budget: number
    reference: number
    change: number
} {
    const budget = categoryGroups.reduce((sum, g) => sum + g.totalBudget, 0)
    const reference = categoryGroups.reduce((sum, g) => sum + g.totalReference, 0)
    return {
        budget,
        reference,
        change: budget - reference
    }
}

// Distribute yearly amount across 12 months evenly
export function distributeYearlyAmount(yearlyAmount: number): number[] {
    const monthlyBase = Math.floor((yearlyAmount / 12) * 100) / 100
    const remainder = Math.round((yearlyAmount - (monthlyBase * 11)) * 100) / 100

    // Months 1-11 get base amount, month 12 gets remainder
    return Array.from({ length: 12 }, (_, i) => i < 11 ? monthlyBase : remainder)
}

// Grid column class based on view mode
export function getGridColsClass(showMonthlyBreakdown: boolean, selectedMonth: number | null): string {
    if (showMonthlyBreakdown && selectedMonth === null) {
        return 'grid-cols-[1fr_80px_70px_70px_70px_90px_90px_90px]'
    }
    return 'grid-cols-[1fr_100px_100px_100px]'
}
