# Refactoring Plan: 150-Line Compliance

## Goal
Split 15+ files exceeding 150 lines into maintainable, focused modules while preserving all existing functionality.

---

## Proposed Changes

### Server Actions (Phase 1 - Foundation)

These must be refactored first as page components import from them.

---

#### [MODIFY] [budget.ts](file:///Users/mohammed/Desktop/New%20Legion%20Finance%20App/legion-finance/src/lib/actions/budget.ts)

**Current:** 1,253 lines, 39 exports

**Split into:**
```
lib/actions/budget/
├── index.ts              (~20 lines) - Re-exports all
├── types.ts              (~60 lines) - BudgetScenario, BudgetItem, BvA* interfaces  
├── scenarios.ts          (~120 lines) - CRUD: create, get, rename, delete, duplicate
├── items.ts              (~80 lines) - getBudgetItems, updateBudgetItem
├── quarters.ts           (~50 lines) - lockQuarter, unlockQuarter
├── comparison.ts         (~150 lines) - getBudgetVsActual, getCategoryTransactions
├── editor.ts             (~120 lines) - getMonthlyBudgetData, updateMonthlyBudget
└── ai.ts                 (~60 lines) - cleanupBudgetNotes
```

---

#### [MODIFY] [transactions.ts](file:///Users/mohammed/Desktop/New%20Legion%20Finance%20App/legion-finance/src/lib/actions/transactions.ts)

**Current:** 854 lines, 27 exports

**Split into:**
```
lib/actions/transactions/
├── index.ts              (~15 lines) - Re-exports
├── import.ts             (~130 lines) - importTransactions, runAICategorization
├── crud.ts               (~100 lines) - delete, uncategorize, bulkReconcile
├── categories.ts         (~140 lines) - createCategory, updateCategory, quickCreate
├── billing.ts            (~100 lines) - linkTransactionToBill, unlink, getActiveBills
├── balance.ts            (~80 lines) - getOpeningBalance, setOpeningBalance
└── stats.ts              (~60 lines) - getSummaryStats
```

---

#### [MODIFY] [cash-flow.ts](file:///Users/mohammed/Desktop/New%20Legion%20Finance%20App/legion-finance/src/lib/actions/cash-flow.ts)

**Current:** 569 lines, 7 exports

**Split into:**
```
lib/actions/cash-flow/
├── index.ts              (~10 lines)
├── types.ts              (~40 lines) - CashFlowPattern, ForecastWeek, DataFreshness
├── patterns.ts           (~150 lines) - analyzeHistoricalPatterns, getPatternInsights
├── balance.ts            (~100 lines) - getCurrentBankBalance, setOpeningBalance
└── forecast.ts           (~150 lines) - generateForecast, getDataFreshness
```

---

#### [MODIFY] [rules.ts](file:///Users/mohammed/Desktop/New%20Legion%20Finance%20App/legion-finance/src/lib/actions/rules.ts)

**Current:** 540 lines, 10 exports

**Split into:**
```
lib/actions/rules/
├── index.ts              (~10 lines)
├── types.ts              (~50 lines) - ConditionField, RuleCondition, CreateRuleData
├── crud.ts               (~100 lines) - createRule, updateRule, deleteRule, getRules
├── engine.ts             (~150 lines) - runRulesEngine, evaluateRule
└── testing.ts            (~80 lines) - testRule, previewRule
```

---

### Page Components (Phase 2 - Highest Impact)

---

#### [MODIFY] [transactions/page.tsx](file:///Users/mohammed/Desktop/New%20Legion%20Finance%20App/legion-finance/src/app/(dashboard)/transactions/page.tsx)

**Current:** 1,484 lines, single function with 12 handlers

**Split into:**
```
app/(dashboard)/transactions/
├── page.tsx                          (~80 lines) - Shell, data fetching
├── components/
│   ├── TransactionTable.tsx          (~150 lines) - Table with selection
│   ├── TransactionFilters.tsx        (~100 lines) - Date/category filters
│   ├── TransactionRow.tsx            (~80 lines) - Single row rendering
│   ├── AddTransactionModal.tsx       (~140 lines) - Manual entry form
│   ├── BulkActionsBar.tsx            (~100 lines) - Delete/reconcile bulk
│   └── ImportSection.tsx             (~100 lines) - CSV upload
└── hooks/
    └── useTransactions.ts            (~150 lines) - State & all handlers
```

---

#### [MODIFY] [budget/page.tsx](file:///Users/mohammed/Desktop/New%20Legion%20Finance%20App/legion-finance/src/app/(dashboard)/budget/page.tsx)

**Current:** 1,502 lines, single function with 16 handlers

**Split into:**
```
app/(dashboard)/budget/
├── page.tsx                          (~80 lines) - Shell
├── components/
│   ├── ScenarioManager.tsx           (~120 lines) - Create/duplicate/delete
│   ├── ScenarioCard.tsx              (~80 lines) - Single scenario display
│   ├── BudgetEditor.tsx              (~150 lines) - Monthly grid editor
│   ├── BudgetTracking.tsx            (~150 lines) - BvA comparison view
│   ├── QuarterLockControls.tsx       (~80 lines) - Lock/unlock quarters
│   ├── CategoryRow.tsx               (~100 lines) - Expandable row
│   └── NotesPanel.tsx                (~80 lines) - Notes with AI cleanup
└── hooks/
    ├── useBudgetScenarios.ts         (~100 lines) - Scenario CRUD
    └── useBudgetEditor.ts            (~120 lines) - Editor state
```

---

#### [MODIFY] [debts/page.tsx](file:///Users/mohammed/Desktop/New%20Legion%20Finance%20App/legion-finance/src/app/(dashboard)/debts/page.tsx)

**Current:** 1,044 lines, 11 handlers

**Split into:**
```
app/(dashboard)/debts/
├── page.tsx                          (~80 lines)
├── components/
│   ├── DebtCard.tsx                  (~100 lines) - Card with progress
│   ├── DebtList.tsx                  (~80 lines) - Grid/list layout
│   ├── AddDebtModal.tsx              (~140 lines) - Add/edit form
│   ├── DebtTypeManager.tsx           (~80 lines) - Type CRUD
│   ├── DebtDetailModal.tsx           (~120 lines) - Full detail view
│   └── RepaymentHistory.tsx          (~80 lines) - Linked transactions
└── hooks/
    └── useDebts.ts                   (~120 lines) - State & handlers
```

---

#### [MODIFY] [bills/page.tsx](file:///Users/mohammed/Desktop/New%20Legion%20Finance%20App/legion-finance/src/app/(dashboard)/bills/page.tsx)

**Current:** 948 lines, 10 handlers

**Split into:**
```
app/(dashboard)/bills/
├── page.tsx                          (~80 lines)
├── components/
│   ├── BillCard.tsx                  (~100 lines) - Card with due status
│   ├── BillList.tsx                  (~80 lines) - List with filters
│   ├── AddBillModal.tsx              (~140 lines) - Add/edit form
│   ├── BillScanner.tsx               (~120 lines) - OCR upload
│   └── BillCalendar.tsx              (~100 lines) - Calendar view
└── hooks/
    └── useBills.ts                   (~120 lines) - State & handlers
```

---

### Shared Components (Phase 3)

---

#### [MODIFY] [reconciliation-modal.tsx](file:///Users/mohammed/Desktop/New%20Legion%20Finance%20App/legion-finance/src/components/reconciliation-modal.tsx)

**Current:** 1,578 lines (largest file!)

**Split into:**
```
components/reconciliation/
├── ReconciliationModal.tsx           (~100 lines) - Modal shell
├── CategorySelector.tsx              (~120 lines) - Category picker
├── PayeeSection.tsx                  (~100 lines) - Vendor/staff selection
├── DebtLinkingSection.tsx            (~100 lines) - Link to debt
├── AssetSection.tsx                  (~80 lines) - Asset linking
├── CreateCategoryFlow.tsx            (~120 lines) - Inline category creation
├── AISuggestionBadge.tsx             (~60 lines) - AI suggest button
└── hooks/
    └── useReconciliation.ts          (~150 lines) - All handlers
```

---

#### [MODIFY] [rules-management.tsx](file:///Users/mohammed/Desktop/New%20Legion%20Finance%20App/legion-finance/src/components/rules-management.tsx)

**Current:** 919 lines

**Split into:**
```
components/rules/
├── RulesManagement.tsx               (~100 lines) - Main component
├── RuleCard.tsx                      (~80 lines) - Single rule display
├── RuleEditor.tsx                    (~150 lines) - Create/edit form
├── ConditionBuilder.tsx              (~120 lines) - Dynamic conditions UI
├── RulePreview.tsx                   (~80 lines) - Test results
└── hooks/
    └── useRules.ts                   (~100 lines) - State & CRUD
```

---

## User Review Required

> [!IMPORTANT]
> **This is a significant refactoring effort** that will touch nearly every major file in the application. While each change preserves functionality, the scope is large enough that you may want to:
> 1. Tackle one phase at a time with testing between phases
> 2. Consider which files are most actively being developed
> 3. Prioritize based on pain points you're experiencing

> [!WARNING]
> **Import paths will change:** After splitting `lib/actions/budget.ts`, any file importing from it will need updates. The barrel export pattern (`index.ts`) minimizes this but some imports may need adjustment.

---

## Verification Plan

### Automated Tests
No existing tests found. Recommend adding tests incrementally during refactoring.

### Manual Verification

For each refactored module:

1. **Build Check**
   ```bash
   cd /Users/mohammed/Desktop/New\ Legion\ Finance\ App/legion-finance
   npm run build
   ```
   Should complete without errors.

2. **Runtime Verification**
   ```bash
   npm run dev
   ```
   Then manually test each affected page:
   - Navigate to the page
   - Verify all buttons/interactions work
   - Check console for errors

3. **Feature-Specific Tests**
   
   | Page | Test Actions |
   |------|--------------|
   | Transactions | Import CSV, filter, bulk delete, reconcile |
   | Budget | Create scenario, edit amounts, lock quarter |
   | Debts | Add debt, link payment, view history |
   | Bills | Add bill, scan document, mark paid |
   | Reconciliation Modal | Open on transaction, select category, save |

---

## Execution Approach

**Recommended order:**
1. Server actions first (no UI changes, purely organizational)
2. Test that all pages still work
3. Then tackle page components one at a time
4. Shared components last

Each file refactor is self-contained and can be done incrementally.
