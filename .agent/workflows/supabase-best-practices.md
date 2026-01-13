---
description: Critical Supabase gotchas and best practices to always follow
---

# Supabase Best Practices - MUST REMEMBER

## 🚨 CRITICAL: 1000 Row Limit

**Supabase returns a maximum of 1000 rows by default.** Always use pagination when querying tables that may have more than 1000 rows.

### Tables That Need Pagination:
- `mb_members` (2,770+ records)
- `mb_transactions` (500+ records)
- `mb_memberships` (2,770+ records)
- Any table with user data that could grow

### Pagination Pattern:
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

**Mindbody API uses `request.` prefix for all parameters.** Always use:
- ✅ `request.limit` NOT `Limit`
- ✅ `request.offset` NOT `Offset`
- ✅ `request.clientIds` NOT `ClientIds`
- ✅ `request.startSaleDateTime` NOT `StartSaleDateTime`
- ✅ `request.transactionStartDateTime` NOT `TransactionStartDateTime`
- ✅ `request.includeInactive` NOT `includeInactive`

### Correct Pattern:
```typescript
const params = new URLSearchParams()
params.set('request.limit', limit.toString())
params.set('request.offset', offset.toString())
```

## 🚨 CRITICAL: Transaction Status Values

**Mindbody transaction statuses are different from UI labels:**
- API returns: `Approved` (not `Captured`)
- API returns: `Approved (Voided)` (reversed transactions)
- API returns: `Credit` (refunds)

**Only count `Approved` as revenue. Exclude:**
- `Approved (Voided)` - failed/reversed payments
- `Credit` - refunds
- `Declined` - declined payments

## 🔧 Other Reminders

1. **Always `.toString()` IDs** - Client IDs can be numbers or strings
2. **Check for null/undefined** - API responses may have missing fields
3. **Use upsert with onConflict** - To avoid duplicate key errors
