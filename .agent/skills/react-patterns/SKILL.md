---
name: react-patterns
description: React patterns and best practices for Legion Finance. Use when building components, managing state, or creating custom hooks. Covers composition, state management, and performance.
---

# React Patterns Skill

## When to Use
- Building new components
- Managing complex state
- Deciding between useState/useReducer/context
- Creating custom hooks

## Component Composition

Prefer composition over prop drilling:

```tsx
// ❌ BAD: Prop drilling
<Dashboard 
    user={user}
    payables={payables}
    onPayableClick={handleClick}
    onPayableDelete={handleDelete}
    isLoading={isLoading}
/>

// ✅ GOOD: Composition with children
<Dashboard>
    <PayableList 
        payables={payables}
        onSelect={handleClick}
        onDelete={handleDelete}
    />
</Dashboard>
```

## State Management Decision Tree

```
What kind of state is it?
├── Form state (single component)?
│   └── useState
├── Complex state with many updates?
│   └── useReducer
├── Shared across 2-3 nearby components?
│   └── Lift state to common parent
├── App-wide (auth, theme)?
│   └── React Context
└── Server data (fetched from DB)?
    └── Server Actions + local state
```

## useState Patterns

```tsx
// ✅ Use functional updates when new state depends on old
setCount(prev => prev + 1)
setPayables(prev => [...prev, newPayable])
setSelectedIds(prev => {
    const next = new Set(prev)
    next.add(id)
    return next
})

// ✅ Initialize expensive state lazily
const [data, setData] = useState(() => computeExpensiveInitialValue())

// ✅ Group related state
const [formState, setFormState] = useState({
    name: '',
    amount: '',
    dueDate: ''
})
// Update: setFormState(prev => ({ ...prev, name: 'New' }))
```

## useEffect Patterns

```tsx
// ✅ Fetch on mount with cleanup
useEffect(() => {
    let cancelled = false
    
    async function fetchData() {
        const data = await getPayables()
        if (!cancelled) setPayables(data)
    }
    
    fetchData()
    return () => { cancelled = true }
}, [])

// ✅ Debounce search input
useEffect(() => {
    const timer = setTimeout(() => {
        setDebouncedSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
}, [searchQuery])

// ❌ AVOID: Effects for derived state
// Use useMemo instead
```

## useMemo and useCallback

```tsx
// ✅ useMemo for expensive calculations
const filteredPayables = useMemo(() => {
    return payables.filter(p => {
        if (filterStatus !== 'all' && p.status !== filterStatus) return false
        if (searchQuery && !p.name.includes(searchQuery)) return false
        return true
    })
}, [payables, filterStatus, searchQuery])

// ✅ useCallback for stable function references
const handleSelect = useCallback((id: string) => {
    setSelectedId(id)
}, [])

// ❌ AVOID: Memoizing everything - only for expensive ops or referential equality
```

## Custom Hook Pattern

Extract reusable logic into hooks:

```tsx
// src/hooks/use-payables.ts
export function usePayables(filters?: PayableFilters) {
    const [payables, setPayables] = useState<Payable[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    
    const fetchPayables = useCallback(async () => {
        setIsLoading(true)
        try {
            const data = await getPayables(filters)
            setPayables(data)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsLoading(false)
        }
    }, [filters])
    
    useEffect(() => {
        fetchPayables()
    }, [fetchPayables])
    
    return { payables, isLoading, error, refetch: fetchPayables }
}

// Usage
const { payables, isLoading, refetch } = usePayables({ status: 'pending' })
```

## Controlled vs Uncontrolled Components

```tsx
// ✅ Controlled: React owns the state
<input 
    value={name}
    onChange={(e) => setName(e.target.value)}
/>

// ✅ Uncontrolled: DOM owns the state (forms with ref)
const inputRef = useRef<HTMLInputElement>(null)
// Access: inputRef.current?.value

// In Legion Finance: prefer controlled for forms
```

## Event Handler Naming

```tsx
// In component definition
function BillModal() {
    const handleSubmit = () => { ... }
    const handleCancel = () => { ... }
    const handleAmountChange = (e) => { ... }
    
    return (
        <form onSubmit={handleSubmit}>
            <input onChange={handleAmountChange} />
            <button onClick={handleCancel}>Cancel</button>
        </form>
    )
}
```

## Conditional Rendering

```tsx
// ✅ Early return for loading/error states
if (isLoading) return <Loader />
if (error) return <ErrorMessage error={error} />
if (payables.length === 0) return <EmptyState />

return <PayableList payables={payables} />

// ✅ Inline conditionals for small pieces
{isLoading && <Spinner />}
{error && <Alert>{error}</Alert>}
{count > 0 && <Badge>{count}</Badge>}

// ✅ Ternary for two options
{isEditing ? <EditForm /> : <ViewMode />}
```
