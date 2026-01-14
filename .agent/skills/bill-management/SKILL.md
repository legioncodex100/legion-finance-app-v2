---
name: bill-management
description: Managing bills and payables in Legion Finance. Use when creating, linking, or reconciling bills with transactions. Covers partial payments, weekly bill generation, and the payables table schema.
---

# Bill Management Skill

## When to Use This Skill
- Creating or editing bills
- Linking bills to transactions
- Generating weekly/monthly bills from templates
- Working with partial payments
- Understanding the payables table schema

## Payables Table Schema

Key columns in the `payables` table:
| Column | Type | Description |
|--------|------|-------------|
| `amount` | decimal | Total bill amount |
| `amount_paid` | decimal | Amount paid so far (for partial payments) |
| `amount_tax` | decimal | VAT amount |
| `is_paid` | boolean | True when fully paid |
| `bill_status` | enum | `draft`, `scheduled`, `paid`, `voided`, `overdue` |
| `linked_transaction_id` | uuid | FK to transactions table |
| `last_paid_date` | date | When last payment was made |
| `template_id` | uuid | Links generated bills back to their template |
| `is_template` | boolean | True for template bills |
| `payee_type` | enum | `vendor`, `staff`, `system` |

## Partial Payment Logic

When linking a transaction to a bill:

```typescript
// 1. Get current amount_paid
const currentPaid = payable.amount_paid ?? 0

// 2. Add new payment
const newAmountPaid = currentPaid + transactionAmount

// 3. Check if fully paid
const isFullyPaid = newAmountPaid >= payable.amount

// 4. Update bill
await supabase.from('payables').update({
    linked_transaction_id: transactionId,
    amount_paid: newAmountPaid,
    bill_status: isFullyPaid ? 'paid' : 'scheduled',
    is_paid: isFullyPaid,
    last_paid_date: transactionDate
})
```

## When Unlinking a Transaction

Reset both `amount_paid` and `last_paid_date`:
```typescript
await supabase.from('payables').update({
    linked_transaction_id: null,
    amount_paid: 0,
    bill_status: 'scheduled',
    is_paid: false,
    last_paid_date: null
})
```

## Weekly Bill Generation

Weekly templates generate bills for **every Friday** in the target month:

```typescript
function getFridaysInMonth(year: number, month: number): Date[] {
    const fridays: Date[] = []
    const date = new Date(year, month, 1)
    
    // Find first Friday
    while (date.getDay() !== 5) {
        date.setDate(date.getDate() + 1)
    }
    
    // Collect all Fridays
    while (date.getMonth() === month) {
        fridays.push(new Date(date))
        date.setDate(date.getDate() + 7)
    }
    return fridays
}
```

## Smart Bill Naming

Bills are named with date context:
- **Monthly**: `Rent - January 2026`
- **Weekly**: `Salary: Mohammed - Week 3`
- **Quarterly**: `VAT Q1 2026`
- **Yearly**: `Insurance 2026`

## Common Gotchas

1. **Templates vs Bills**: `is_template=true` for templates, `is_template=false` for actual bills
2. **Duplicate Prevention**: Check `template_id + next_due` combination
3. **System Generated**: Staff salary bills have `is_system_generated=true`
4. **Variable Amount Bills**: Start as `draft` status, need manual amount update
