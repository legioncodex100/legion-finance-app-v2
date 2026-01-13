"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    RefreshCw,
    Loader2,
    Clock,
    CheckCircle,
    XCircle,
    Activity,
    AlertTriangle,
    Webhook,
    Calendar,
    Database,
    Banknote
} from "lucide-react"
import { getSyncLogs, getSyncStats, type SyncLog } from "@/lib/actions/sync-logs"
import { smartMindbodySync, runFullMindbodySync } from "@/lib/actions/mindbody-sync"
import { toast } from "sonner"
import Link from "next/link"

export default function SyncManagementPage() {
    const [logs, setLogs] = React.useState<SyncLog[]>([])
    const [stats, setStats] = React.useState<{
        lastMindbodySync: string | null
        lastStarlingSync: string | null
        totalSyncsToday: number
        failedSyncsToday: number
    } | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [syncing, setSyncing] = React.useState<string | null>(null)
    const [lastMbSyncDate, setLastMbSyncDate] = React.useState<string | null>(null)

    // Load data
    React.useEffect(() => {
        loadData()
        const saved = localStorage.getItem('lastMindbodySyncDate')
        if (saved) setLastMbSyncDate(saved)
    }, [])

    const loadData = async () => {
        setLoading(true)
        const [logsData, statsData] = await Promise.all([
            getSyncLogs(30),
            getSyncStats()
        ])
        setLogs(logsData)
        setStats(statsData)
        setLoading(false)
    }

    const handleMindbodySmartSync = async () => {
        setSyncing('mindbody-smart')
        try {
            const result = await smartMindbodySync(lastMbSyncDate || undefined)
            if (result.success) {
                setLastMbSyncDate(result.lastSyncDate)
                localStorage.setItem('lastMindbodySyncDate', result.lastSyncDate)
                toast.success(`Synced ${result.transactions.synced} transactions`)
            } else {
                toast.error(result.error || 'Sync failed')
            }
        } catch (e) {
            toast.error('Sync failed')
        }
        setSyncing(null)
        loadData()
    }

    const handleMindbodyFullSync = async () => {
        setSyncing('mindbody-full')
        try {
            const result = await runFullMindbodySync()
            if (result.success) {
                toast.success(`Synced ${result.members.synced} members, ${result.pricing.updated} pricing`)
            } else {
                toast.error(result.error || 'Sync failed')
            }
        } catch (e) {
            toast.error('Sync failed')
        }
        setSyncing(null)
        loadData()
    }

    const formatDate = (date: string) => {
        return new Date(date).toLocaleString('en-GB', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        })
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <RefreshCw className="h-8 w-8 text-primary" />
                    <h1 className="text-3xl font-bold">Sync Management</h1>
                </div>
                <p className="text-muted-foreground">
                    Manage integrations, view sync logs, and configure webhooks.
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-2xl font-bold">{stats?.totalSyncsToday || 0}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Syncs Today</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <span className="text-2xl font-bold">{stats?.failedSyncsToday || 0}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Failed Today</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-purple-500" />
                            <span className="text-sm font-medium truncate">
                                {stats?.lastMindbodySync ? formatDate(stats.lastMindbodySync) : 'Never'}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground">Last Mindbody</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                            <Banknote className="h-4 w-4 text-emerald-500" />
                            <span className="text-sm font-medium truncate">
                                {lastMbSyncDate || 'Never'}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground">Last Starling</p>
                    </CardContent>
                </Card>
            </div>

            {/* Manual Sync Actions */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        Manual Sync
                    </CardTitle>
                    <CardDescription>Trigger syncs manually</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Mindbody */}
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                            <Activity className="h-5 w-5 text-purple-500" />
                            <div>
                                <p className="font-medium">Mindbody</p>
                                <p className="text-xs text-muted-foreground">
                                    {lastMbSyncDate ? `Last: ${lastMbSyncDate}` : 'Members, transactions, visits'}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                onClick={handleMindbodySmartSync}
                                disabled={!!syncing}
                            >
                                {syncing === 'mindbody-smart' ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                ) : (
                                    <RefreshCw className="h-4 w-4 mr-1" />
                                )}
                                Smart Sync
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleMindbodyFullSync}
                                disabled={!!syncing}
                            >
                                {syncing === 'mindbody-full' ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    'Full Sync'
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Starling */}
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                            <Banknote className="h-5 w-5 text-emerald-500" />
                            <div>
                                <p className="font-medium">Starling Bank</p>
                                <p className="text-xs text-muted-foreground">Via Transactions page</p>
                            </div>
                        </div>
                        <Link href="/transactions">
                            <Button size="sm" variant="outline">
                                <RefreshCw className="h-4 w-4 mr-1" />
                                Go to Sync
                            </Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>

            {/* Automated Sync Info */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Automated Syncs
                    </CardTitle>
                    <CardDescription>Scheduled and webhook-triggered syncs</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <Clock className="h-4 w-4 text-blue-500" />
                            <div>
                                <p className="font-medium text-sm">Nightly Cron</p>
                                <p className="text-xs text-muted-foreground">3 AM UTC daily</p>
                            </div>
                        </div>
                        <Badge variant="secondary">Active</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <Webhook className="h-4 w-4 text-orange-500" />
                            <div>
                                <p className="font-medium text-sm">Mindbody Webhooks</p>
                                <p className="text-xs text-muted-foreground">/api/webhooks/mindbody</p>
                            </div>
                        </div>
                        <Badge variant="outline">Endpoint Ready</Badge>
                    </div>
                </CardContent>
            </Card>

            {/* Sync Logs */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5" />
                                Recent Sync Logs
                            </CardTitle>
                            <CardDescription>Last 30 sync events</CardDescription>
                        </div>
                        <Button size="sm" variant="ghost" onClick={loadData}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {logs.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                            No sync logs yet. Run a sync to see activity here.
                        </p>
                    ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                            {logs.map((log) => (
                                <div
                                    key={log.id}
                                    className="flex items-center justify-between p-2 border rounded text-sm"
                                >
                                    <div className="flex items-center gap-2">
                                        {log.status === 'completed' ? (
                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                        ) : log.status === 'failed' ? (
                                            <XCircle className="h-4 w-4 text-red-500" />
                                        ) : (
                                            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                        )}
                                        <span className="font-medium">{log.sync_type}</span>
                                        {log.records_processed > 0 && (
                                            <Badge variant="secondary" className="text-xs">
                                                {log.records_processed} records
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        {log.duration_ms && <span>{log.duration_ms}ms</span>}
                                        <span>{formatDate(log.started_at)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
