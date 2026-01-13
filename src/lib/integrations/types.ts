// Integration Types
export type IntegrationProvider = 'gemini' | 'mindbody' | 'stripe' | 'gocardless'

export type IntegrationStatus = 'connected' | 'error' | 'disconnected'

export interface Integration {
    id: string
    user_id: string
    provider: IntegrationProvider
    display_name: string | null
    is_enabled: boolean
    credentials: Record<string, any>
    settings: Record<string, any>
    status: IntegrationStatus
    last_sync_at: string | null
    last_test_at: string | null
    error_message: string | null
    created_at: string
    updated_at: string
}

export interface IntegrationToken {
    id: string
    integration_id: string
    access_token: string
    refresh_token: string | null
    token_type: string
    expires_at: string | null
    scope: string | null
    created_at: string
    updated_at: string
}

export interface IntegrationSyncLog {
    id: string
    integration_id: string
    sync_type: string
    status: 'started' | 'completed' | 'failed'
    records_processed: number
    duration_ms: number | null
    error_details: string | null
    metadata: Record<string, any>
    started_at: string
    completed_at: string | null
}

// Provider metadata for UI
export const INTEGRATION_PROVIDERS: Record<IntegrationProvider, {
    name: string
    description: string
    icon: string
    docsUrl: string
    features: string[]
    status: 'available' | 'coming_soon'
}> = {
    gemini: {
        name: 'Google Gemini AI',
        description: 'AI-powered transaction categorization, financial chat, and document analysis',
        icon: 'Sparkles',
        docsUrl: 'https://ai.google.dev/docs',
        features: [
            'Auto-categorize transactions',
            'Financial AI assistant',
            'Bill document OCR',
            'Budget notes cleanup'
        ],
        status: 'available'
    },
    mindbody: {
        name: 'Mindbody',
        description: 'Sync sales, clients, and revenue data from your Mindbody account',
        icon: 'Activity',
        docsUrl: 'https://developers.mindbodyonline.com',
        features: [
            'Auto-import sales as transactions',
            'Sync client data',
            'Real-time webhooks',
            'Revenue by category'
        ],
        status: 'available'
    },
    stripe: {
        name: 'Stripe',
        description: 'Connect your Stripe account for payment tracking',
        icon: 'CreditCard',
        docsUrl: 'https://stripe.com/docs/api',
        features: [
            'Auto-import payments',
            'Subscription tracking',
            'Payout reconciliation'
        ],
        status: 'coming_soon'
    },
    gocardless: {
        name: 'GoCardless',
        description: 'Bank feed integration for automatic transaction import',
        icon: 'Building2',
        docsUrl: 'https://developer.gocardless.com',
        features: [
            'Direct bank feeds',
            'Auto-import transactions',
            'Multi-bank support'
        ],
        status: 'coming_soon'
    }
}
