---
name: code-organization
description: Folder structure and layer separation for Legion Finance. Use when creating new files, deciding where code belongs, or restructuring the codebase.
---

# Code Organization Skill

## When to Use
- Creating a new file (where should it go?)
- Deciding between component vs utility
- Restructuring code during refactoring
- Understanding the codebase architecture

## Legion Finance Folder Structure

```
src/
├── app/                      # Next.js App Router
│   ├── (dashboard)/          # Route group (no URL impact)
│   │   ├── page.tsx          # Dashboard home
│   │   ├── accounts-payable/ # Feature route
│   │   ├── transactions/
│   │   └── ...
│   ├── api/                  # API routes
│   └── login/
├── components/               # Reusable UI components
│   ├── ui/                   # shadcn/ui primitives
│   └── *.tsx                 # App-specific components
├── lib/                      # Business logic & utilities
│   ├── actions/              # Server actions (database)
│   ├── supabase/             # Supabase client config
│   ├── starling/             # Starling API client
│   └── utils.ts              # General utilities
└── types/                    # TypeScript definitions
```

## Layer Separation

| Layer | Path | What Goes Here |
|-------|------|----------------|
| **Server Actions** | `src/lib/actions/*.ts` | Database queries, mutations, business logic |
| **API Clients** | `src/lib/<service>/` | External API integrations (Starling, Mindbody) |
| **Page Components** | `src/app/(dashboard)/*/page.tsx` | Route pages, data fetching, layout |
| **Shared Components** | `src/components/*.tsx` | Reusable UI (used in 2+ pages) |
| **UI Primitives** | `src/components/ui/*.tsx` | Base components (Button, Card, etc.) |
| **Types** | `src/lib/actions/*.ts` or `src/types/` | TypeScript interfaces |

## Decision Tree: Where Does This Code Go?

```
What type of code is it?
├── Database query/mutation?
│   └── src/lib/actions/<feature>.ts
├── External API call?
│   └── src/lib/<service>/client.ts
├── Reusable UI component (2+ places)?
│   └── src/components/<name>.tsx
├── Page-specific component?
│   └── Same file as page.tsx OR src/app/(dashboard)/<route>/components/
├── Utility function?
│   └── src/lib/utils.ts (if small) OR src/lib/utils/<category>.ts
└── TypeScript type?
    └── Export from the action file that uses it
```

## Server Actions File Pattern

Each feature has its own actions file:

```typescript
// src/lib/actions/payables.ts
"use server"

import { createClient } from "@/lib/supabase/server"

// Types - export for use in components
export interface Payable { ... }
export type PayeeType = 'vendor' | 'staff' | 'system'

// CRUD Operations
export async function getPayables() { ... }
export async function createPayable(data: {...}) { ... }
export async function updatePayable(id: string, data: {...}) { ... }
export async function deletePayable(id: string) { ... }

// Business Logic
export async function linkPayableToTransaction(...) { ... }
export async function generateWeeklyBills(...) { ... }
```

## When to Extract to a New File

| Situation | Action |
|-----------|--------|
| Component used in 2+ pages | Move to `src/components/` |
| Logic used in 2+ actions | Extract to `src/lib/utils/` |
| File exceeds 150 lines | Split by responsibility |
| 3+ related functions | Create dedicated file |
| External API integration | Create `src/lib/<service>/` folder |

## Co-location Principle

Keep related files close together:

```
# ✅ GOOD: Feature-based co-location
src/app/(dashboard)/accounts-payable/
├── page.tsx           # Main page
├── components/        # Page-specific components
│   ├── PayableTable.tsx
│   └── BillModal.tsx
└── hooks/             # Page-specific hooks (if needed)

# ❌ BAD: Everything in root components
src/components/
├── PayableTable.tsx
├── BillModal.tsx
├── TransactionRow.tsx
├── VendorCard.tsx
└── (100 more files...)
```

## Import Order Convention

```typescript
// 1. React/Next.js
import * as React from "react"
import { useRouter } from "next/navigation"

// 2. External libraries
import { format } from "date-fns"

// 3. UI components
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

// 4. Internal components
import { VendorList } from "@/components/vendor-list"

// 5. Actions/Utils
import { getPayables, createPayable } from "@/lib/actions/payables"

// 6. Types (if separate)
import type { Payable } from "@/lib/actions/payables"
```
