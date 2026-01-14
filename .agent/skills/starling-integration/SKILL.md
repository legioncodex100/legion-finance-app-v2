---
name: starling-integration
description: Starling Bank API patterns for Legion Finance. Use when syncing transactions, fetching balances, or debugging Starling-related issues. Covers API quirks and common gotchas.
---

# Starling Integration Skill

## When to Use
- Syncing bank transactions
- Fetching account balance
- Debugging Starling sync issues
- Working with transaction data

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/starling/client.ts` | API client class |
| `src/lib/actions/starling.ts` | Server actions for sync |
| `add-mb-matching-fields.sql` | Transaction matching schema |

## API Basics

```typescript
import { StarlingClient } from '@/lib/starling/client'

const client = new StarlingClient(process.env.STARLING_ACCESS_TOKEN!)
const accounts = await client.getAccounts()
const balance = await client.getBalance(accountUid)
const transactions = await client.getTransactions(accountUid, categoryUid, from, to)
```

## Critical Gotchas

### 1. Amounts Are in Minor Units (Pence)

```typescript
// ❌ WRONG: Treating as pounds
const amount = transaction.amount.minorUnits // 10000 = £100.00

// ✅ CORRECT: Convert to pounds
const amountInPounds = transaction.amount.minorUnits / 100 // 100.00
```

### 2. Date Range Must Include Full Day

When fetching "today's" transactions:

```typescript
// ❌ WRONG: Cuts off at midnight
const toDate = new Date().toISOString() // 2026-01-14T00:00:00Z

// ✅ CORRECT: Include full day until 23:59:59
const toDate = new Date()
toDate.setHours(23, 59, 59, 999)
const toDateStr = toDate.toISOString() // 2026-01-14T23:59:59Z
```

### 3. Balance Can Return Null on Error

```typescript
const balance = await getStarlingBalance()
// balance could be null if API fails
// Always handle: balance ?? 0
```

### 4. Transaction Direction

```typescript
// IN = Money coming in (deposits, payments received)
// OUT = Money going out (payments, transfers)

if (transaction.direction === 'IN') {
    // Credit
} else {
    // Debit
}
```

## Transaction Statuses

| Status | Meaning |
|--------|---------|
| `PENDING` | Not yet settled |
| `SETTLED` | Completed, funds moved |
| `DECLINED` | Failed |
| `REVERSED` | Reversed/refunded |

## Syncing Pattern

```typescript
export async function syncStarlingTransactions(fromDate: Date, toDate: Date) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const client = new StarlingClient(process.env.STARLING_ACCESS_TOKEN!)
    const accounts = await client.getAccounts()
    const account = accounts[0]

    // Ensure we get full day
    const toDateFull = new Date(toDate)
    toDateFull.setHours(23, 59, 59, 999)

    const transactions = await client.getTransactions(
        account.accountUid,
        account.defaultCategory,
        fromDate.toISOString(),
        toDateFull.toISOString()
    )

    // Upsert to avoid duplicates
    for (const txn of transactions.feedItems) {
        await supabase.from('transactions').upsert({
            starling_id: txn.feedItemUid,
            amount: txn.amount.minorUnits / 100,
            // ... map other fields
        }, { onConflict: 'starling_id' })
    }
}
```

## Matching Mindbody to Starling

Mindbody payments appear in Starling as:
- **Counterparty**: "MINDBODY" or similar
- **Reference**: May contain batch info
- **Timing**: 1-3 days after MB transaction

```typescript
// Look for Mindbody deposits
const mbDeposits = transactions.filter(t => 
    t.direction === 'IN' && 
    (t.counterPartyName?.includes('MINDBODY') || 
     t.reference?.includes('MINDBODY'))
)
```

## Error Handling

```typescript
try {
    const balance = await client.getBalance(accountUid)
    return balance.effectiveBalance.minorUnits / 100
} catch (error: any) {
    logger.error('STARLING', 'Failed to fetch balance', {
        error: error.message,
        accountUid
    })
    return null // Return null, not 0
}
```

## Testing Starling Integration

Use sandbox mode for testing:
```env
STARLING_SANDBOX=true
STARLING_ACCESS_TOKEN=sandbox-token
```
