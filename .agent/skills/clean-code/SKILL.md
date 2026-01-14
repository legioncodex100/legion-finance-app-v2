---
name: clean-code
description: Clean code principles for Legion Finance. Use when writing new code, reviewing code quality, or refactoring. Covers file size limits, function length, single responsibility, and readability.
---

# Clean Code Skill

## When to Use
- Writing new functions or components
- Code reviews
- Refactoring existing code
- Deciding whether to split a file

## File Size Limits

| Metric | Limit | Action When Exceeded |
|--------|-------|---------------------|
| Lines per file | **150 lines** | Split into multiple files |
| Lines per function | **50 lines** | Extract helper functions |
| Lines per component | **100 lines** | Extract sub-components |
| Parameters per function | **4 params** | Use options object |

## Decision Tree: When to Split a File

```
Is the file > 150 lines?
├── YES → Can you extract a reusable component/function?
│   ├── YES → Move to src/components/ or src/lib/utils/
│   └── NO → Split by responsibility (e.g., helpers, constants)
└── NO → Keep as is
```

## Single Responsibility Principle

Each function/component should do ONE thing:

```typescript
// ❌ BAD: Does multiple things
async function processPayment(payableId: string) {
    const payable = await getPayable(payableId)
    const transaction = await createTransaction(payable)
    await sendEmail(payable.vendor.email)
    await updateDashboard()
    return transaction
}

// ✅ GOOD: Single responsibility
async function processPayment(payableId: string) {
    const payable = await getPayable(payableId)
    return await createTransaction(payable)
}
// Email and dashboard updates handled by separate functions/hooks
```

## Meaningful Names

| Element | Convention | Example |
|---------|------------|---------|
| Boolean variables | `is`, `has`, `can`, `should` | `isLoading`, `hasError`, `canEdit` |
| Functions | verb + noun | `getPayables`, `createVendor`, `handleSubmit` |
| Event handlers | `handle` + event | `handleClick`, `handleChange`, `handleSubmit` |
| Constants | SCREAMING_SNAKE | `MAX_FILE_SIZE`, `API_TIMEOUT` |

## Avoid Magic Numbers

```typescript
// ❌ BAD
if (payables.length > 1000) { ... }
const fee = amount * 0.0199 + count * 0.20

// ✅ GOOD
const MAX_PAYABLES_PER_PAGE = 1000
const MERCHANT_FEE_PERCENTAGE = 0.0199
const PER_TRANSACTION_FEE = 0.20

if (payables.length > MAX_PAYABLES_PER_PAGE) { ... }
const fee = amount * MERCHANT_FEE_PERCENTAGE + count * PER_TRANSACTION_FEE
```

## Function Complexity

Keep cyclomatic complexity low:
- Max **3 levels of nesting**
- Max **4 conditional branches** in one function
- Use early returns to reduce nesting

```typescript
// ❌ BAD: Deep nesting
async function processItem(item) {
    if (item) {
        if (item.isValid) {
            if (item.status === 'pending') {
                if (item.amount > 0) {
                    // actual logic buried here
                }
            }
        }
    }
}

// ✅ GOOD: Early returns
async function processItem(item) {
    if (!item) return null
    if (!item.isValid) return null
    if (item.status !== 'pending') return null
    if (item.amount <= 0) return null
    
    // actual logic at top level
}
```

## Comments

```typescript
// ❌ BAD: Explains WHAT (obvious)
// Loop through payables
for (const payable of payables) { ... }

// ✅ GOOD: Explains WHY (not obvious)
// Skip system-generated bills as they're auto-reconciled
for (const payable of payables.filter(p => !p.is_system_generated)) { ... }
```
