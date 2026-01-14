---
name: typescript-types
description: TypeScript patterns for Legion Finance. Use when defining interfaces, handling nullability, or organizing type definitions. Covers types vs interfaces, generics, and common patterns.
---

# TypeScript Types Skill

## When to Use
- Creating new data structures
- Handling null/undefined values
- Organizing type definitions
- Type narrowing and guards

## Types vs Interfaces

```typescript
// ✅ Use INTERFACE for object shapes (extensible)
interface Payable {
    id: string
    name: string
    amount: number
}

// ✅ Use TYPE for unions, primitives, tuples
type PayeeType = 'vendor' | 'staff' | 'system'
type BillStatus = 'draft' | 'scheduled' | 'paid' | 'voided'
type Nullable<T> = T | null
```

## Where to Define Types

```typescript
// Option 1: Export from action files (preferred for Legion)
// src/lib/actions/payables.ts
export interface Payable { ... }
export type PayeeType = 'vendor' | 'staff' | 'system'

// Option 2: Dedicated types file (for shared/complex types)
// src/types/financial.ts
export interface MonthlyReport { ... }

// Import in components
import type { Payable, PayeeType } from '@/lib/actions/payables'
```

## Handling Nullability

```typescript
// ✅ Be explicit about null/undefined
interface Payable {
    id: string                           // Required
    name: string                         // Required
    vendor_id: string | null             // Explicitly nullable
    notes?: string                       // Optional (may be undefined)
    linked_transaction_id: string | null // Explicitly nullable
}

// ✅ Use nullish coalescing
const vendorName = payable.vendor?.name ?? 'Unknown'
const amountPaid = payable.amount_paid ?? 0

// ✅ Use optional chaining
const vendorEmail = payable.vendor?.email?.toLowerCase()
```

## Component Props

```typescript
// ✅ Define props interface in same file
interface PayableListProps {
    payables: Payable[]
    onSelect: (payable: Payable) => void
    isLoading?: boolean  // Optional with default
}

export function PayableList({ 
    payables, 
    onSelect, 
    isLoading = false 
}: PayableListProps) {
    // ...
}

// ✅ For children
interface LayoutProps {
    children: React.ReactNode
}
```

## State Types

```typescript
// ✅ Type useState explicitly when needed
const [payable, setPayable] = React.useState<Payable | null>(null)
const [payables, setPayables] = React.useState<Payable[]>([])
const [status, setStatus] = React.useState<BillStatus>('scheduled')

// ✅ For complex state
interface FormState {
    name: string
    amount: string
    payeeType: PayeeType
    vendorId: string | null
}
const [form, setForm] = React.useState<FormState>({
    name: '',
    amount: '',
    payeeType: 'vendor',
    vendorId: null
})
```

## Function Return Types

```typescript
// ✅ Type return values for server actions
export async function getPayables(): Promise<Payable[]> {
    // ...
}

export async function getPayable(id: string): Promise<Payable | null> {
    // ...
}

export async function createPayable(data: CreatePayableInput): Promise<Payable> {
    // ...
}

// ✅ Use | null for single items that may not exist
// ✅ Use [] (empty array) for lists that may be empty
```

## Utility Types

```typescript
// Partial - all properties optional
type UpdatePayableInput = Partial<Payable>

// Pick - select specific properties
type PayableSummary = Pick<Payable, 'id' | 'name' | 'amount'>

// Omit - exclude properties
type CreatePayableInput = Omit<Payable, 'id' | 'user_id' | 'created_at'>

// Record - object with specific key/value types
type PayablesByStatus = Record<BillStatus, Payable[]>
```

## Type Guards

```typescript
// ✅ Narrow types with guards
function isVendorPayable(p: Payable): p is Payable & { vendor_id: string } {
    return p.payee_type === 'vendor' && p.vendor_id !== null
}

// Usage
if (isVendorPayable(payable)) {
    // TypeScript knows vendor_id is string here
    console.log(payable.vendor_id)
}
```

## Database Types Pattern

```typescript
// Match database snake_case columns
interface PayableRow {
    id: string
    user_id: string
    name: string
    amount: number
    amount_paid: number
    amount_tax: number
    is_paid: boolean
    bill_status: BillStatus
    next_due: string  // ISO date string from DB
    vendor_id: string | null
    staff_id: string | null
    created_at: string
    updated_at: string
}

// With joined relations (from Supabase select)
interface PayableWithRelations extends PayableRow {
    vendors?: { name: string } | null
    staff?: { name: string } | null
    categories?: { name: string } | null
}
```

## Common Patterns

```typescript
// ✅ Event handlers
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value)
}

const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    // ...
}

const handleSelect = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    // ...
}

// ✅ Callback props
interface Props {
    onSelect: (item: Item) => void
    onDelete: (id: string) => Promise<void>
    onChange?: (value: string) => void  // Optional
}
```
