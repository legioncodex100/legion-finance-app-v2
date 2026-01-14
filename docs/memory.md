# Legion Finance App - Build Memory

> **Last Updated:** January 14, 2026  
> **Tech Stack:** Next.js 16 + React 19 + Supabase + Tailwind 4 + Google Gemini AI  
> **Full History:** [docs/archive/2026-01-full-history.md](archive/2026-01-full-history.md)

---

## Project Overview

Legion Finance is a comprehensive business finance management application for small business/academy operations. Provides transaction tracking, budgeting, cash flow forecasting, debt management, invoicing, and AI-powered categorization.

---

## Development Timeline

| Phase | Dates | What Was Built |
|-------|-------|----------------|
| Foundation | Jan 4-5 | Dashboard, Transactions, Categories, Staff, Vendors |
| Rules | Jan 6 | Reconciliation Rules Engine |
| Financial | Jan 7-8 | Debts, Assets, Invoices, Reports, Balance Sheet |
| Bills | Jan 9 | Payables, Recurring Bills, Templates |
| Mindbody | Jan 10-11 | API sync, Analytics, Webhooks, Cron jobs |
| Cash Flow | Jan 12 | Starling Bank, Forecasting, Calendar |
| Refactor | Jan 13 | Budget extraction, Vercel deploy, Security |
| Polish | Jan 14 | Bulk ops, Skills (22), Testing, Logging |

---

## Core Features

### Transaction Management
- CSV import with duplicate detection (`import_hash`)
- AI categorization via Gemini
- Reconciliation modal with vendor/staff/debt linking
- Bulk operations (delete, uncategorize, reconcile)

### Category System
- Hierarchical (parent/child, 2 levels)
- Financial classes: Operating, Financing, Investing
- Income/Expense classification

### Reconciliation Rules
- Rule types: Vendor, Staff, Pattern, Amount, Regex, Composite
- Human-in-the-loop approval workflow
- Pending matches queue

### Budget Management
- Multiple scenarios (Draft, Active, Archived)
- Quarterly locking with live actuals
- Budget vs Actual tracking with variance

### Cash Flow
- 12-week forecasting with pattern analysis
- Danger threshold warnings
- Calendar view with drag-and-drop scheduling

### Bills & Payables
- Recurring templates (weekly/monthly/quarterly/yearly)
- Partial payment tracking
- Transaction linking

### Integrations
- **Starling Bank**: Transaction sync, balance, pot transactions
- **Mindbody**: Members, transactions, memberships, churn analytics

---

## Key Technical Decisions

| Area | Choice |
|------|--------|
| Routing | Next.js App Router |
| Database | Supabase with RLS on all 37 tables |
| Server Logic | Server Actions (`"use server"`) |
| Auth | Supabase Auth + Edge Middleware |
| AI | Google Gemini (categorization, OCR, notes) |
| UI | shadcn/ui + Tailwind v4 + Lucide icons |

---

## Database Tables

### Core
`transactions`, `categories`, `vendors`, `staff`, `creditors`, `debts`

### Bills & Budgets
`payables`, `budget_scenarios`, `budget_items`

### Mindbody
`mb_members`, `mb_transactions`, `mb_memberships`, `mb_settlements`

### Cash Flow
`cash_flow_weeks`, `scheduled_payments`

### System
`reconciliation_rules`, `pending_matches`, `sync_logs`

---

## File Structure

```
src/
├── app/(dashboard)/     # 17 pages
├── lib/actions/         # 28 server action files
├── lib/starling/        # Starling API client
├── components/          # Shared UI components
└── types/               # TypeScript definitions
```

---

## Agent Skills (22)

Skills are in `.agent/skills/` - I read them automatically.

| Category | Skills |
|----------|--------|
| Standards | clean-code, code-organization, naming-conventions |
| React/Next | react-patterns, nextjs-app-router, typescript-types |
| Quality | testing, logging, error-handling, commenting-docs |
| Security | security-practices, supabase-best-practices |
| Integration | starling-integration, mindbody-integration, bill-management |
| UI/UX | ui-patterns, responsive-design, accessibility |
| Workflow | git-workflow, deployment, debugging, refactoring |

---

## Known Technical Debt

> [!WARNING]
> **Large Files (150-line rule)**
> - `transactions/page.tsx` (102KB)
> - `accounts-payable/page.tsx` (110KB)
> - `reconciliation-modal.tsx` (~1,500 lines)

---

## Critical Gotchas

> [!IMPORTANT]
> **Supabase Pagination**  
> Tables over 1000 rows require manual pagination (default limit is 1000).

> [!IMPORTANT]
> **Mindbody API Parameters**  
> All params require `request.` prefix: `request.limit`, `request.clientIds`

> [!IMPORTANT]  
> **Starling Amounts**  
> Amounts are in minor units (pence). Divide by 100 for pounds.

> [!IMPORTANT]
> **Transaction Status**  
> Only `Approved` = revenue. Exclude `Approved (Voided)` and `Credit`.

---

## Recent Session Notes

### January 14, 2026 (PM)
- Mindbody webhooks: 6 events (`client.created`, `client.updated`, `clientProfileMerger.created`, etc.)
- Members page (`/members`) with search, filter, profile modal
- Client merge handling (soft delete, merged transactions appear in winner's history)
- API & Webhook Logs feature (`api_logs` table, `/settings/logs` page)
- Service role client for webhook handlers
- Fixed Supabase 1000-row pagination limit

### January 14, 2026 (AM)
- Bulk delete, search, sortable columns for Accounts Payable
- Partial payment tracking (`amount_paid` column)
- Weekly bills now generate for all Fridays in month
- In-flight cash tracking (MB→Starling settlement lag)
- Created 22 agent skills
- Set up Jest + React Testing Library
- Created logger utility (`src/lib/logger.ts`)
- Reconstructed project timeline

### January 13, 2026
- Budget page refactored into 9 components
- Deployed to Vercel
- Auth middleware + security audit
- Mobile optimization

*For detailed session logs, see [archive/2026-01-full-history.md](archive/2026-01-full-history.md)*
