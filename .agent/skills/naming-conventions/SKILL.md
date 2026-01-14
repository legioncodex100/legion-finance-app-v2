---
name: naming-conventions
description: Naming conventions for Legion Finance codebase. Use when creating new files, functions, variables, or components. Ensures consistency across the project.
---

# Naming Conventions Skill

## When to Use
- Creating new files, folders, or components
- Naming variables, functions, and types
- Reviewing code for consistency

## File Naming

| Type | Convention | Example |
|------|------------|---------|
| React Components | `kebab-case.tsx` | `vendor-list.tsx`, `bill-modal.tsx` |
| Server Actions | `kebab-case.ts` | `payables.ts`, `in-flight-cash.ts` |
| Utilities | `kebab-case.ts` | `date-utils.ts`, `format-currency.ts` |
| Types (standalone) | `kebab-case.ts` | `payable-types.ts` |
| SQL Migrations | `kebab-case.sql` | `add-amount-paid.sql` |

## Component Naming

| Type | Convention | Example |
|------|------------|---------|
| Component name | `PascalCase` | `VendorList`, `BillModal` |
| Exported function | Match file | `export function VendorList()` |
| Page component | `PascalCase + Page` | `DashboardPage`, `TransactionsPage` |

```typescript
// File: src/components/vendor-list.tsx
export function VendorList({ vendors }: VendorListProps) {
    return <div>...</div>
}

// File: src/app/(dashboard)/page.tsx
export default function DashboardPage() {
    return <div>...</div>
}
```

## Function Naming

| Type | Pattern | Examples |
|------|---------|----------|
| Server actions (get) | `get` + Noun | `getPayables`, `getVendors`, `getTransactions` |
| Server actions (create) | `create` + Noun | `createPayable`, `createVendor` |
| Server actions (update) | `update` + Noun | `updatePayable`, `updateVendor` |
| Server actions (delete) | `delete` + Noun | `deletePayable`, `deleteVendor` |
| Server actions (other) | verb + Noun | `linkPayableToTransaction`, `syncStarlingTransactions` |
| Event handlers | `handle` + Event | `handleClick`, `handleSubmit`, `handleChange` |
| Render helpers | `render` + Thing | `renderStatusBadge`, `renderPayeeIcon` |
| Boolean getters | `is/has/can/should` | `isOverdue`, `hasPayments`, `canEdit` |

## Variable Naming

| Type | Convention | Examples |
|------|------------|----------|
| Boolean | `is/has/can/should` prefix | `isLoading`, `hasError`, `canDelete` |
| Arrays | Plural nouns | `payables`, `vendors`, `transactions` |
| Single items | Singular nouns | `payable`, `vendor`, `transaction` |
| Counts | noun + `Count` | `vendorCount`, `billCount` |
| IDs | noun + `Id` | `payableId`, `vendorId`, `userId` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_FILE_SIZE`, `API_TIMEOUT` |

## Type/Interface Naming

| Type | Convention | Examples |
|------|------------|----------|
| Interfaces | `PascalCase` | `Payable`, `Vendor`, `Transaction` |
| Props | Component + `Props` | `VendorListProps`, `BillModalProps` |
| Enums | `PascalCase` | `PayeeType`, `BillStatus`, `Frequency` |
| Type aliases | `PascalCase` | `PaymentMethod`, `ReconciliationStatus` |

```typescript
// Types
export interface Payable {
    id: string
    name: string
    amount: number
    // ...
}

export type PayeeType = 'vendor' | 'staff' | 'system'
export type BillStatus = 'draft' | 'scheduled' | 'paid' | 'voided'

// Props
interface VendorListProps {
    vendors: Vendor[]
    onSelect: (vendor: Vendor) => void
}
```

## React State Naming

```typescript
// State + setter follow [value, setValue] pattern
const [isLoading, setIsLoading] = React.useState(false)
const [payables, setPayables] = React.useState<Payable[]>([])
const [selectedPayable, setSelectedPayable] = React.useState<Payable | null>(null)
const [filterStatus, setFilterStatus] = React.useState<'all' | 'paid' | 'pending'>('all')
```

## Database Column Naming

| Convention | Examples |
|------------|----------|
| `snake_case` | `user_id`, `created_at`, `is_paid` |
| Booleans: `is_` prefix | `is_active`, `is_template`, `is_paid` |
| Timestamps: `_at` suffix | `created_at`, `updated_at`, `reconciled_at` |
| Foreign keys: `_id` suffix | `user_id`, `vendor_id`, `template_id` |
| Amounts: descriptive | `amount`, `amount_tax`, `amount_paid` |

## Avoid These Anti-Patterns

```typescript
// ❌ BAD: Vague names
const data = await getPayables()
const x = payable.amount
const temp = []
const flag = true

// ✅ GOOD: Descriptive names
const payables = await getPayables()
const billAmount = payable.amount
const unpaidBills = []
const isReconciled = true

// ❌ BAD: Hungarian notation
const strName = "John"
const arrItems = []
const objUser = {}

// ✅ GOOD: Just describe the thing
const name = "John"
const items = []
const user = {}
```
