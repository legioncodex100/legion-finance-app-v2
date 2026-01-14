---
name: nextjs-app-router
description: Next.js App Router patterns for Legion Finance. Use when working with routes, layouts, server components, or API routes. Covers route groups, data fetching, and middleware.
---

# Next.js App Router Skill

## When to Use
- Creating new pages or routes
- Deciding server vs client components
- Setting up layouts
- Working with API routes

## App Router Structure

```
src/app/
├── (dashboard)/              # Route group (no URL impact)
│   ├── layout.tsx            # Shared layout for all dashboard pages
│   ├── page.tsx              # /
│   ├── accounts-payable/
│   │   └── page.tsx          # /accounts-payable
│   ├── transactions/
│   │   └── page.tsx          # /transactions
│   └── settings/
│       ├── page.tsx          # /settings
│       └── sync/
│           └── page.tsx      # /settings/sync
├── api/                      # API routes
│   ├── webhooks/
│   │   └── mindbody/
│   │       └── route.ts      # /api/webhooks/mindbody
│   └── cron/
│       └── route.ts          # /api/cron
├── login/
│   └── page.tsx              # /login (outside dashboard layout)
└── layout.tsx                # Root layout
```

## Route Groups: `(folderName)`

Route groups organize routes without affecting URLs:

```
(dashboard)/          # Logged-in pages with sidebar
(auth)/               # Auth pages (login, signup)
(public)/             # Public pages (landing, pricing)
```

## Server vs Client Components

```tsx
// SERVER COMPONENT (default) - runs on server
// ✅ Can: fetch data, access backend, use async/await
// ❌ Cannot: use useState, useEffect, onClick
export default async function TransactionsPage() {
    const transactions = await getTransactions()  // Direct DB access
    return <TransactionList transactions={transactions} />
}

// CLIENT COMPONENT - runs in browser
// Must add "use client" at top
"use client"

import { useState } from 'react'

export function TransactionList({ transactions }) {
    const [filter, setFilter] = useState('all')  // ✅ Can use hooks
    return <div onClick={() => ...}>...</div>    // ✅ Can use handlers
}
```

## Legion Finance Pattern

Most pages are client components (for interactivity):

```tsx
// src/app/(dashboard)/accounts-payable/page.tsx
"use client"

import * as React from "react"
import { getPayables, createPayable } from "@/lib/actions/payables"

export default function AccountsPayablePage() {
    const [payables, setPayables] = React.useState<Payable[]>([])
    
    React.useEffect(() => {
        getPayables().then(setPayables)
    }, [])
    
    // ... interactive UI
}
```

## API Routes

```typescript
// src/app/api/webhooks/mindbody/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        // Process webhook...
        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json(
            { error: 'Internal error' },
            { status: 500 }
        )
    }
}

export async function GET(request: NextRequest) {
    // Handle GET requests
    return NextResponse.json({ status: 'ok' })
}
```

## Layouts

Shared UI that wraps child pages:

```tsx
// src/app/(dashboard)/layout.tsx
export default function DashboardLayout({
    children
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex">
            <Sidebar />
            <main className="flex-1 p-6">
                {children}
            </main>
        </div>
    )
}
```

## Metadata

```tsx
// Static metadata
export const metadata = {
    title: 'Accounts Payable | Legion Finance',
    description: 'Manage bills and payables'
}

// Dynamic metadata (for pages with params)
export async function generateMetadata({ params }) {
    const vendor = await getVendor(params.id)
    return {
        title: `${vendor.name} | Legion Finance`
    }
}
```

## Loading and Error States

```
accounts-payable/
├── page.tsx          # Main page
├── loading.tsx       # Shown while page loads
└── error.tsx         # Shown on error

// loading.tsx
export default function Loading() {
    return <Skeleton />
}

// error.tsx
"use client"
export default function Error({ error, reset }) {
    return (
        <div>
            <h2>Something went wrong!</h2>
            <button onClick={reset}>Try again</button>
        </div>
    )
}
```

## Private Folders: `_folderName`

Opt out of routing (for helper components):

```
accounts-payable/
├── page.tsx
├── _components/      # Not a route, just organization
│   ├── BillTable.tsx
│   └── BillModal.tsx
└── _hooks/
    └── useBills.ts
```

## Dynamic Routes

```
vendors/
├── page.tsx          # /vendors
└── [id]/
    └── page.tsx      # /vendors/123

// [id]/page.tsx
export default function VendorPage({ params }: { params: { id: string } }) {
    const vendor = await getVendor(params.id)
    return <VendorDetail vendor={vendor} />
}
```
