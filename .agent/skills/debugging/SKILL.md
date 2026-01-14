---
name: debugging
description: Debugging patterns for Legion Finance. Use when troubleshooting issues, reading error messages, or investigating bugs.
---

# Debugging Skill

## When to Use
- Something isn't working
- Error messages appear
- Data doesn't match expectations
- Investigating user-reported issues

## Browser DevTools

### Open DevTools
- **Mac**: `Cmd + Option + I`
- **Windows**: `F12` or `Ctrl + Shift + I`

### Key Tabs

| Tab | Use For |
|-----|---------|
| **Console** | JavaScript errors, console.log output |
| **Network** | API calls, failed requests |
| **Application** | Cookies, localStorage, session |
| **Elements** | Inspect HTML/CSS |

## Reading Error Messages

### React/Next.js Errors

```
Error: Cannot read properties of undefined (reading 'name')
    at PayableList (payable-list.tsx:25:15)
```

**Translation**:
- Something is `undefined` when we try to read `.name`
- Look at line 25 in `payable-list.tsx`
- Probably a missing null check

**Fix**:
```typescript
// Before
{payable.vendor.name}

// After
{payable.vendor?.name ?? 'Unknown'}
```

### Supabase Errors

```
{
  message: 'column payables.amount_paid does not exist',
  code: '42703'
}
```

**Translation**: The database column doesn't exist.
**Fix**: Run the migration to add the column.

### Build Errors

```
Type 'string | undefined' is not assignable to type 'string'.
```

**Translation**: TypeScript found a value that could be undefined.
**Fix**: Add null check or default value.

## Common Issues & Fixes

### "Cannot read properties of undefined"

```typescript
// Problem: data might be null/undefined
const name = data.user.name

// Fix: Optional chaining
const name = data?.user?.name
```

### "Hydration mismatch"

Server HTML doesn't match client. Usually caused by:
- Using `Date.now()` or `Math.random()`
- Browser extensions modifying DOM
- Conditional rendering based on browser state

### "CORS error"

API doesn't allow requests from browser:
- Use server actions instead of fetch from client
- Or configure CORS on the API

### Data Not Showing

1. Check Network tab - was the request made?
2. Check response - did it return data?
3. Check console - any errors?
4. Check state - is data in component state?

```typescript
// Add logging to trace the issue
console.log('Fetching payables...')
const data = await getPayables()
console.log('Got data:', data)
setPayables(data)
console.log('State updated')
```

## Debugging Techniques

### 1. Console Logging

```typescript
// Basic
console.log('value:', value)

// Multiple values
console.log({ payable, user, filters })

// Tables for arrays
console.table(payables)

// Trace call stack
console.trace('How did we get here?')
```

### 2. Breakpoints

In DevTools Sources tab:
1. Find your file
2. Click line number to add breakpoint
3. Reload/trigger action
4. Execution pauses, inspect variables

### 3. Network Debugging

1. Open Network tab
2. Trigger the action
3. Look for red (failed) requests
4. Click request → Preview/Response

### 4. Database Debugging

Check Supabase directly:
1. Go to Supabase Dashboard
2. SQL Editor
3. Run query to verify data

```sql
SELECT * FROM payables WHERE user_id = 'xxx' LIMIT 10;
```

## Error Patterns

| Error | Likely Cause |
|-------|--------------|
| `undefined` | Missing data, async not awaited |
| 401 Unauthorized | Not logged in, token expired |
| 404 Not Found | Wrong URL, deleted record |
| 500 Server Error | Bug in server action, DB error |
| Network Error | No internet, CORS, server down |

## Quick Checklist

When something breaks:
1. [ ] What's the exact error message?
2. [ ] Where does it happen (console, network, terminal)?
3. [ ] Can you reproduce it?
4. [ ] What changed recently?
5. [ ] Does it work locally? In production?
6. [ ] Is the data correct in the database?

## Asking for Help

When stuck, provide:
1. Exact error message
2. File and line number
3. What you were trying to do
4. What you've already tried
5. Recent changes
