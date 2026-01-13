# Integrations Hub Implementation Plan

## Goal

Create a centralized **Integrations Hub** for managing external service connections (Gemini AI, Mindbody) with deep integration throughout Legion Finance.

---

## Current State

### Gemini AI (Existing)
- **Location:** `lib/ai/gemini.ts` (188 lines)
- **Usage:** 4 files import Gemini functions
- **Issues:**
  - 2 different env vars: `GEMINI_API_KEY` and `GOOGLE_GEMINI_API_KEY`
  - Mixed model versions: `gemini-1.5-flash-latest` and `gemini-2.0-flash-exp`
  - No central config or connection status UI

### Mindbody (Not Yet Integrated)
- OAuth 2.0 required for authentication
- API endpoints available for sales, transactions, clients
- Webhooks for real-time sale notifications

---

## Proposed Changes

### Database Schema

#### [NEW] [integrations-schema.sql](file:///Users/mohammed/Desktop/New%20Legion%20Finance%20App/legion-finance/integrations-schema.sql)

```sql
-- Integration configurations table
CREATE TABLE integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    provider TEXT NOT NULL, -- 'gemini', 'mindbody', 'stripe', etc.
    is_enabled BOOLEAN DEFAULT false,
    credentials JSONB, -- Encrypted API keys, tokens
    settings JSONB, -- Provider-specific settings
    status TEXT DEFAULT 'disconnected', -- 'connected', 'error', 'disconnected'
    last_sync_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

-- OAuth tokens (for Mindbody)
CREATE TABLE integration_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_type TEXT DEFAULT 'Bearer',
    expires_at TIMESTAMPTZ,
    scope TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sync logs for debugging
CREATE TABLE integration_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
    sync_type TEXT, -- 'sales', 'clients', 'transactions'
    status TEXT, -- 'started', 'completed', 'failed'
    records_synced INTEGER DEFAULT 0,
    error_details TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
```

---

### Settings UI

#### [NEW] [settings/integrations/page.tsx](file:///Users/mohammed/Desktop/New%20Legion%20Finance%20App/legion-finance/src/app/(dashboard)/settings/integrations/page.tsx)

Central hub page with cards for each integration:

| Integration | Status | Actions |
|-------------|--------|---------|
| **Gemini AI** | ✅ Connected | Configure Model, Test Connection |
| **Mindbody** | ⚪ Not Connected | Connect Account |
| **Stripe** | 🔜 Coming Soon | — |
| **GoCardless** | 🔜 Coming Soon | — |

**Features:**
- Connection status indicators
- One-click connect/disconnect
- Test connection buttons
- Last sync timestamps
- Error messages with troubleshooting

---

### Gemini Centralization

#### [MODIFY] [lib/integrations/gemini.ts](file:///Users/mohammed/Desktop/New%20Legion%20Finance%20App/legion-finance/src/lib/integrations/gemini.ts)

```typescript
// Centralized Gemini configuration
export const GeminiConfig = {
  models: {
    fast: 'gemini-2.0-flash-exp',
    pro: 'gemini-1.5-pro-latest',
  },
  defaultModel: 'fast',
}

export async function getGeminiClient(userId: string) {
  // Fetch API key from integrations table or env fallback
  const integration = await getIntegration(userId, 'gemini')
  const apiKey = integration?.credentials?.apiKey || process.env.GEMINI_API_KEY
  
  if (!apiKey) throw new Error('Gemini not configured')
  
  return new GoogleGenerativeAI(apiKey)
}
```

---

### Mindbody Integration

#### [NEW] [lib/integrations/mindbody/](file:///Users/mohammed/Desktop/New%20Legion%20Finance%20App/legion-finance/src/lib/integrations/mindbody/)

```
lib/integrations/mindbody/
├── client.ts          - API client wrapper
├── oauth.ts           - OAuth 2.0 flow handlers
├── sync.ts            - Data sync functions
├── webhooks.ts        - Webhook handlers
└── types.ts           - Mindbody type definitions
```

**OAuth Flow:**
1. User clicks "Connect Mindbody"
2. Redirect to `signin.mindbodyonline.com/connect/authorize`
3. User grants consent
4. Callback receives auth code
5. Exchange for access + refresh tokens
6. Store in `integration_tokens`

**Data Sync:**
- Sync sales → Create transactions automatically
- Sync clients → Match to vendors/customers
- Sync revenue by category → Map to financial classes

---

### Deep Integration Points

| Feature | Gemini | Mindbody |
|---------|--------|----------|
| **Transactions** | AI categorization | Auto-import sales |
| **Reconciliation** | Smart matching suggestions | Match MB sales to bank |
| **Budget** | Notes cleanup | Revenue projections |
| **Cash Flow** | Pattern analysis | Scheduled payment imports |
| **Reports** | AI insights | Revenue by service type |
| **Dashboard** | Financial chat | Today's sales widget |

---

### API Routes

#### [NEW] [app/api/integrations/](file:///Users/mohammed/Desktop/New%20Legion%20Finance%20App/legion-finance/src/app/api/integrations/)

```
api/integrations/
├── status/route.ts           - GET all integration statuses
├── gemini/
│   ├── test/route.ts         - POST test connection
│   └── configure/route.ts    - POST save settings
├── mindbody/
│   ├── connect/route.ts      - GET initiate OAuth
│   ├── callback/route.ts     - GET OAuth callback
│   ├── disconnect/route.ts   - POST disconnect
│   ├── sync/route.ts         - POST manual sync
│   └── webhook/route.ts      - POST webhook receiver
```

---

### Navigation Update

#### [MODIFY] [nav-sidebar.tsx](file:///Users/mohammed/Desktop/New%20Legion%20Finance%20App/legion-finance/src/components/nav-sidebar.tsx)

Add to Settings section:
```tsx
{ title: "Integrations", url: "/settings/integrations", icon: Plug }
```

---

## User Review Required

> [!IMPORTANT]
> **Mindbody API requires paid access.** The Mindbody API has per-call pricing. Do you have an active Mindbody developer account with API access enabled?

> [!IMPORTANT]
> **OAuth Callback URL.** For Mindbody OAuth, we need a callback URL. In development: `http://localhost:3000/api/integrations/mindbody/callback`. For production, you'll need to configure this in the Mindbody developer portal.

**Questions:**
1. Do you have Mindbody API credentials (Client ID + Secret)?
2. Should we start with Gemini centralization first (simpler), then add Mindbody?
3. Are there other integrations you want to plan for (Stripe, GoCardless, bank feeds)?

---

## Verification Plan

### Phase 1: Gemini Centralization
- [ ] Create `integrations` table
- [ ] Build settings UI with Gemini card
- [ ] Migrate existing Gemini calls to centralized client
- [ ] Add connection test button
- [ ] Verify all 4 existing Gemini usages still work

### Phase 2: Mindbody Integration
- [ ] Implement OAuth flow
- [ ] Test connection + token refresh
- [ ] Build sales sync to create transactions
- [ ] Add manual sync button
- [ ] Set up webhook for real-time sales
