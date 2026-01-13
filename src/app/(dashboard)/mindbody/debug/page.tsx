"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Copy, Check, Sparkles } from "lucide-react"
import { toast } from "sonner"

// Import the debug functions
import { debugSalesData, debugNewEndpoints } from "@/lib/actions/mindbody-debug"
import { getStatusBreakdown } from "@/lib/actions/mindbody-status-debug"
import { explainMindbodyJson } from "@/lib/actions/mindbody-ai-explain"
import { runEnrichmentSync, clearAndResyncTransactions } from "@/lib/actions/mindbody-enrichment-sync"
import { getEnrichmentDashboardData, analyzeVoidedTransactions } from "@/lib/actions/mindbody-dashboard"
import { getMemberStatusSummary, debugContractFetch, debugActiveEdgeCases, syncMemberStatusesToDatabase } from "@/lib/actions/mindbody/member-status"
import { debugTransactionData, debugRawApiTransaction } from "@/lib/actions/mindbody-bi"

// Define available endpoints
const ENDPOINTS = [
    { id: 'clearAndResync', name: '🗑️ Clear & Resync Transactions', description: 'DELETE all transactions and sync fresh (fixes corrupted data)' },
    { id: 'enrichmentSync', name: '🚀 Run Enrichment Sync', description: 'Sync transactions, memberships, settlements with fees' },
    { id: 'enrichmentData', name: '📊 View Enrichment Data', description: 'See dashboard data from enrichment tables' },
    { id: 'voidedAnalysis', name: '🔍 Analyze Voided Payments', description: 'Check voided transactions for repeat customers' },
    { id: 'clients', name: 'GET /client/clients', description: 'All members with status' },
    { id: 'sales', name: 'GET /sale/sales', description: 'Sales transactions' },
    { id: 'contracts', name: 'GET /sale/contracts', description: 'Contract templates' },
    { id: 'services', name: 'GET /sale/services', description: 'Pricing catalog' },
    { id: 'transactions', name: 'GET /sale/transactions', description: 'Transactions with SettlementId' },
    { id: 'activeMemberships', name: 'GET /client/activememberships', description: 'Active/Suspended/Terminated' },
    { id: 'memberStatus', name: '🎯 Calculate Member Status', description: 'Uses Contracts API with priority hierarchy (~30s)' },
    { id: 'syncStatusToDB', name: '💾 Sync Status to DB', description: 'Save contract-based statuses to mb_members (updates dashboard)' },
    { id: 'debugContracts', name: '🔧 Debug Contracts API', description: 'Fetch raw contracts for 3 sample clients' },
    { id: 'debugEdgeCases', name: '🔍 Edge Cases (Gap)', description: 'Find Active + Terminated members (~24 gap)' },
    { id: 'debugTransactions', name: '💰 Check Transaction Data', description: 'Inspect transaction_date and gross_amount values' },
    { id: 'debugRawApi', name: '🔍 Raw API Fields', description: 'See actual field names from Mindbody API' },
    { id: 'statusBreakdown', name: 'Database Status', description: 'Member status counts' },
] as const

type EndpointId = typeof ENDPOINTS[number]['id']

export default function DebugPage() {
    const [selectedEndpoint, setSelectedEndpoint] = React.useState<EndpointId>('clients')
    const [result, setResult] = React.useState<any>(null)
    const [loading, setLoading] = React.useState(false)
    const [explaining, setExplaining] = React.useState(false)
    const [aiExplanation, setAiExplanation] = React.useState<string | null>(null)
    const [error, setError] = React.useState<string | null>(null)
    const [copied, setCopied] = React.useState(false)

    const runEndpoint = async () => {
        setLoading(true)
        setError(null)
        setResult(null)
        setAiExplanation(null)

        try {
            let data: any

            switch (selectedEndpoint) {
                case 'clearAndResync':
                    toast.info('Deleting old transactions and syncing fresh...')
                    data = await clearAndResyncTransactions(30)
                    toast.success(`Deleted ${data.deleted} old records, synced ${data.synced} fresh!`)
                    break

                case 'enrichmentSync':
                    toast.info('Running enrichment sync... This may take a moment')
                    data = await runEnrichmentSync(30)
                    toast.success('Enrichment sync complete!')
                    break

                case 'enrichmentData':
                    data = await getEnrichmentDashboardData(30)
                    break

                case 'voidedAnalysis':
                    toast.info('Analyzing voided transactions...')
                    data = await analyzeVoidedTransactions()
                    toast.success('Analysis complete!')
                    break

                case 'clients':
                case 'sales':
                case 'contracts':
                    data = await debugSalesData()
                    if (selectedEndpoint === 'clients') {
                        data = { sampleClient: data.sampleClient, note: 'Use Status Breakdown for full counts' }
                    } else if (selectedEndpoint === 'sales') {
                        data = { salesCount: data.salesCount, sampleSale: data.sampleSale, itemNames: data.itemNames }
                    } else if (selectedEndpoint === 'contracts') {
                        data = data.contracts
                    }
                    break

                case 'services':
                    const servicesData = await debugNewEndpoints()
                    data = servicesData.services
                    break

                case 'transactions':
                case 'activeMemberships':
                    const enrichApiData = await debugNewEndpoints()
                    if (selectedEndpoint === 'transactions') {
                        data = {
                            note: 'Transactions endpoint for SettlementId matching',
                            paymentReceipts: enrichApiData.paymentReceipts,
                            info: 'Use this to see EntryMethod, PaymentType, SettlementId'
                        }
                    } else if (selectedEndpoint === 'activeMemberships') {
                        data = {
                            note: 'Active memberships endpoint for status tracking',
                            contracts: enrichApiData.clientContracts,
                            info: 'Use this to see Active/Suspended/Terminated status'
                        }
                    }
                    break

                case 'memberStatus':
                    data = await getMemberStatusSummary()
                    break

                case 'syncStatusToDB':
                    data = await syncMemberStatusesToDatabase()
                    break

                case 'debugContracts':
                    data = await debugContractFetch()
                    break

                case 'debugEdgeCases':
                    data = await debugActiveEdgeCases()
                    break

                case 'debugTransactions':
                    data = await debugTransactionData()
                    break

                case 'debugRawApi':
                    data = await debugRawApiTransaction()
                    break

                case 'statusBreakdown':
                    data = await getStatusBreakdown()
                    break

                default:
                    data = { error: 'Unknown endpoint' }
            }

            setResult(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Request failed')
        } finally {
            setLoading(false)
        }
    }

    const explainWithAI = async () => {
        if (!result) return

        setExplaining(true)
        try {
            const selectedInfo = ENDPOINTS.find(e => e.id === selectedEndpoint)
            const explanation = await explainMindbodyJson(selectedInfo?.name || selectedEndpoint, result)
            setAiExplanation(explanation)
        } catch (err) {
            toast.error('Failed to get AI explanation')
        } finally {
            setExplaining(false)
        }
    }

    const copyToClipboard = async () => {
        if (!result) return

        try {
            await navigator.clipboard.writeText(JSON.stringify(result, null, 2))
            setCopied(true)
            toast.success('Copied to clipboard')
            setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error('Failed to copy')
        }
    }

    const selectedInfo = ENDPOINTS.find(e => e.id === selectedEndpoint)

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Mindbody API Debug</h1>
                <p className="text-muted-foreground">Test individual API endpoints and view raw responses</p>
            </div>

            {/* Endpoint Selector */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Select Endpoint</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-3">
                        <Select value={selectedEndpoint} onValueChange={(v) => setSelectedEndpoint(v as EndpointId)}>
                            <SelectTrigger className="w-[350px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {ENDPOINTS.map(ep => (
                                    <SelectItem key={ep.id} value={ep.id}>
                                        <span className="font-mono text-sm">{ep.name}</span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Button onClick={runEndpoint} disabled={loading}>
                            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Run
                        </Button>
                    </div>

                    {selectedInfo && (
                        <p className="text-sm text-muted-foreground">
                            {selectedInfo.description}
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Error Display */}
            {error && (
                <Card className="border-red-500">
                    <CardContent className="pt-6">
                        <p className="text-red-500 font-mono text-sm">{error}</p>
                    </CardContent>
                </Card>
            )}

            {/* Result Display */}
            {result && (
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg font-mono">{selectedInfo?.name}</CardTitle>
                            <div className="flex gap-2">
                                <Button variant="secondary" size="sm" onClick={explainWithAI} disabled={explaining}>
                                    {explaining ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                        <Sparkles className="h-4 w-4 mr-2" />
                                    )}
                                    Explain with AI
                                </Button>
                                <Button variant="outline" size="sm" onClick={copyToClipboard}>
                                    {copied ? (
                                        <Check className="h-4 w-4 mr-2 text-green-500" />
                                    ) : (
                                        <Copy className="h-4 w-4 mr-2" />
                                    )}
                                    Copy JSON
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* AI Explanation */}
                        {aiExplanation && (
                            <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <Sparkles className="h-4 w-4 text-purple-400" />
                                    <span className="font-semibold text-purple-300">AI Analysis</span>
                                </div>
                                <div className="prose prose-sm prose-invert max-w-none">
                                    <div dangerouslySetInnerHTML={{ __html: aiExplanation.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`(.*?)`/g, '<code>$1</code>') }} />
                                </div>
                            </div>
                        )}

                        {/* JSON Output */}
                        <pre className="text-xs overflow-auto max-h-[400px] bg-black/30 p-4 rounded-lg font-mono">
                            {JSON.stringify(result, null, 2)}
                        </pre>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
