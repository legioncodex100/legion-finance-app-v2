---
name: error-handling
description: Error handling patterns for Legion Finance. Use when writing try-catch blocks, handling API errors, or displaying error messages to users. Ensures consistent error handling across the app.
---

# Error Handling Skill

## When to Use
- Writing database queries
- Making API calls
- Handling form submissions
- Displaying errors to users

## Server Action Error Pattern

```typescript
"use server"

export async function createPayable(data: CreatePayableInput) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    // 1. Auth check
    if (!user) {
        throw new Error("Unauthorized")
    }
    
    // 2. Database operation with error handling
    const { data: payable, error } = await supabase
        .from('payables')
        .insert({ ...data, user_id: user.id })
        .select()
        .single()
    
    // 3. Throw on database error (caught by caller)
    if (error) throw error
    
    // 4. Return success
    return payable
}
```

## Client-Side Error Handling

```typescript
const handleSubmit = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
        await createPayable(formData)
        // Success: close modal, refresh data
        setIsModalOpen(false)
        await fetchData()
    } catch (err: any) {
        // Display user-friendly message
        setError(err.message || "Failed to create bill. Please try again.")
        console.error('Create payable error:', err)
    } finally {
        setIsLoading(false)
    }
}
```

## Supabase Error Codes

Handle specific Supabase errors gracefully:

```typescript
const { data, error } = await supabase.from('table').select('*')

if (error) {
    switch (error.code) {
        case '42703':  // Column doesn't exist
            console.warn('Migration needed:', error.message)
            return { data: [], needsMigration: true }
        case '23505':  // Unique violation
            throw new Error('This record already exists')
        case '23503':  // Foreign key violation
            throw new Error('Referenced record not found')
        case 'PGRST116':  // No rows returned for .single()
            return null
        default:
            throw error
    }
}
```

## API Error Response Pattern

```typescript
// src/app/api/webhooks/example/route.ts
export async function POST(request: Request) {
    try {
        const body = await request.json()
        // ... process webhook
        return Response.json({ success: true })
    } catch (error: any) {
        console.error('[WEBHOOK] Error:', error)
        return Response.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
```

## Graceful Degradation

When a feature fails, don't crash the whole page:

```typescript
// Dashboard fetching multiple data sources
const fetchDashboardData = async () => {
    try {
        const [payables, balance, inFlight] = await Promise.all([
            getPayables().catch(() => []),           // Return empty array on failure
            getStarlingBalance().catch(() => null),  // Return null on failure
            getInFlightCash().catch(() => ({ amount: 0, count: 0 }))
        ])
        
        setStats({
            payables,
            balance: balance ?? 0,  // Show 0 if null (with indicator)
            inFlight
        })
    } catch (err) {
        // Only reaches here if all fail
        setGlobalError('Failed to load dashboard data')
    }
}
```

## User-Friendly Error Messages

```typescript
// Map technical errors to user-friendly messages
function getUserMessage(error: any): string {
    const message = error.message?.toLowerCase() || ''
    
    if (message.includes('unauthorized')) {
        return 'Please log in to continue'
    }
    if (message.includes('network') || message.includes('fetch')) {
        return 'Network error. Please check your connection.'
    }
    if (message.includes('already exists')) {
        return 'This item already exists'
    }
    if (message.includes('not found')) {
        return 'Item not found. It may have been deleted.'
    }
    
    // Default message
    return 'Something went wrong. Please try again.'
}
```

## Logging Best Practices

```typescript
// Include context in logs
console.error('[PAYABLES] Failed to link transaction:', {
    payableId,
    transactionId,
    error: error.message,
    code: error.code
})

// Use prefixes for different areas
// [PAYABLES] [STARLING] [MINDBODY] [AUTH] [WEBHOOK]
```

## Error UI Component Pattern

```tsx
{error && (
    <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
        <AlertCircle className="h-4 w-4 inline mr-2" />
        {error}
    </div>
)}
```
