---
name: supabase-best-practices
description: Critical Supabase gotchas for Legion Finance. Use when writing database queries, syncing data, or working with Supabase tables like mb_members, transactions, or payables.
---

# Supabase Best Practices for Legion Finance

## 🚨 CRITICAL: 1000 Row Limit

**Supabase returns a maximum of 1000 rows by default.** Always use pagination when querying tables that may have more than 1000 rows.

### Tables That Need Pagination
| Table | Typical Size | Needs Pagination |
|-------|-------------|------------------|
| `mb_members` | 2,770+ records | ✅ Yes |
| `mb_transactions` | 500+ records | ✅ Yes |
| `mb_memberships` | 2,770+ records | ✅ Yes |
| `transactions` | Growing | ✅ Yes |
| `payables` | ~50 records | ❌ Usually not |

### Pagination Pattern
```typescript
const allData: any[] = []
let offset = 0
const limit = 1000

while (true) {
    const { data } = await supabase
        .from("table_name")
        .select("*")
        .eq("user_id", user.id)
        .range(offset, offset + limit - 1)
    
    if (!data || data.length === 0) break
    allData.push(...data)
    if (data.length < limit) break
    offset += limit
}
```

## 🚨 CRITICAL: Mindbody API Parameter Names

**Mindbody API uses `request.` prefix for all parameters.** Always use this format:

| ✅ Correct | ❌ Wrong |
|-----------|----------|
| `request.limit` | `Limit` |
| `request.offset` | `Offset` |
| `request.clientIds` | `ClientIds` |
| `request.startSaleDateTime` | `StartSaleDateTime` |
| `request.transactionStartDateTime` | `TransactionStartDateTime` |
| `request.includeInactive` | `includeInactive` |

### Correct Pattern
```typescript
const params = new URLSearchParams()
params.set('request.limit', limit.toString())
params.set('request.offset', offset.toString())
```

## 🚨 CRITICAL: Transaction Status Values

**Mindbody transaction statuses are different from UI labels:**

| API Status | Meaning | Count as Revenue? |
|------------|---------|-------------------|
| `Approved` | Successful payment | ✅ Yes |
| `Approved (Voided)` | Reversed/failed | ❌ No |
| `Credit` | Refund | ❌ No |
| `Declined` | Declined | ❌ No |

## Best Practices Checklist

- [ ] Always `.toString()` IDs - Client IDs can be numbers or strings
- [ ] Check for null/undefined - API responses may have missing fields
- [ ] Use upsert with onConflict - To avoid duplicate key errors
- [ ] Add `user_id` filter to all queries for RLS
- [ ] Use `.single()` only when expecting exactly one row
