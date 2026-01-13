"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { Sparkles, Activity, CreditCard, Building2, Check, X, Loader2, RefreshCw, ExternalLink, Plug } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    getIntegrations,
    testGeminiIntegration,
} from "@/lib/actions/integrations"
import { INTEGRATION_PROVIDERS, isMindbodyConfigured, type Integration, type IntegrationProvider } from "@/lib/integrations"

const PROVIDER_ICONS: Record<IntegrationProvider, React.ReactNode> = {
    gemini: <Sparkles className="h-6 w-6" />,
    mindbody: <Activity className="h-6 w-6" />,
    stripe: <CreditCard className="h-6 w-6" />,
    gocardless: <Building2 className="h-6 w-6" />
}

export default function IntegrationsPage() {
    const searchParams = useSearchParams()
    const [integrations, setIntegrations] = React.useState<Integration[]>([])
    const [loading, setLoading] = React.useState(true)
    const [actionLoading, setActionLoading] = React.useState<IntegrationProvider | null>(null)
    const [message, setMessage] = React.useState<{
        type: 'success' | 'error'
        text: string
    } | null>(null)

    // Show URL params messages
    React.useEffect(() => {
        const success = searchParams.get('success')
        const error = searchParams.get('error')
        if (success) {
            setMessage({ type: 'success', text: success })
        } else if (error) {
            setMessage({ type: 'error', text: error })
        }
    }, [searchParams])

    // Fetch integrations on mount
    React.useEffect(() => {
        async function load() {
            const data = await getIntegrations()
            setIntegrations(data)
            setLoading(false)
        }
        load()
    }, [])

    const handleTestGemini = async () => {
        setActionLoading('gemini')
        setMessage(null)

        const result = await testGeminiIntegration()

        setMessage({
            type: result.success ? 'success' : 'error',
            text: result.success
                ? `Gemini connected (${result.latencyMs}ms)`
                : `Connection failed: ${result.error}`
        })
        setActionLoading(null)

        const data = await getIntegrations()
        setIntegrations(data)
    }

    const handleTestMindbody = async () => {
        setActionLoading('mindbody')
        setMessage(null)

        try {
            const response = await fetch('/api/integrations/mindbody/test', { method: 'POST' })
            const result = await response.json()

            setMessage({
                type: result.success ? 'success' : 'error',
                text: result.success ? 'Mindbody connected!' : result.message
            })
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to test Mindbody connection' })
        }

        setActionLoading(null)
        const data = await getIntegrations()
        setIntegrations(data)
    }

    const handleSyncMindbody = async () => {
        setActionLoading('mindbody')
        setMessage(null)

        try {
            const response = await fetch('/api/integrations/mindbody/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ daysBack: 30 }),
            })
            const result = await response.json()

            if (result.success) {
                setMessage({
                    type: 'success',
                    text: `Synced ${result.transactionsCreated} new transactions (${result.transactionsSkipped} skipped)`
                })
            } else {
                setMessage({ type: 'error', text: result.errors?.[0] || 'Sync failed' })
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to sync with Mindbody' })
        }
        setActionLoading(null)
    }

    const getIntegrationStatus = (provider: IntegrationProvider) => {
        return integrations.find(i => i.provider === provider)
    }

    const renderStatusBadge = (integration: Integration | undefined, provider: IntegrationProvider) => {
        const providerInfo = INTEGRATION_PROVIDERS[provider]

        if (providerInfo.status === 'coming_soon') {
            return <Badge variant="secondary">Coming Soon</Badge>
        }

        if (!integration) {
            return <Badge variant="outline" className="text-muted-foreground">Not Connected</Badge>
        }

        switch (integration.status) {
            case 'connected':
                return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Connected</Badge>
            case 'error':
                return <Badge variant="destructive">Error</Badge>
            case 'disconnected':
            default:
                return <Badge variant="outline">Disconnected</Badge>
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <Plug className="h-8 w-8 text-primary" />
                    <h1 className="text-3xl font-bold">Integrations</h1>
                </div>
                <p className="text-muted-foreground">
                    Connect external services to enhance Legion Finance with AI, bank feeds, and business data.
                </p>
            </div>

            {/* Message Alert */}
            {message && (
                <div className={`mb-6 p-4 rounded-lg border ${message.type === 'success'
                    ? 'bg-green-500/10 border-green-500/20 text-green-700'
                    : 'bg-red-500/10 border-red-500/20 text-red-700'
                    }`}>
                    <div className="flex items-center gap-2">
                        {message.type === 'success' ? (
                            <Check className="h-5 w-5" />
                        ) : (
                            <X className="h-5 w-5" />
                        )}
                        <span className="font-medium">{message.text}</span>
                    </div>
                </div>
            )}

            <div className="grid gap-4">
                {(Object.keys(INTEGRATION_PROVIDERS) as IntegrationProvider[]).map((provider) => {
                    const providerInfo = INTEGRATION_PROVIDERS[provider]
                    const integration = getIntegrationStatus(provider)
                    const isAvailable = providerInfo.status === 'available'
                    const isComingSoon = providerInfo.status === 'coming_soon'
                    const isConnected = integration?.status === 'connected'

                    return (
                        <Card key={provider} className={isComingSoon ? 'opacity-60' : ''}>
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${isConnected
                                            ? 'bg-green-500/10 text-green-600'
                                            : 'bg-muted text-muted-foreground'
                                            }`}>
                                            {PROVIDER_ICONS[provider]}
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg">{providerInfo.name}</CardTitle>
                                            <CardDescription>{providerInfo.description}</CardDescription>
                                        </div>
                                    </div>
                                    {renderStatusBadge(integration, provider)}
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {/* Features List */}
                                    <div className="flex flex-wrap gap-2">
                                        {providerInfo.features.map((feature, idx) => (
                                            <Badge key={idx} variant="secondary" className="text-xs">
                                                {feature}
                                            </Badge>
                                        ))}
                                    </div>

                                    {/* Error Message */}
                                    {integration?.error_message && (
                                        <p className="text-sm text-red-600 bg-red-50 p-2 rounded">
                                            {integration.error_message}
                                        </p>
                                    )}

                                    {/* Last Sync */}
                                    {integration?.last_sync_at && (
                                        <p className="text-xs text-muted-foreground">
                                            Last synced: {new Date(integration.last_sync_at).toLocaleString()}
                                        </p>
                                    )}

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 pt-2">
                                        {/* Gemini Actions */}
                                        {provider === 'gemini' && isAvailable && (
                                            <Button
                                                size="sm"
                                                variant={isConnected ? 'outline' : 'default'}
                                                onClick={handleTestGemini}
                                                disabled={actionLoading === 'gemini'}
                                            >
                                                {actionLoading === 'gemini' ? (
                                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                ) : (
                                                    <RefreshCw className="h-4 w-4 mr-2" />
                                                )}
                                                Test Connection
                                            </Button>
                                        )}

                                        {/* Mindbody Actions */}
                                        {provider === 'mindbody' && isAvailable && (
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant={isConnected ? 'outline' : 'default'}
                                                    onClick={handleTestMindbody}
                                                    disabled={actionLoading === 'mindbody'}
                                                >
                                                    {actionLoading === 'mindbody' ? (
                                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                    ) : (
                                                        <RefreshCw className="h-4 w-4 mr-2" />
                                                    )}
                                                    Test Connection
                                                </Button>
                                                {isConnected && (
                                                    <Button
                                                        size="sm"
                                                        variant="default"
                                                        onClick={handleSyncMindbody}
                                                        disabled={actionLoading === 'mindbody'}
                                                    >
                                                        Sync Sales
                                                    </Button>
                                                )}
                                            </>
                                        )}

                                        {isComingSoon && (
                                            <Button size="sm" variant="outline" disabled>
                                                Coming Soon
                                            </Button>
                                        )}

                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            asChild
                                        >
                                            <a href={providerInfo.docsUrl} target="_blank" rel="noopener noreferrer">
                                                <ExternalLink className="h-4 w-4 mr-2" />
                                                Docs
                                            </a>
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            {/* Setup Instructions */}
            <Card className="mt-8">
                <CardHeader>
                    <CardTitle className="text-lg">Setup Instructions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <h4 className="font-medium mb-1">Gemini AI</h4>
                        <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                            <li>Get an API key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google AI Studio</a></li>
                            <li>Add <code className="bg-muted px-1 rounded">GEMINI_API_KEY=your_key</code> to <code className="bg-muted px-1 rounded">.env.local</code></li>
                        </ol>
                    </div>
                    <div>
                        <h4 className="font-medium mb-1">Mindbody</h4>
                        <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                            <li>Get your API key from <a href="https://developers.mindbodyonline.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">Mindbody Developer Portal</a></li>
                            <li>Add to <code className="bg-muted px-1 rounded">.env.local</code>:
                                <pre className="bg-muted p-2 rounded mt-1 text-xs overflow-x-auto">
                                    {`MINDBODY_API_KEY=your_api_key
MINDBODY_SITE_ID=your_site_id
MINDBODY_STAFF_USERNAME=your_staff_username
MINDBODY_STAFF_PASSWORD=your_staff_password`}
                                </pre>
                            </li>
                        </ol>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
