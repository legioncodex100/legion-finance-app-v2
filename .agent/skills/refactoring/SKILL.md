---
name: refactoring
description: Refactoring patterns for Legion Finance. Use when cleaning up code, extracting common logic, or following DRY principles. Covers when to refactor and common refactoring techniques.
---

# Refactoring Skill

## When to Use
- Code review reveals duplication
- File exceeds size limits
- Adding a feature requires touching many files
- Tests are hard to write

## When to Refactor

| Signal | Action |
|--------|--------|
| Same code in 2+ places | Extract to shared function/component |
| File > 150 lines | Split by responsibility |
| Function > 50 lines | Extract helper functions |
| 3+ similar components | Create generic component |
| Hard to test | Break into smaller units |
| Frequently changing together | Colocate |

## DRY Principle (Don't Repeat Yourself)

```typescript
// ❌ BEFORE: Logic repeated in 3 places
// accounts-payable/page.tsx
const formatCurrency = (n: number) => `£${n.toFixed(2)}`

// transactions/page.tsx  
const formatCurrency = (n: number) => `£${n.toFixed(2)}`

// dashboard/page.tsx
const formatCurrency = (n: number) => `£${n.toFixed(2)}`

// ✅ AFTER: Extracted to shared utility
// src/lib/utils.ts
export const formatCurrency = (n: number) => `£${n.toFixed(2)}`

// All pages import from single source
import { formatCurrency } from '@/lib/utils'
```

## Extract Function

```typescript
// ❌ BEFORE: Long function with multiple responsibilities
async function processPayables() {
    const payables = await getPayables()
    
    // 20 lines of filtering logic
    const filtered = payables.filter(p => { ... })
    
    // 15 lines of sorting logic
    const sorted = filtered.sort((a, b) => { ... })
    
    // 25 lines of grouping logic
    const grouped = {}
    // ...
    
    return grouped
}

// ✅ AFTER: Extracted helper functions
async function processPayables() {
    const payables = await getPayables()
    const filtered = filterPayables(payables, filters)
    const sorted = sortPayables(filtered, sortConfig)
    const grouped = groupPayablesByVendor(sorted)
    return grouped
}

function filterPayables(payables: Payable[], filters: Filters): Payable[] { ... }
function sortPayables(payables: Payable[], config: SortConfig): Payable[] { ... }
function groupPayablesByVendor(payables: Payable[]): GroupedPayables { ... }
```

## Extract Component

```typescript
// ❌ BEFORE: UI logic repeated
{payables.map(p => (
    <div className="flex items-center gap-2">
        {p.payee_type === 'vendor' && <Building2 className="h-4 w-4 text-sky-400" />}
        {p.payee_type === 'staff' && <Users className="h-4 w-4 text-purple-400" />}
        {p.payee_type === 'system' && <Bot className="h-4 w-4 text-amber-400" />}
        <span>{p.name}</span>
    </div>
))}

// ✅ AFTER: Extracted component
function PayeeIcon({ type }: { type: PayeeType }) {
    switch (type) {
        case 'vendor': return <Building2 className="h-4 w-4 text-sky-400" />
        case 'staff': return <Users className="h-4 w-4 text-purple-400" />
        case 'system': return <Bot className="h-4 w-4 text-amber-400" />
    }
}

// Usage
{payables.map(p => (
    <div className="flex items-center gap-2">
        <PayeeIcon type={p.payee_type} />
        <span>{p.name}</span>
    </div>
))}
```

## Extract Custom Hook

```typescript
// ❌ BEFORE: Same data fetching pattern in multiple pages
function PayablesPage() {
    const [data, setData] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)
    
    useEffect(() => {
        setIsLoading(true)
        getPayables()
            .then(setData)
            .catch(setError)
            .finally(() => setIsLoading(false))
    }, [])
    // ...
}

// ✅ AFTER: Custom hook
function useData<T>(fetchFn: () => Promise<T>) {
    const [data, setData] = useState<T | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    
    const refetch = useCallback(async () => {
        setIsLoading(true)
        try {
            setData(await fetchFn())
        } catch (e: any) {
            setError(e.message)
        } finally {
            setIsLoading(false)
        }
    }, [fetchFn])
    
    useEffect(() => { refetch() }, [refetch])
    
    return { data, isLoading, error, refetch }
}

// Usage
const { data: payables, isLoading, refetch } = useData(getPayables)
```

## Refactoring Safety

1. **Don't refactor and add features at the same time**
   - First refactor, verify it works
   - Then add the feature

2. **Make small, incremental changes**
   - One extraction at a time
   - Build passes after each change

3. **Test before and after**
   - Verify behavior didn't change
   - Run `npm run build` after each step

## When NOT to Refactor

- Working on a deadline (unless it blocks progress)
- Code that's about to be deleted
- "Just in case" (premature optimization)
- Making it "more elegant" without clear benefit
