---
name: mindbody-integration
description: Mindbody API patterns for Legion Finance. Use when syncing members, transactions, or memberships. Covers API quirks, parameter formats, and common gotchas.
---

# Mindbody Integration Skill

## When to Use
- Syncing member data
- Fetching transactions
- Working with memberships
- Debugging Mindbody sync issues

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/mindbody/api.ts` | API client |
| `src/lib/actions/mindbody.ts` | Server actions |
| `src/app/api/webhooks/mindbody/route.ts` | Webhook handler |

## Critical Gotchas

### 1. Parameter Prefix: `request.`

**Mindbody uses `request.` prefix for ALL parameters!**

```typescript
// ❌ WRONG
const params = new URLSearchParams()
params.set('limit', '100')
params.set('offset', '0')

// ✅ CORRECT
const params = new URLSearchParams()
params.set('request.limit', '100')
params.set('request.offset', '0')
```

### 2. Transaction Status Values

| API Status | Meaning | Count as Revenue? |
|------------|---------|-------------------|
| `Approved` | Successful payment | ✅ Yes |
| `Approved (Voided)` | Reversed/failed | ❌ No |
| `Credit` | Refund | ❌ No |
| `Declined` | Failed payment | ❌ No |

```typescript
// Only count successful payments
const revenue = transactions
    .filter(t => t.status === 'Approved')
    .reduce((sum, t) => sum + t.amount, 0)
```

### 3. Pagination Required

Mindbody limits results. Always paginate:

```typescript
const allTransactions = []
let offset = 0
const limit = 100

while (true) {
    const params = new URLSearchParams()
    params.set('request.limit', limit.toString())
    params.set('request.offset', offset.toString())
    
    const { transactions } = await fetchMB('/transactions', params)
    
    if (!transactions?.length) break
    allTransactions.push(...transactions)
    
    if (transactions.length < limit) break
    offset += limit
}
```

### 4. Client IDs Are Sometimes Numbers

```typescript
// Always convert to string for consistency
const clientId = String(client.Id)
const clientIds = clients.map(c => String(c.Id))
```

### 5. Date Parameter Format

```typescript
// Use ISO format for dates
params.set('request.startSaleDateTime', '2026-01-01T00:00:00Z')
params.set('request.transactionStartDateTime', fromDate.toISOString())
```

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/client/clients` | Get all members |
| `/client/clientaccountbalances` | Get member debts |
| `/sale/sales` | Get transactions |
| `/sale/contracts` | Get memberships |

## Common Parameters

```typescript
// Get clients
params.set('request.limit', '100')
params.set('request.offset', '0')
params.set('request.includeInactive', 'true')

// Get transactions
params.set('request.startSaleDateTime', startDate)
params.set('request.endSaleDateTime', endDate)
params.set('request.transactionStartDateTime', startDate)
params.set('request.transactionEndDateTime', endDate)
```

## Rate Limiting

Mindbody has rate limits. Handle 429 errors:

```typescript
if (response.status === 429) {
    logger.warn('MINDBODY', 'Rate limited, waiting 60s')
    await new Promise(r => setTimeout(r, 60000))
    return fetchMB(endpoint, params) // Retry
}
```

## Syncing Pattern

```typescript
export async function syncMindbodyMembers() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')
    
    let offset = 0
    const limit = 100
    let synced = 0
    
    while (true) {
        const { Clients } = await fetchClients(offset, limit)
        
        if (!Clients?.length) break
        
        for (const client of Clients) {
            await supabase.from('mb_members').upsert({
                user_id: user.id,
                mb_client_id: String(client.Id),
                first_name: client.FirstName,
                last_name: client.LastName,
                email: client.Email,
                status: client.Status,
                // ... other fields
            }, { onConflict: 'mb_client_id' })
            
            synced++
        }
        
        if (Clients.length < limit) break
        offset += limit
    }
    
    logger.info('MINDBODY', 'Sync complete', { synced })
    return synced
}
```

## Calculating MRR

```typescript
// MRR = Sum of active recurring membership values
const mrr = memberships
    .filter(m => m.ActiveDate && !m.EndDate && m.AutoPay)
    .reduce((sum, m) => sum + (m.Amount || 0), 0)
```

## Webhooks

Mindbody can send webhooks for events. Handle them at:
`/api/webhooks/mindbody`

```typescript
export async function POST(request: Request) {
    const body = await request.json()
    
    switch (body.eventId) {
        case 'client.created':
            await handleNewClient(body.eventData)
            break
        case 'sale.created':
            await handleNewSale(body.eventData)
            break
    }
    
    return Response.json({ received: true })
}
```
