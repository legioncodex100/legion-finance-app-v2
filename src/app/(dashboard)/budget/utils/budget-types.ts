// Budget page types
export type TabType = 'scenarios' | 'editor' | 'tracking'
export type EditorSubTab = 'yearly' | 'monthly'
export type Quarter = 1 | 2 | 3 | 4
export type MonthInQuarter = null | 1 | 2 | 3

// Re-export types from actions
export type {
    BudgetScenario,
    BvAClass,
    BvACategoryGroup,
    BvASubCategory,
    EditorClass,
    EditorCategoryGroup,
    EditorSubCategory,
    MonthlyBudgetRow,
    ActualsByMonth
} from '@/lib/actions/budget'
