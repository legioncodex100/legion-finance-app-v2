"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Bug,
    Loader2,
    RefreshCw,
    Database,
    Server,
    Users,
    Calendar,
    Copy,
    CheckCircle,
    XCircle,
    FileText
} from "lucide-react"
import {
    debugGetClientContracts,
    debugGetScheduledPayments,
    debugGetMembers,
    debugRawApiCall,
    debugGetFeb2026Forecast,
    debugCheckAutopayContracts,
    debugCheckDeclinedMembers,
    debugCheckCashFlowScheduled,
    debugCheckPayablesStatus,
    migrateLegacyBillInvoiceLinks
} from "@/lib/actions/debug"
import { syncMindbodyScheduledPayments } from "@/lib/actions/mindbody-bi"
import { toast } from "sonner"

type DebugResult = {
    name: string
    success: boolean
    data: any
    error?: string
    timestamp: string
}

export default function DebugPage() {
    const [results, setResults] = React.useState<DebugResult[]>([])
    const [loading, setLoading] = React.useState<string | null>(null)
    const [expandedIndex, setExpandedIndex] = React.useState<number | null>(null)

    const addResult = (name: string, success: boolean, data: any, error?: string) => {
        setResults(prev => [{
            name,
            success,
            data,
            error,
            timestamp: new Date().toLocaleTimeString()
        }, ...prev.slice(0, 9)]) // Keep last 10
    }

    const handleFetchContracts = async () => {
        setLoading('contracts')
        try {
            const result = await debugGetClientContracts()
            addResult('Client Contracts (API)', result.success, {
                count: result.contractCount,
                sample: result.sampleContracts
            }, result.error)
        } catch (e) {
            addResult('Client Contracts (API)', false, null, String(e))
        }
        setLoading(null)
    }

    const handleFetchScheduledPayments = async () => {
        setLoading('scheduled')
        try {
            const result = await debugGetScheduledPayments()
            addResult('Scheduled Payments (DB)', result.success, {
                count: result.count,
                payments: result.payments
            }, result.error)
        } catch (e) {
            addResult('Scheduled Payments (DB)', false, null, String(e))
        }
        setLoading(null)
    }

    const handleFetchMembers = async () => {
        setLoading('members')
        try {
            const result = await debugGetMembers()
            addResult('Members (DB)', result.success, {
                totalCount: result.count,
                sample: result.members
            }, result.error)
        } catch (e) {
            addResult('Members (DB)', false, null, String(e))
        }
        setLoading(null)
    }

    const handleSyncAutopay = async () => {
        setLoading('sync')
        try {
            const result = await syncMindbodyScheduledPayments()
            addResult('Sync Autopay', result.success, result, undefined)
            toast.success(`Synced ${result.scheduled} scheduled payments`)
        } catch (e) {
            addResult('Sync Autopay', false, null, String(e))
            toast.error(String(e))
        }
        setLoading(null)
    }

    const handleRawApi = async (endpoint: string) => {
        setLoading(endpoint)
        try {
            const result = await debugRawApiCall(endpoint)
            addResult(`Raw API: ${endpoint}`, result.success, result.data, result.error)
        } catch (e) {
            addResult(`Raw API: ${endpoint}`, false, null, String(e))
        }
        setLoading(null)
    }

    const copyToClipboard = (data: any) => {
        navigator.clipboard.writeText(JSON.stringify(data, null, 2))
        toast.success('Copied to clipboard')
    }

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <Bug className="h-8 w-8 text-orange-500" />
                    <h1 className="text-3xl font-bold">Debug Console</h1>
                    <Badge variant="destructive">Dev Only</Badge>
                </div>
                <p className="text-muted-foreground">
                    Inspect raw API responses and database data. Use to troubleshoot sync issues.
                </p>
            </div>

            {/* Action Buttons */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Server className="h-5 w-5" />
                        API Calls
                    </CardTitle>
                    <CardDescription>Fetch raw data from Mindbody API</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                    <Button
                        onClick={handleFetchContracts}
                        disabled={!!loading}
                        variant="outline"
                    >
                        {loading === 'contracts' ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Database className="h-4 w-4 mr-2" />
                        )}
                        Client Contracts
                    </Button>
                    <Button
                        onClick={() => handleRawApi('salecontracts')}
                        disabled={!!loading}
                        variant="outline"
                    >
                        {loading === 'salecontracts' ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Database className="h-4 w-4 mr-2" />
                        )}
                        Sale Contracts
                    </Button>
                    <Button
                        onClick={() => handleRawApi('activememberships')}
                        disabled={!!loading}
                        variant="outline"
                    >
                        {loading === 'activememberships' ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Users className="h-4 w-4 mr-2" />
                        )}
                        Active Memberships
                    </Button>
                    <Button
                        onClick={() => handleRawApi('memberships')}
                        disabled={!!loading}
                        variant="outline"
                    >
                        {loading === 'memberships' ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Users className="h-4 w-4 mr-2" />
                        )}
                        All Memberships
                    </Button>
                    <Button
                        onClick={() => handleRawApi('services')}
                        disabled={!!loading}
                        variant="outline"
                    >
                        {loading === 'services' ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Server className="h-4 w-4 mr-2" />
                        )}
                        Services
                    </Button>
                    <Button
                        onClick={async () => {
                            setLoading('autopaycontracts')
                            try {
                                const result = await debugCheckAutopayContracts()
                                addResult('Autopay Contracts (per-client)', result.success, {
                                    membersChecked: result.membersChecked,
                                    contractsWithAutopay: result.contractsWithAutopay.length,
                                    details: result.contractsWithAutopay
                                }, result.error)
                            } catch (e) {
                                addResult('Autopay Contracts', false, null, String(e))
                            }
                            setLoading(null)
                        }}
                        disabled={!!loading}
                        className="bg-purple-600 hover:bg-purple-700"
                    >
                        {loading === 'autopaycontracts' ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Calendar className="h-4 w-4 mr-2" />
                        )}
                        Autopay Contracts
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        Database Queries
                    </CardTitle>
                    <CardDescription>Inspect data stored in Supabase</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                    <Button
                        onClick={handleFetchScheduledPayments}
                        disabled={!!loading}
                        variant="outline"
                    >
                        {loading === 'scheduled' ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Calendar className="h-4 w-4 mr-2" />
                        )}
                        Scheduled Payments
                    </Button>
                    <Button
                        onClick={handleFetchMembers}
                        disabled={!!loading}
                        variant="outline"
                    >
                        {loading === 'members' ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Users className="h-4 w-4 mr-2" />
                        )}
                        MB Members
                    </Button>
                    <Button
                        onClick={async () => {
                            setLoading('feb2026')
                            try {
                                const result = await debugGetFeb2026Forecast()
                                addResult('Feb 2026 Forecast', result.success, {
                                    count: result.count,
                                    total: `£${result.total.toLocaleString()}`,
                                    mindbodyTarget: { count: 221, total: '£15,660' },
                                    variance: {
                                        count: result.count - 221,
                                        amount: `£${(result.total - 15660).toLocaleString()}`
                                    },
                                    payments: result.payments.slice(0, 20)
                                }, result.error)
                            } catch (e) {
                                addResult('Feb 2026 Forecast', false, null, String(e))
                            }
                            setLoading(null)
                        }}
                        disabled={!!loading}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        {loading === 'feb2026' ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Calendar className="h-4 w-4 mr-2" />
                        )}
                        Feb 2026 Forecast
                    </Button>
                    <Button
                        onClick={async () => {
                            setLoading('declined')
                            try {
                                const result = await debugCheckDeclinedMembers()
                                addResult('Declined Members', result.success, {
                                    total: result.total,
                                    withNextPayment: result.withNextPayment,
                                    withoutNextPayment: result.withoutNextPayment,
                                    sample: result.sample
                                }, result.error)
                            } catch (e) {
                                addResult('Declined Members', false, null, String(e))
                            }
                            setLoading(null)
                        }}
                        disabled={!!loading}
                        className="bg-orange-600 hover:bg-orange-700"
                    >
                        {loading === 'declined' ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Users className="h-4 w-4 mr-2" />
                        )}
                        Declined Members
                    </Button>
                    <Button
                        onClick={async () => {
                            setLoading('cashflow')
                            try {
                                const result = await debugCheckCashFlowScheduled()
                                addResult('Cash Flow Weekly Breakdown', result.success, {
                                    totalPayments: result.totalPayments,
                                    totalAmount: `£${result.totalAmount.toLocaleString()}`,
                                    byWeek: result.byWeek
                                }, result.error)
                            } catch (e) {
                                addResult('Cash Flow Weekly', false, null, String(e))
                            }
                            setLoading(null)
                        }}
                        disabled={!!loading}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        {loading === 'cashflow' ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Calendar className="h-4 w-4 mr-2" />
                        )}
                        Cash Flow Weekly
                    </Button>
                    <Button
                        onClick={async () => {
                            setLoading('payables')
                            try {
                                const data = await debugCheckPayablesStatus()
                                setResults(prev => [{ name: 'Payables Status', success: data.success, data, timestamp: new Date().toISOString() }, ...prev])
                            } catch (e: any) {
                                setResults(prev => [{ name: 'Payables Status', success: false, data: e.message, timestamp: new Date().toISOString() }, ...prev])
                            } finally {
                                setLoading(null)
                            }
                        }}
                        disabled={!!loading}
                    >
                        {loading === 'payables' ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <FileText className="h-4 w-4 mr-2" />
                        )}
                        Debug Payables
                    </Button>
                    <Button
                        onClick={async () => {
                            setLoading('migrate-preview')
                            try {
                                const data = await migrateLegacyBillInvoiceLinks({ previewOnly: true })
                                setResults(prev => [{ name: 'Legacy Links (Preview)', success: data.success, data, timestamp: new Date().toISOString() }, ...prev])
                            } catch (e: any) {
                                setResults(prev => [{ name: 'Legacy Links (Preview)', success: false, data: e.message, timestamp: new Date().toISOString() }, ...prev])
                            } finally {
                                setLoading(null)
                            }
                        }}
                        disabled={!!loading}
                        variant="outline"
                        className="border-amber-800 text-amber-400 hover:bg-amber-900/30"
                    >
                        {loading === 'migrate-preview' ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <FileText className="h-4 w-4 mr-2" />
                        )}
                        Preview Legacy Links
                    </Button>
                    <Button
                        onClick={async () => {
                            if (!confirm('This will CLEAR all bill_id and invoice_id links from transactions. Continue?')) return
                            setLoading('migrate-clear')
                            try {
                                const data = await migrateLegacyBillInvoiceLinks({ previewOnly: false })
                                setResults(prev => [{ name: 'Legacy Links (Cleared)', success: data.success, data, timestamp: new Date().toISOString() }, ...prev])
                            } catch (e: any) {
                                setResults(prev => [{ name: 'Legacy Links (Cleared)', success: false, data: e.message, timestamp: new Date().toISOString() }, ...prev])
                            } finally {
                                setLoading(null)
                            }
                        }}
                        disabled={!!loading}
                        variant="destructive"
                    >
                        {loading === 'migrate-clear' ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <XCircle className="h-4 w-4 mr-2" />
                        )}
                        Clear Legacy Links
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <RefreshCw className="h-5 w-5" />
                        Sync Actions
                    </CardTitle>
                    <CardDescription>Trigger sync and inspect results</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                    <Button
                        onClick={handleSyncAutopay}
                        disabled={!!loading}
                    >
                        {loading === 'sync' ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Sync Autopay Schedules
                    </Button>
                </CardContent>
            </Card>

            {/* Results */}
            <Card>
                <CardHeader>
                    <CardTitle>Results Log</CardTitle>
                    <CardDescription>Click to expand, copy button copies JSON</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
                    {results.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">
                            Click a button above to fetch data...
                        </p>
                    ) : (
                        results.map((result, idx) => (
                            <div
                                key={idx}
                                className="border rounded-lg overflow-hidden"
                            >
                                <div
                                    className="flex items-center justify-between p-3 bg-muted/50 cursor-pointer hover:bg-muted"
                                    onClick={() => setExpandedIndex(expandedIndex === idx ? null : idx)}
                                >
                                    <div className="flex items-center gap-2">
                                        {result.success ? (
                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                        ) : (
                                            <XCircle className="h-4 w-4 text-red-500" />
                                        )}
                                        <span className="font-medium">{result.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {result.timestamp}
                                        </span>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            copyToClipboard(result.data)
                                        }}
                                    >
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                                {expandedIndex === idx && (
                                    <div className="p-3 bg-zinc-950 overflow-x-auto">
                                        <pre className="text-xs text-green-400 whitespace-pre-wrap">
                                            {result.error ? (
                                                <span className="text-red-400">Error: {result.error}</span>
                                            ) : (
                                                JSON.stringify(result.data, null, 2)
                                            )}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
