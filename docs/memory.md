# Legion Finance App - Build Memory

> **Last Updated:** January 13, 2026  
> **Tech Stack:** Next.js 16 + React 19 + Supabase + Tailwind 4 + Google Gemini AI

---

## Project Overview

Legion Finance is a comprehensive business finance management application built for small business/academy operations. It provides transaction tracking, budgeting, cash flow forecasting, debt management, invoicing, and AI-powered categorization.

---

## Core Features Built

### 1. Transaction Management
- **CSV Import**: Bank statement import with duplicate detection via `import_hash`
- **AI Categorization**: Gemini AI suggests categories based on transaction descriptions
- **Reconciliation Modal**: Comprehensive modal for categorizing with vendor/staff/debt linking
- **Bulk Operations**: Multi-select delete, uncategorize, bulk reconcile
- **Opening Balance**: User-configurable starting balance for accurate cash calculations

### 2. Category System
- **Hierarchical Categories**: Parent/child structure with up to 2 levels
- **Financial Classes**: Operating, Financing, Investing classifications (Chart of Accounts style)
- **Category Codes**: Unique codes for each category (e.g., `SAL-001` for Salaries)
- **Type Classification**: Income vs Expense separation

### 3. Reconciliation Rules Engine
- **Rule Types**: Vendor, Staff, Description pattern, Amount range, Regex, Composite, Counter-party, Conditions-based
- **Human-in-the-Loop**: Rules can require approval before applying
- **Pending Matches Queue**: Approval workflow for rule-matched transactions
- **Rule Testing**: Preview which transactions would match before enabling

### 4. Budget Management
- **Multiple Scenarios**: Draft, Active, Archived scenarios for comparison
- **Year-over-Year Seeding**: Create budgets seeded from previous year actuals
- **Quarterly Locking**: Lock quarters for formal closeouts (no longer required for viewing actuals)
- **Live Actuals**: Real-time actuals from categorized transactions, independent of quarter locks
  - Uses payable due date for month assignment (handles late payments correctly)
  - Falls back to transaction date if no linked payable
- **Budget vs Actual Tracking**: Real-time comparison with variance analysis
- **Month Selector**: View individual months (Jan/Feb/Mar) or full quarter (All Q1)
  - When month selected: Shows only that month's Budget, Actual, Remaining
  - When All Q selected: Shows full quarter with monthly breakdown columns
- **Remaining with Percentage**: Shows remaining amount + % of budget (e.g., "£9,732 (63%)")
  - Green = under budget, Red = over budget
- **AI Notes Cleanup**: Gemini AI tidies scenario notes with context awareness

### 5. Cash Flow Forecasting
- **Pattern Analysis**: Analyzes historical transactions for weekly patterns
- **12-Week Forecast**: Predicts inflows/outflows based on patterns + scheduled items
- **Danger Threshold**: Visual warnings when balance drops below threshold
- **Data Freshness Indicators**: Shows when data was last imported/analyzed

### 6. Debt Management (formerly Loans)
- **Creditor Types**: Track different debt types with colors
- **Payment Linking**: Link bank transactions to debt repayments
- **Initial Debt Linking**: Track when borrowed amounts arrive
- **Repayment History**: View all linked transactions per debt
- **Progress Tracking**: Visual progress bars showing payoff status

### 7. Bills & Recurring Payments
- **Recurring Schedules**: Weekly, Monthly, Yearly frequencies
- **Due Date Tracking**: Visual status (overdue, due soon, upcoming)
- **Auto-pay Flag**: Mark bills that auto-debit
- **Bill Scanning**: AI-powered OCR extraction from uploaded documents
- **Document Storage**: Upload and store bill PDFs/images

### 8. Invoicing
- **Client Invoices (AR)**: Outbound invoices to clients
- **Coach Invoices (AP)**: Inbound invoices from vendors/coaches
- **Payment Linking**: Link incoming transactions to invoice payments
- **Status Workflow**: Draft → Sent → Paid/Overdue
- **Date Range Filtering**: Filter by invoice dates

### 9. Staff Management
- **Pay Period Types**: Weekly, Bi-weekly, Monthly configurations
- **Role Tracking**: Record staff roles
- **Staff Payments**: Link transactions to staff payments
- **Transaction Attribution**: Track which transactions relate to which staff

### 10. Vendor Management
- **Default Categories**: Set default category per vendor for quick reconciliation
- **Recurring Flag**: Mark vendors as recurring for pattern matching
- **Auto-linking**: Rules can auto-assign vendor to matching transactions

### 11. Asset Tracking
- **Capital Assets**: Track purchased assets with values
- **Asset Payments**: Link transactions to asset purchases
- **Asset Linking**: Reference assets in transaction reconciliation

### 12. Reporting & Analytics
- **P&L Report**: Profit & Loss organized by financial class
- **Balance Sheet**: Assets, Liabilities, Equity view
- **Transaction History**: Monthly net position over time
- **Dashboard KPIs**: Real-time income, expenses, net position

### 13. Financial AI Chat
- **Contextual Chat**: AI assistant that understands your financial data
- **Query Transactions**: Ask questions about spending patterns
- **Budget Insights**: Get AI-generated budget recommendations

### 14. Aria AI Assistant (Enhanced)
- **World-Class Accountant**: CPA/CA-level expertise with 20+ years experience
- **Model Selection**: Choose Gemini 2.0 Flash, 1.5 Flash, or 1.5 Pro
- **Temperature Control**: Adjust response style (focused ↔ creative)
- **Dynamic Context**: Injects YTD financials, cash position, top expenses
- **Custom Instructions**: Add your own instructions per user
- **Few-Shot Training**: Pre-trained examples for academy finance
- **UK Tax Knowledge**: VAT, HMRC, Corporation Tax, MTD compliance

---

## Database Schema

### Core Tables
| Table | Purpose |
|-------|---------|
| `transactions` | All bank transactions with categorization |
| `categories` | Hierarchical category tree |
| `financial_classes` | Chart of accounts classifications |
| `vendors` | Payee registry |
| `recurring_bills` | Scheduled recurring payments |
| `debts` | Debt/loan tracking |
| `staff` | Employee records |
| `user_settings` | Per-user configuration |

### Feature-Specific Tables
| Table | Purpose |
|-------|---------|
| `budget_scenarios` | Budget versions with locking |
| `budget_items` | Monthly budget by category |
| `reconciliation_rules` | Automation rules |
| `pending_matches` | Approval queue for rule matches |
| `client_invoices` | Accounts receivable |
| `coach_invoices` | Accounts payable |
| `assets` | Capital asset tracking |
| `creditors` | Debt creditor registry |
| `debt_types` | Debt classification types |

### Cash Flow Tables
| Table | Purpose |
|-------|---------|
| `scheduled_payments` | Projected autopay/recurring payments for forecast |
| `cash_flow_patterns` | Historical weekly patterns for prediction |
| `cash_flow_sources` | Data freshness tracking per source |

#### `scheduled_payments` Schema
| Column | Type | Description |
|--------|------|-------------|
| `source` | text | 'mindbody', 'manual', 'recurring' |
| `client_name` | text | Member/payer name |
| `description` | text | Membership name or payment description |
| `amount` | decimal | Gross payment amount |
| `scheduled_date` | date | Projected collection date |
| `payment_status` | text | 'scheduled', 'collected', 'failed', 'cancelled' |
| `failure_reason` | text | Decline reason if failed |

### Mindbody Enrichment Tables
| Table | Purpose |
|-------|---------|
| `mb_members` | Member data with status, monthly_rate, next_payment_date |
| `mb_transactions` | Transaction data with fees, status, saleDate |
| `mb_settlements` | Bank settlement matching |
| `mb_memberships` | Membership status tracking |

---

## Schema Migrations Applied

```
supabase-schema.sql              - Core tables
supabase-seed-categories.sql     - Default category hierarchy
supabase-financial-classes.sql   - Financial class types
supabase-reconciliation-rules.sql - Rules engine tables
supabase-staff-table.sql         - Staff management
create-budget-tables.sql         - Budget scenarios & items
create-cash-flow-tables.sql      - Cash flow forecasting
create-invoices-table.sql        - Invoicing system
create-assets-table.sql          - Asset tracking
enhance-debt-management.sql      - Creditors, debt types, linking
add-bill-documents.sql           - Bill document storage
add-bill-linking.sql             - Transaction-bill linking
add-bill-payments.sql            - Bill payment tracking
add-invoice-payments.sql         - Invoice payment linking
add-budget-quarterly-locks.sql   - Quarter locking feature
add-scenario-notes.sql           - Budget scenario notes
add-opening-balance.sql          - Opening balance setting
add-capital-projects.sql         - Capital project tracking
refactor-staff-pay-periods.sql   - Staff pay period types
enhance-staff-types.sql          - Additional staff fields
```

---

## Key Technical Decisions

### Architecture
- **App Router**: Next.js 16 App Router with server components
- **Server Actions**: `"use server"` for all database operations
- **Client Components**: Interactive pages marked with `"use client"`
- **Barrel Exports**: Components organized by feature

### Authentication
- **Supabase Auth**: Email/password authentication
- **RLS Policies**: Row-level security on all user data tables
- **Middleware**: Auth state synchronized via middleware

### AI Integration
- **Google Gemini**: Used for transaction categorization
- **OCR**: Bill document text extraction
- **Notes Cleanup**: Context-aware note formatting

### UI/UX
- **Shadcn/UI**: Radix-based component library
- **Tailwind v4**: Utility-first styling
- **Lucide Icons**: Consistent iconography
- **Sonner**: Toast notifications

---

## Page Structure

```
app/(dashboard)/
├── page.tsx              - Dashboard with KPIs
├── transactions/         - Transaction ledger
├── budget/               - Budget scenarios & tracking
├── cash-flow/            - Cash flow forecasting
├── bills/                - Recurring bills
├── debts/                - Debt management
├── invoices/             - Invoice management
├── staff/                - Staff registry
├── vendors/              - Vendor registry
├── categories/           - Category management
├── creditors/            - Creditor registry
├── assets/               - Asset tracking
├── reports/              - P&L and reports
├── balance-sheet/        - Balance sheet view
├── reconciliation/
│   └── pending/          - Approval queue
└── settings/
    ├── page.tsx          - General settings
    ├── financial-classes/ - Class configuration
    └── reconciliation-rules/ - Rules management
```

---

## Known Technical Debt

> [!WARNING]
> **150-Line Rule Violations**
> 
> Multiple files significantly exceed the 150-line limit:
> - `reconciliation-modal.tsx` (1,578 lines)
> - ~~`budget/page.tsx` (1,502 lines)~~ ✅ Refactored into 9 components
> - `transactions/page.tsx` (1,484 lines)
> - `budget.ts` server actions (1,253 lines)
> 
> See `implementation_plan.md` for refactoring strategy.

> [!NOTE]
> **No Test Coverage**
> 
> Zero unit/integration tests currently exist. Testing should be added incrementally during refactoring.

---

## Integrations Hub

### Module Structure
```
lib/integrations/
├── index.ts            - Barrel exports
├── types.ts            - Integration types, provider metadata
├── gemini/
│   ├── config.ts       - Model configuration, task defaults
│   └── client.ts       - Centralized client, singleton pattern
└── mindbody/
    ├── config.ts       - API endpoints, env helpers
    ├── types.ts        - API response types
    ├── client.ts       - API client with staff token auth
    └── sync.ts         - Sales sync to transactions
```

### API Routes
| Route | Method | Purpose |
|-------|--------|----------|
| `/api/integrations/mindbody/test` | POST | Test API connection |
| `/api/integrations/mindbody/sync` | POST | Sync sales as transactions |

### Database Tables
| Table | Purpose |
|-------|---------|
| `integrations` | Provider configurations per user |
| `integration_tokens` | OAuth tokens (reserved for future) |
| `integration_sync_logs` | Sync/test audit logs |

### Supported Providers
| Provider | Status | Auth Method | Features |
|----------|--------|-------------|----------|
| **Gemini AI** | ✅ Connected | API Key | Categorization, chat, OCR, notes |
| **Mindbody** | ✅ Connected | API Key + Staff Token | Sales sync, transaction import |
| **Stripe** | 🔜 Coming Soon | - | Payment tracking |
| **GoCardless** | 🔜 Coming Soon | - | Bank feeds |

### Environment Variables
```bash
# Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Mindbody
MINDBODY_API_KEY=your_api_key
MINDBODY_SITE_ID=your_site_id
MINDBODY_STAFF_USERNAME=staff@email.com
MINDBODY_STAFF_PASSWORD=staff_password
```

### Mindbody Sync Flow
1. **Authenticate**: Get staff token via `/usertoken/issue`
2. **Fetch Sales**: GET `/sale/sales` with date range
3. **Deduplicate**: Check `import_hash` to skip existing
4. **Categorize**: Gemini AI suggests category
5. **Insert**: Create transaction as unconfirmed income
6. **Log**: Record sync result to `integration_sync_logs`

---

## Conversation References

| Date | Topic | Key Outcome |
|------|-------|-------------|
| Dec 23 | Rename Loans to Debt | Renamed all "loan" terminology to "debt" |
| Dec 23-24 | P&L & History Refinement | Fixed net position calculations |
| Dec 23 | Debt Management Enhancements | Added repayment history, initial debt linking |
| Jan 04 | Enhance Add Transaction Modal | Added vendor/staff payee type toggle |
| Jan 05 | Reconciliation Rules | Implemented human-in-the-loop rule approval |
| Jan 10 | Best Practices Review | Identified 150-line violations, created refactoring plan |
| Jan 10 | Integrations Hub | Created centralized integrations system with Gemini + Mindbody |
| Jan 10 | **Transaction Sync Fix** | Fixed revenue discrepancy (£37K → £14.8K). See critical learnings below |
| Jan 10-11 | **Member Status Investigation** | Discovered Mindbody status hierarchy issue. See notes below |

---

## Critical Learnings (Jan 10, 2026)

> [!CAUTION]
> **Supabase 1000 Row Limit**
> 
> Supabase returns max 1000 rows by default. ALWAYS use pagination with `.range()` for tables that may exceed 1000 rows:
> - `mb_members` (2,770+ rows)
> - `mb_transactions` (500+ rows)
> - `mb_memberships` (2,770+ rows)
> - Any user data table that grows

> [!CAUTION]
> **Mindbody API Parameter Names**
> 
> All Mindbody API parameters require `request.` prefix:
> - ✅ `request.limit` NOT `Limit`
> - ✅ `request.clientIds` NOT `ClientIds`
> - ✅ `request.startSaleDateTime` NOT `StartSaleDateTime`
> - ✅ `request.includeInactive` NOT `includeInactive`

> [!IMPORTANT]
> **Transaction Status Values**
> 
> Mindbody transaction statuses differ from UI labels:
> - `Approved` = Successful payment (count as revenue)
> - `Approved (Voided)` = Reversed/failed recurring payment (EXCLUDE)
> - `Credit` = Refund (EXCLUDE)
> 
> Revenue sync: £14,805 gross, 208 transactions, £335.88 fees

---

## Mindbody Enrichment Layer

### Schema (Jan 10)
| Table | Purpose |
|-------|---------|
| `mb_transactions` | Transaction data with fees, status |
| `mb_settlements` | Bank settlement matching |
| `mb_members` | Member data with monthly rates |
| `mb_memberships` | Membership status tracking |

### Key Fixes Applied
- Fixed API parameter names across all endpoints
- Fixed status filter: only count `Approved` (not `Approved (Voided)`)
- Added pagination to all queries fetching >1000 rows
- Created voided payment recovery report with client lookup

### Workflow Created
- `/supabase-best-practices` - Critical gotchas and patterns

---

## Mindbody Member Status Issue (Jan 10-11)

> [!WARNING]
> **BLOCKER: Active Member Count Doesn't Match Mindbody Reports**
> 
> Dashboard shows ~369-979 active members vs Mindbody's 216.

### Root Cause Analysis

1. **Client Status ≠ Membership Status**
   - Mindbody Clients API `Status` field = **membership tier name** (e.g., "Men's Unlimited Member")
   - NOT the actual status (Active/Declined/Expired)
   - Our sync defaults to "Active" for anyone with a tier name

2. **ActiveClientMemberships API Limitation**
   - `GET /client/activeclientmemberships` requires `ClientId` parameter
   - Cannot bulk-fetch all active memberships in one call
   - Would require N API calls (one per client) = not feasible

3. **Mindbody Status Priority Hierarchy**
   
   | Priority | Status | Description |
   |----------|--------|-------------|
   | 1 (Highest) | Suspended | Contract on hold/freeze |
   | 2 | Declined | Last autopay failed |
   | 3 | Active | Current and paid |
   | 4 | Terminated | Manually ended before expiration |
   | 5 (Lowest) | Expired | Contract ended naturally |

   - A client with Active + Declined memberships → **counts as Declined**
   - We implemented this priority logic but data source is wrong

### What Was Tried

| Approach | Result |
|----------|--------|
| Parse Status field for keywords (expired, declined, suspended) | ❌ Field contains tier name, not status words |
| Use ActiveClientMemberships API | ❌ Requires ClientId per call, can't bulk fetch |
| Transaction-based (Completed in 45 days = Active) | ❌ Only 1 month of transaction data |
| Cross-reference voided transactions for Declined | ✅ Partial success, correctly identifies some declines |

### Recommended Next Steps

1. ~~**Use Contracts API** - `GET /client/clientcontracts`~~ ✅ **DONE!**
   - Uses `AutopayStatus: "Active"` to identify active contracts
   - Uses `PayerClientId` to group contracts by member
   - Checks `TerminationDate` to exclude cancelled contracts

2. **Integrate to Dashboard** - Replace old counts with contract-based calculation
   - Currently 192 active, 13 suspended, 253 inactive
   - Need to test full 1000-member scan (takes ~1-2 min)

3. **Fix monthly_rate Stale Data** - Many members have `monthly_rate=0` but active contracts
   - 834 members with zero rate, ~20% have active contracts
   - Dashboard should use contract-based status, not monthly_rate field

### Current State (Updated Jan 11, 2026 @ 1:18 AM)

| Metric | Value |
|--------|-------|
| ✅ Revenue calculation | £14,805 (208 transactions) |
| ✅ Transaction sync | Correct (excludes Voided) |
| ✅ Voided recovery report | Working |
| ✅ **Contracts API** | Working! Uses `/client/clientcontracts` |
| ✅ **Active Members** | 192 (vs Mindbody's 216) |
| ✅ **Suspended Members** | 13 |
| 🔄 **Gap Investigation** | ~24 member gap due to stale monthly_rate=0 |
| 🔄 **Next: Full scan** | Check all 1000 members (not just monthly_rate>0) |

### Key Code Files for Member Status

| File | Purpose |
|------|---------|
| `src/lib/actions/mindbody/member-status.ts` | Priority hierarchy calculation |
| `src/lib/integrations/mindbody/client.ts` | `getClientContracts()`, `getAllClientContracts()` |
| Debug page | "🎯 Calculate Member Status", "🔍 Edge Cases" options |

### API Learnings (Jan 11)

> [!IMPORTANT]
> **Contracts API Response Structure**
> 
> - Endpoint: `GET /client/clientcontracts?request.clientId={id}`
> - Response key: `Contracts` (not `ClientContracts`)
> - Client ID field: `PayerClientId` (number)
> - Status field: `AutopayStatus` ("Active", "Inactive", "Suspended")
> - Termination: `TerminationDate` (null if active)

> [!WARNING]
> **monthly_rate Field is Stale**
> 
> The `mb_members.monthly_rate` field doesn't reflect actual contract status!
> - 834 members with monthly_rate=0
> - ~20% of those have active contracts in Mindbody
> - Solution: Use Contracts API to determine status, ignore monthly_rate

---

## Mindbody Transaction-Derived Logic (Canonical Strategy)

> **Last Updated:** January 11, 2026

### The Problem
Mindbody's Autopay endpoint (`GET /sale/autopaytransactions`) requires a `ClientId` per request. For 216 members, this means 216 API calls - a rate-limit nightmare.

### The Solution: Transaction-Derived Status
Instead of polling slow APIs, we **derive** member status from synced transaction data:

| Status | Logic Rule | MRR Impact |
|--------|------------|------------|
| **Active** | `monthly_rate > 0` AND last payment < 35 days ago | Guaranteed income |
| **At Risk** | `monthly_rate > 0` AND last payment 35-45 days ago | Silent churn danger zone |
| **Declined** | Has Voided/Declined transaction in last 31 days | Immediate recovery needed |
| **Churned** | `monthly_rate > 0` AND last payment > 45 days ago | Lost revenue |
| **Suspended** | `membership_status = 'Suspended'` | Paused (may return) |

### Next Payment Date Calculation
Since we can't pull scheduled autopays, we calculate:
```
next_payment_date = last_successful_transaction + 1 month
```

### Cash Flow Integration
The `scheduled_payments` table is populated from `mb_members`:
1. Active members with `next_payment_date` → Cash Flow forecast
2. Sync updates "scheduled" → "collected" when matching transactions appear
3. Integrates seamlessly with bills and pattern-based forecasting

### Key Functions
| Function | Purpose |
|----------|---------|
| `getPeriodMetrics()` | Revenue/declines for selected date range |
| `getPeriodDeclines()` | Members with voided tx in period (excludes recovered) |
| `getRepeatDecliners()` | Multi-month decline offenders |
| `getAtRiskSilentChurn()` | 35-45 day danger zone members |
| `syncMindbodyScheduledPayments()` | Populates Cash Flow from autopay projections |

### SQL View: `membership_health_snapshot`
Database-level view deriving status from transactions. See `supabase-membership-health-view.sql`.

### Merchant Fee Rates (UK)
| Type | Rate |
|------|------|
| CNP (Card Not Present) | 1.99% + £0.20 |
| CP (Card Present) | 1.75% |
| BACS/Direct Debit | 1.00% + £0.20 |

> [!TIP]
> Apply £0.20 fixed fee to **every transaction** in a batch, not just the total.

---

## Session: January 11, 2026 (Full Day)

### Overview
Implemented "smart sync" for Mindbody (similar to Starling), automated sync infrastructure, centralized sync management, and autopay forecasting.

---

### Part 1: Smart Mindbody Sync

#### `smartMindbodySync` Function (`/lib/actions/mindbody-sync.ts`)
- Tracks last sync date in `localStorage` for incremental syncing
- Syncs transactions from last sync date forward
- Updates `scheduled_payments` to 'collected' or 'declined' based on actual transactions
- Fetches and updates `mb_members.last_visit_date` for churn analysis

#### Mindbody Dashboard Updates (`/mindbody/page.tsx`)
- Added `lastMbSyncDate` state with `localStorage` persistence
- Refactored to separate **Smart Sync** vs **Full Sync** buttons
- Added "Last Synced" display

---

### Part 2: Sync Infrastructure

#### Nightly Cron Job (`/api/cron/mindbody-sync`)
- Daily at 3 AM UTC via `vercel.json`
- Daily: `smartMindbodySync()`, Sundays: Full member sync
- Protected by `CRON_SECRET`

#### Webhooks (`/api/webhooks/mindbody`)
- `sale.created` → Upserts to `mb_transactions`
- `client.updated` → Updates `mb_members`
- `clientMembershipAssignment.cancelled` → Sets 'Terminated'

---

### Part 3: Sync Management Page (`/settings/sync`)
- Sync stats (today's count, failures, last sync times)
- Manual sync buttons for Mindbody
- Sync logs viewer (recent 30 events)

---

### Part 4: Autopay Forecast Card
- Shows This Month + Next Month scheduled autopay totals
- Blue-to-purple gradient on Mindbody Intelligence page
- `getUpcomingScheduledPayments()` function added to mindbody-bi.ts

---

### Part 5: Debug Console (`/settings/debug`)
- API inspection: Contracts, Memberships, Services
- DB inspection: Scheduled Payments, MB Members
- Sync testing with JSON results viewer

---

### Bug Fix: Autopay Forecast Gap (Jan 12)

**Problem**: Feb 2026 forecast showed 172/£12,305 but Mindbody shows 221/£15,660 (21% gap)

**Root Cause Analysis**:
1. Contracts API requires ClientId per-client (can't bulk fetch)
2. Reverted to `mb_members` table but filtered `membership_status = 'Active'`
3. **50 Declined members** have `next_payment_date = NULL` (excluded from sync)
4. Mindbody STILL attempts autopay on Declined members!

**Solution - "Heartbeat Algorithm"**:
1. Include `Declined` in membership filter (not just Active)
2. Remove `next_payment_date IS NOT NULL` filter
3. For members without `next_payment_date`:
   - Fetch last successful transaction from `mb_transactions`
   - Derive: `next_date = last_txn_date + 1 month`
   - Fallback: 15th of current month if no transactions

**Result**: 
| Metric | Before | After | Target | Variance |
|--------|--------|-------|--------|----------|
| Count | 172 | **227** | 221 | +3% |
| Total | £12,305 | **£16,210** | £15,660 | +3.5% |

**Files Changed**:
- `syncMindbodyScheduledPayments()` in `/lib/actions/mindbody-bi.ts`
- Added debug functions to `/lib/actions/debug.ts`

---

### Debug Console Tools Added (Jan 12)
| Button | Purpose |
|--------|---------|
| Feb 2026 Forecast | Compare with Mindbody target |
| Autopay Contracts | Per-client contract inspection |
| Declined Members | Check members with null next_payment_date |
| Cash Flow Weekly | Breakdown by week for date verification |

---

### Bug Fix: Weekly Forecast Inflation (Jan 12)

**Problem**: Cash Flow Week 1 showed 84 payments/£5,850 but Mindbody only had ~29 scheduled

**Root Cause**: Declined members without `next_payment_date` AND no transaction history were assigned to 15th of month as fallback - stuffing Week 1

**Solution**: Removed 15th fallback - members with no traceable history are now skipped
```typescript
} else {
    // No traceable history - skip this member
    continue
}
```

**Result**:
| Week | Before | After | Mindbody |
|------|--------|-------|----------|
| Week 1 (Jan 12-18) | 84/£5,850 | **29/£1,945** | ~29/~£2,600 |

Members will be included once they make a payment (transaction syncs → derives next date)

---

### New Files
| File | Purpose |
|------|---------|
| `/lib/actions/sync-logs.ts` | Sync log queries |
| `/lib/actions/debug.ts` | Debug API inspection |
| `/settings/sync/page.tsx` | Sync management UI |
| `/settings/debug/page.tsx` | Debug console UI |
| `/api/cron/mindbody-sync/route.ts` | Cron endpoint |

### New Environment Variables
```bash
CRON_SECRET=your_secret
MINDBODY_WEBHOOK_SECRET=optional_secret
---

### Key Learnings

> [!IMPORTANT]
> **Client Contracts API Requires ClientId**
> 
> `/client/clientcontracts` returns empty without `ClientId`.
> **Workaround**: Use `mb_members` table for autopay forecast.

---

### Deployment Checklist

1. ✅ Deploy to enable Vercel cron job
2. □ Register webhook: `https://yourdomain.com/api/webhooks/mindbody`
3. □ Set `CRON_SECRET` in Vercel env vars
4. □ Optionally set `MINDBODY_WEBHOOK_SECRET`

---

## Session: January 12, 2026

### Accounts Payable Enhancements

**Mark Payable as Unpaid**
- Added `markPayableAsUnpaid()` function in `/lib/actions/payables.ts`
- Resets payable to `bill_status: 'approved'`, `is_paid: false`
- Unlinks the transaction if it was linked

**Retroactive Transaction Linking**
- Added `linkPayableRetroactive()` for linking already-paid payables to transactions
- Paid bills without a linked transaction now show a chain icon to link retroactively
- Uses same link modal with search but doesn't change paid status

**Enhanced Link Modal**
- Added search box to filter transactions by description, party, or amount
- Now fetches up to 100 expense transactions (not just 50 unreconciled)
- Only excludes transactions already linked to a payable

### Bill Template Due Date

**Problem**: Templates had no way to specify when bills are due - all generated bills defaulted to the 15th.

**Solution**: Added `day_of_month` field (1-28) to templates

**Files Modified**:
- `/lib/actions/payables.ts` - `createTemplate()` already accepted `day_of_month`, updated `generateUpcomingBills()` to use `template.day_of_month || 15`
- `/app/(dashboard)/accounts-payable/page.tsx` - Added `dayOfMonth` state, UI input field, included in create/update calls

**Migration Required**:
```sql
ALTER TABLE payables ADD COLUMN IF NOT EXISTS day_of_month INTEGER;
```

### Starling Bank Pot Transaction Sync

**Problem**: Transactions paid FROM savings goals (pots) weren't syncing - they only appear in the pot's category feed, not the main account feed.

**Solution**: Enhanced sync to fetch transactions from all savings goals

**Files Modified**:
- `/lib/starling/client.ts` - Added `getPotTransactions()` method
- `/lib/actions/starling.ts` - Modified sync to:
  1. Fetch main account transactions
  2. Fetch all savings goals via `getSavingsGoals()`
  3. Loop through each pot and fetch its transactions
  4. Combine all transactions before filtering/inserting

**Filter Logic**:
```typescript
const validTransactions = transactions.filter(tx =>
    tx.status === 'SETTLED' &&
    tx.source !== 'INTERNAL_TRANSFER'
)
```
- Excludes internal pot-to-main transfers
- Includes external vendor payments from pots (e.g., direct debits)

### Starling API Notes

> [!IMPORTANT]
> **API Update Delay**
> 
> Starling's API can have delays for same-day transactions. Transactions may appear in the app immediately but not sync via API until later. Morning transactions may not be available until afternoon.

---

### New/Modified Files Summary

| File | Change |
|------|--------|
| `/lib/actions/payables.ts` | Added `markPayableAsUnpaid()`, `linkPayableRetroactive()`, updated `generateUpcomingBills()` |
| `/app/(dashboard)/accounts-payable/page.tsx` | Added dayOfMonth state, retroactive link button, enhanced link modal with search |
| `/lib/starling/client.ts` | Added `getPotTransactions()` method |
| `/lib/actions/starling.ts` | Added pot transaction fetching, improved filter logging |
| `add-day-of-month.sql` | Migration for day_of_month column |

---

## Session Notes: January 12, 2026 (Part 2 - Cashflow Calendar)

### Budget Quarterly Actuals

**Enhancement**: Modified `getBudgetVsActual()` to filter actuals by locked quarters only.

**How it works**:
- Only locked quarters (Q1-Q4) contribute to the actuals calculation
- Transactions are filtered to only include months in locked quarters
- E.g., if only Q1 is locked, only Jan-Mar transactions count towards actuals

**File Modified**: `/lib/actions/budget.ts`

---

### Cashflow Calendar Playground

**New Feature**: Interactive calendar view for scheduling bills and viewing weekly cash flow.

**Files Created/Modified**:
| File | Purpose |
|------|---------|
| `/lib/actions/cash-flow-planner.ts` | Server actions for calendar data |
| `/app/(dashboard)/cash-flow/page.tsx` | Calendar tab UI |

**Server Actions**:
- `getScheduledPayables()` - Fetches bills from `payables` table (where `is_template = false`)
- `getScheduledReceivables()` - Fetches income from `scheduled_payments` (Mindbody autopay)
- `applyScheduleChanges()` - Bulk updates `next_due` dates
- `getCalendarData()` - Aggregates payables + receivables for a month

**Calendar Features**:
1. **Tab Navigation** - Forecast | Calendar tabs on Cash Flow page
2. **Monthly Grid** - 8-column layout (Mon-Sun + Week Total)
3. **Drag-and-Drop** - Bills can be dragged to different dates
4. **Pending Changes** - Local playground state, "Save" commits to database
5. **Weekly Summary** - Shows In/Out/Net/Balance per week
6. **Future Weeks Only** - Past weeks are hidden
7. **Income Hidden** - Mindbody payments only in weekly totals, not day cells

**Calendar Column Layout**:
```
| Mon | Tue | Wed | Thu | Fri | Sat | Sun | Week Total |
```

Week Total shows:
- In: +£X (Mindbody scheduled payments)
- Out: -£X (Bills/Payables)
- Net: +/-£X
- Balance: £X (running from current balance)

---

### Mindbody Autopay Sync Button

**New Feature**: "Sync Autopay" button on Cash Flow page header.

**Function**: Calls `syncMindbodyScheduledPayments()` which:
1. Fetches all Active + Declined members from `mb_members`
2. Creates/updates `scheduled_payments` for each member
3. Derives next payment date from last transaction if missing

**Filter Logic**: Only members with `membership_status IN ('Active', 'Declined')` - terminated members excluded.

---

### Key Column Name Fix

**Issue**: Calendar wasn't showing payables because query used `due_date` column.
**Fix**: Changed to `next_due` column (the actual column name in `payables` table).

---

### Files Summary

| File | Change |
|------|--------|
| `/lib/actions/budget.ts` | `getBudgetVsActual()` now filters by locked quarters |
| `/lib/actions/cash-flow-planner.ts` | NEW - Calendar planner server actions |
| `/app/(dashboard)/cash-flow/page.tsx` | Calendar tab, weekly totals, sync button |

---

## Session Notes: January 12-13, 2026 (Dashboard BI Redesign)

### Calendar Week Alignment Fix

**Problem**: Calendar weeks didn't match forecast table - calendar was month-bounded but forecast uses full 7-day weeks spanning months (e.g., "26 Jan - 01 Feb").

**Solution**: Rewrote calendar week generation to:
1. Start from Monday of week containing 1st of month
2. End on Sunday of week containing last of month
3. Include days from adjacent months to complete weeks
4. Style adjacent month days with muted colors

**Files Modified**: `/app/(dashboard)/cash-flow/page.tsx`

---

### Dashboard BI Redesign

**Complete rewrite** of the dashboard overview page with optimized BI layout.

**New Layout (4 rows)**:

| Row | Content |
|-----|---------|
| 1 | Financial Metrics: Bank Balance (live), This Month Income, This Month Expenses, Net Position |
| 2 | Member Metrics: Active Members, Monthly MRR, Declines This Month, At Risk Churn |
| 3 | 4-Week Cash Flow Chart (bar chart) + Actions Needed panel |
| 4 | Upcoming Payments table + Latest Transactions table |

**Key Features**:
- Real-time data from Supabase
- 4-week forecast bar chart with danger threshold line
- Actions panel with clickable links to pending tasks
- Color-coded metrics (emerald for income, red for expenses, amber for warnings)
- Responsive layout using existing Card component branding

**Data Sources**:
- Bank balance from `user_settings.opening_balance` + transaction sum
- Member stats from `mb_members` table
- Forecast from `payables` and `scheduled_payments`
- Actions from unreconciled transaction count, bills due count

**Files Modified**: `/app/(dashboard)/page.tsx` (complete rewrite)

---

### Planned Feature: Staff-Based Expense Projections

**Status**: Plan created, implementation deferred

**Purpose**: Predict future coach/staff expenses before invoices are generated.

**Approach**:
- Add `monthly_rate` and `pay_day` columns to staff table
- Include monthly staff in forecast based on their pay day
- Skip projection if payable already exists for that staff member

**Plan Location**: `/brain/implementation_plan.md`

---

## Session Notes: January 13, 2026 (Budget Page Refactoring)

### Budget Page Component Extraction

**Complete refactor** of the budget page from a corrupted 1,821-line monolith into modular components.

**Final Component Structure**:

| Component | Lines | Purpose |
|-----------|-------|---------|
| `page.tsx` | 148 | Main tab navigation |
| `BudgetScenariosTab.tsx` | 167 | Create/delete/duplicate scenarios |
| `BudgetEditorTab.tsx` | 295 | Yearly budget editor orchestrator |
| `BudgetTrackingTab.tsx` | 265 | Budget vs Actual tracking |
| `MonthlyBudgetEditor.tsx` | 447 | Monthly budget breakdown |
| `QuarterLockGrid.tsx` | 68 | Quarter lock/unlock controls |
| `ScenarioNotesEditor.tsx` | 106 | Scenario notes with AI cleanup |
| `CategoryHierarchyTable.tsx` | 196 | Expandable category tree |
| `budget-utils.ts` | 82 | Shared helper functions |

**New Features Added**:

1. **Month Selector Toggle** in Monthly Editor
   - `All Q1` shows 3 monthly columns + Q total
   - Individual month (Jan/Feb/Mar) shows Budget/Actual/Variance

2. **Click-to-Edit Budget Cells**
   - Direct click on budget value to edit (no icon)
   - Press Enter to save, Escape to cancel
   - Hover effect shows editability

3. **Variance Display**
   - Green = under budget (good)
   - Red = over budget (needs attention)
   - Shows +/- variance amount

**Files Created**:
| File | Path |
|------|------|
| BudgetScenariosTab | `/budget/components/BudgetScenariosTab.tsx` |
| BudgetEditorTab | `/budget/components/BudgetEditorTab.tsx` |
| BudgetTrackingTab | `/budget/components/BudgetTrackingTab.tsx` |
| MonthlyBudgetEditor | `/budget/components/MonthlyBudgetEditor.tsx` |
| QuarterLockGrid | `/budget/components/QuarterLockGrid.tsx` |
| ScenarioNotesEditor | `/budget/components/ScenarioNotesEditor.tsx` |
| CategoryHierarchyTable | `/budget/components/CategoryHierarchyTable.tsx` |
| Utils | `/budget/utils/budget-utils.ts` |
| Types | `/budget/utils/budget-types.ts` |
| Index (components) | `/budget/components/index.ts` |
| Index (utils) | `/budget/utils/index.ts` |

**Technical Fixes**:
- Fixed infinite loop in MonthlyBudgetEditor (useCallback dependency on array)
- Removed `yearlyConfirmed` restriction from monthly editing
- Added proper barrel exports for clean imports

**Git Setup**:
- Repository: `https://github.com/legioncodex100/legion-finance-app-v2.git`
- First push to `main` branch with all Legion Finance code

---

### Key Learnings

> [!IMPORTANT]
> **React useCallback Dependencies**
> 
> Never include computed arrays (like `quarterMonths`) in useCallback dependencies.
> They get recreated on every render, causing infinite loops.
> Instead, compute them inside the callback.

> [!TIP]
> **Budget Data Flow**
> 
> - Yearly total = Sum of all 12 monthly budgets
> - Editing yearly divides by 12 across all months
> - Editing monthly updates only that specific month
> - Q total = Sum of 3 months in that quarter

---

## Session Notes: January 13, 2026 (Part 2 - Vercel Deployment & Security)

### Vercel Deployment

**Repository:** `https://github.com/legioncodex100/legion-finance-app-v2`

**Build Issues Resolved:**

1. **Static Prerendering Error** - Login page and dashboard layout were trying to prerender with Supabase client
   - **Fix:** Added `export const dynamic = 'force-dynamic'` to:
     - `/src/app/(auth)/login/page.tsx`
     - `/src/app/(dashboard)/layout.tsx`
   - Split login into server wrapper + client form component

2. **Environment Variables Not Loading**
   - Debug endpoint created to verify: `hasSupabaseUrl: false`
   - **Fix:** User needed to manually add env vars in Vercel dashboard:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - Plus all Mindbody, Gemini, Starling keys

---

### Security Audit & Hardening

**RLS (Row Level Security) Status:**
- ✅ All 37 tables have RLS enabled
- ✅ Fixed `categories` table policy (was `USING (true)`, now `USING (auth.uid() = user_id)`)

**Security Layers Implemented:**

| Layer | Protection |
|-------|------------|
| **Edge Middleware** | Route protection before render |
| **Server Components** | Auth check in dashboard layout |
| **Supabase RLS** | 37 tables with user-scoped policies |
| **HTTPS/SSL** | Vercel automatic |

---

### Auth Middleware

**New File:** `/src/middleware.ts`

**Features:**
- Protects all dashboard routes at the edge (before render)
- Redirects unauthenticated users to `/login`
- Redirects logged-in users away from `/login` to `/`
- Refreshes session tokens automatically
- Excludes API routes, static files, images

**Protected Paths:**
```typescript
const protectedPaths = [
    '/', '/transactions', '/budget', '/cash-flow', '/bills',
    '/debts', '/invoices', '/staff', '/vendors', '/categories',
    '/creditors', '/assets', '/reports', '/balance-sheet',
    '/accounts-payable', '/reconciliation', '/settings', '/mindbody',
]
```

---

### Files Modified/Created

| File | Change |
|------|--------|
| `/src/middleware.ts` | NEW - Edge auth middleware |
| `/src/app/(auth)/login/page.tsx` | Server wrapper with dynamic export |
| `/src/app/(auth)/login/login-form.tsx` | NEW - Client form component |
| `/src/app/(dashboard)/layout.tsx` | Added dynamic export |
| `security-audit-rls.sql` | NEW - RLS audit/hardening script |

---

### Key Learnings

> [!IMPORTANT]
> **Next.js Dynamic Export in Client Components**
> 
> The `export const dynamic = 'force-dynamic'` directive only works in **server components**.
> For client components, create a server wrapper that sets the dynamic export, then renders the client component.

> [!CAUTION]
> **Vercel Environment Variables**
> 
> After adding env vars in Vercel dashboard, you MUST redeploy for them to take effect.
> Use the debug endpoint pattern to verify: `GET /api/debug-env` returns env status.

---

### [2026-01-13] UI Cleanup & Refactoring
- **Semantic Tokens**: Implemented `success`, `warning`, `info`, `danger` in `globals.css` (OKLCH color space).
- **Budget Refactor**:
  - Unified `MonthlyBudgetEditor.tsx` logic, removing ~130 lines of duplicated code for Month vs Quarter views.
  - Implemented CSS variables `--grid-budget-quarter` and `--grid-budget-month` to remove magic strings.
- **Component Extraction**:
  - Created reusable `<StatCard>` component.
  - Replaced repetitive card markup in `(dashboard)/page.tsx` and `transactions/page.tsx` with `<StatCard>`.
  - Standardized dashboard colors to use the new semantic tokens.

> [!FIX]
> **Tailwind Layout Fix**: The table layout in default/yearly views was broken due to Tailwind arbitrary values not compiling/applying correctly. Replaced with valid React inline styles `style={{ gridTemplateColumns: ... }}` to guarantee layout consistency across both Monthly and Yearly tables.

> [!FIX]
> **Variance Styling**: Updated Variance column to use explicit `text-emerald-500` (+) and `text-rose-500` (-) colors based on user request ("nice red"). Added `pr-4` right padding to align numbers away from the edge.

> [!UI_TWEAK]
> **Typography Hierarchy**: Increased font size of main budget categories (Classes) to `text-base` (from `text-sm`) to improve visual hierarchy.

---

### [2026-01-13] Mobile Polish & Table Standardization

#### Mobile Optimization
- **Responsive Header**: Refactored `BudgetEditorTab` header to stack vertically on mobile, resolving text overlap issues.
- **Grid Density**: Adjusted "Quarterly Commitments" grid from 4-columns to 2-columns on mobile for better touch targets.
- **Flex Wrapping**: Added `flex-wrap` to Month Selectors to prevent overflow on small screens.

#### Table UI Standardization
- **Unified Backgrounds**: Migrated Budget tables from mixed Zinc backgrounds to global `bg-card` (Pure Black).
- **Sticky Column Matching**: Enforced solid `bg-card` on sticky columns to perfectly match the row background, eliminating "striping" caused by transparent `bg-muted/50`.
- **Seamless Aesthetic**: Both Yearly and Monthly views now share identical container styling, removing visual disconnects.

#### Key Files Modified
- `src/app/(dashboard)/budget/components/BudgetEditorTab.tsx`
- `src/app/(dashboard)/budget/components/CategoryHierarchyTable.tsx`
- `src/app/(dashboard)/budget/components/MonthlyBudgetEditor.tsx`
