---
name: security-practices
description: Security best practices for Legion Finance. Use when handling authentication, database queries, or sensitive data. Covers RLS, input validation, and avoiding common vulnerabilities.
---

# Security Practices Skill

## When to Use
- Adding database queries
- Handling user input
- Working with authentication
- Creating API endpoints

## Row Level Security (RLS)

Every query MUST include user_id check:

```typescript
"use server"

export async function getPayables() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    // ❌ BAD: No user check - returns ALL USERS' data
    const { data } = await supabase.from('payables').select('*')
    
    // ✅ GOOD: Filtered by authenticated user
    if (!user) throw new Error('Unauthorized')
    const { data } = await supabase
        .from('payables')
        .select('*')
        .eq('user_id', user.id)
}
```

## RLS Policies Pattern

Enable RLS and create policies in Supabase:

```sql
-- Enable RLS on table
ALTER TABLE payables ENABLE ROW LEVEL SECURITY;

-- User can only see their own data
CREATE POLICY "Users can view their own payables"
ON payables FOR SELECT
USING (auth.uid() = user_id);

-- User can only insert their own data
CREATE POLICY "Users can create their own payables"
ON payables FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- User can only update their own data
CREATE POLICY "Users can update their own payables"
ON payables FOR UPDATE
USING (auth.uid() = user_id);

-- User can only delete their own data
CREATE POLICY "Users can delete their own payables"
ON payables FOR DELETE
USING (auth.uid() = user_id);
```

## Authentication Checks

Every server action needs auth check:

```typescript
export async function sensitiveAction() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
        throw new Error('Unauthorized')
    }
    
    // Proceed with action...
}
```

## API Route Security

```typescript
// src/app/api/webhooks/example/route.ts
export async function POST(request: Request) {
    // 1. Verify webhook signature/secret
    const signature = request.headers.get('x-webhook-signature')
    if (!verifySignature(signature)) {
        return Response.json({ error: 'Invalid signature' }, { status: 401 })
    }
    
    // 2. Validate input
    const body = await request.json()
    if (!body.event || !body.data) {
        return Response.json({ error: 'Invalid payload' }, { status: 400 })
    }
    
    // 3. Process...
}
```

## Input Validation

Never trust user input:

```typescript
export async function createPayable(data: CreatePayableInput) {
    // ✅ Validate required fields
    if (!data.name?.trim()) {
        throw new Error('Name is required')
    }
    
    // ✅ Validate numeric values
    const amount = parseFloat(data.amount)
    if (isNaN(amount) || amount < 0) {
        throw new Error('Invalid amount')
    }
    
    // ✅ Sanitize string inputs
    const sanitizedName = data.name.trim().slice(0, 255)
    
    // ✅ Validate enum values
    const validPayeeTypes = ['vendor', 'staff', 'system']
    if (!validPayeeTypes.includes(data.payee_type)) {
        throw new Error('Invalid payee type')
    }
}
```

## SQL Injection Prevention

Supabase's query builder prevents SQL injection:

```typescript
// ✅ SAFE: Parameterized queries (Supabase handles this)
const { data } = await supabase
    .from('payables')
    .select('*')
    .eq('name', userInput)  // Properly escaped

// ❌ DANGEROUS: Never build raw SQL with user input
// const query = `SELECT * FROM payables WHERE name = '${userInput}'`
```

## Environment Variables

```typescript
// ✅ Keep secrets in .env.local
// SUPABASE_SERVICE_ROLE_KEY=secret
// STARLING_API_KEY=secret
// MINDBODY_API_KEY=secret

// ✅ Never expose in client code
// Only use NEXT_PUBLIC_ prefix for truly public values
```

## Service Role Usage

The service role bypasses RLS - use carefully:

```typescript
// ❌ AVOID: Service role for regular user operations
import { createAdminClient } from '@/lib/supabase/admin'

// ✅ USE SERVICE ROLE ONLY FOR:
// - Background jobs (cron)
// - Webhooks that don't have user context
// - Admin operations
```

## Checklist for New Features

- [ ] Server actions check `auth.getUser()` 
- [ ] Queries include `.eq('user_id', user.id)`
- [ ] User input is validated before use
- [ ] API routes verify signatures/tokens
- [ ] Sensitive data not logged
- [ ] RLS policies exist for new tables
