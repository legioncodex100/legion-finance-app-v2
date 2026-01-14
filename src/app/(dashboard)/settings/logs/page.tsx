"use client"

import { useState, useEffect, useCallback } from "react"
import {
    FileText, RefreshCw, Filter, Clock, CheckCircle, XCircle,
    Webhook, Database, ArrowUpDown, ChevronDown, ChevronUp
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { getApiLogs, getApiLogStats, type ApiLog } from "@/lib/actions/api-logs"

// ============================================
// STATUS BADGE
// ============================================
function StatusBadge({ status }: { status: string }) {
    const variants: Record<string, string> = {
        "success": "bg-emerald-500/20 text-emerald-400",
        "error": "bg-rose-500/20 text-rose-400",
        "pending": "bg-amber-500/20 text-amber-400",
    }

    return (
        <Badge className={variants[status] || "bg-zinc-500/20 text-zinc-400"}>
            {status === "success" ? <CheckCircle className="h-3 w-3 mr-1" /> :
                status === "error" ? <XCircle className="h-3 w-3 mr-1" /> : null}
            {status}
        </Badge>
    )
}

// ============================================
// TYPE BADGE
// ============================================
function TypeBadge({ type }: { type: string }) {
    const variants: Record<string, { color: string; icon: React.ReactNode }> = {
        "webhook": { color: "bg-sky-500/20 text-sky-400", icon: <Webhook className="h-3 w-3 mr-1" /> },
        "api_call": { color: "bg-violet-500/20 text-violet-400", icon: <Database className="h-3 w-3 mr-1" /> },
        "sync": { color: "bg-amber-500/20 text-amber-400", icon: <ArrowUpDown className="h-3 w-3 mr-1" /> },
    }

    const variant = variants[type] || { color: "bg-zinc-500/20 text-zinc-400", icon: null }

    return (
        <Badge className={variant.color}>
            {variant.icon}
            {type}
        </Badge>
    )
}

// ============================================
// MAIN PAGE
// ============================================
export default function LogsPage() {
    const [logs, setLogs] = useState<ApiLog[]>([])
    const [stats, setStats] = useState({ total: 0, webhooks: 0, apiCalls: 0, syncs: 0, errors: 0, last24h: 0 })
    const [isLoading, setIsLoading] = useState(true)
    const [typeFilter, setTypeFilter] = useState<string>("all")
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const [sourceFilter, setSourceFilter] = useState<string>("all")

    // Detail modal
    const [selectedLog, setSelectedLog] = useState<ApiLog | null>(null)
    const [isDetailOpen, setIsDetailOpen] = useState(false)

    // Fetch logs
    const fetchLogs = useCallback(async () => {
        setIsLoading(true)
        try {
            const [logsData, statsData] = await Promise.all([
                getApiLogs({
                    logType: typeFilter !== "all" ? typeFilter as any : undefined,
                    status: statusFilter !== "all" ? statusFilter as any : undefined,
                    source: sourceFilter !== "all" ? sourceFilter as any : undefined,
                    limit: 200
                }),
                getApiLogStats()
            ])
            setLogs(logsData)
            setStats(statsData)
        } catch (error) {
            console.error("Failed to fetch logs:", error)
        } finally {
            setIsLoading(false)
        }
    }, [typeFilter, statusFilter, sourceFilter])

    useEffect(() => {
        fetchLogs()
    }, [fetchLogs])

    // Format time
    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)

        if (diffMins < 1) return "Just now"
        if (diffMins < 60) return `${diffMins}m ago`
        if (diffHours < 24) return `${diffHours}h ago`
        return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-violet-400" />
                    <div>
                        <h1 className="text-2xl font-bold">API & Webhook Logs</h1>
                        <p className="text-sm text-zinc-500">
                            {stats.last24h} events in last 24h • {stats.errors} errors
                        </p>
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={fetchLogs} disabled={isLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="text-3xl font-bold text-sky-400">{stats.webhooks}</div>
                    <div className="text-sm text-zinc-500">Webhooks</div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="text-3xl font-bold text-violet-400">{stats.apiCalls}</div>
                    <div className="text-sm text-zinc-500">API Calls</div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="text-3xl font-bold text-amber-400">{stats.syncs}</div>
                    <div className="text-sm text-zinc-500">Syncs</div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="text-3xl font-bold text-rose-400">{stats.errors}</div>
                    <div className="text-sm text-zinc-500">Errors</div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-40">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="webhook">Webhooks</SelectItem>
                        <SelectItem value="api_call">API Calls</SelectItem>
                        <SelectItem value="sync">Syncs</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="Source" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Sources</SelectItem>
                        <SelectItem value="mindbody">Mindbody</SelectItem>
                        <SelectItem value="starling">Starling</SelectItem>
                        <SelectItem value="supabase">Supabase</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Logs Table */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="border-zinc-800 hover:bg-transparent">
                            <TableHead className="text-zinc-400">Time</TableHead>
                            <TableHead className="text-zinc-400">Type</TableHead>
                            <TableHead className="text-zinc-400">Source</TableHead>
                            <TableHead className="text-zinc-400">Event</TableHead>
                            <TableHead className="text-zinc-400">Status</TableHead>
                            <TableHead className="text-zinc-400 text-right">Duration</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-12 text-zinc-500">
                                    Loading logs...
                                </TableCell>
                            </TableRow>
                        ) : logs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-12 text-zinc-500">
                                    No logs found. Logs will appear when webhooks or API calls are made.
                                </TableCell>
                            </TableRow>
                        ) : (
                            logs.map((log) => (
                                <TableRow
                                    key={log.id}
                                    className="border-zinc-800 hover:bg-zinc-800/50 cursor-pointer"
                                    onClick={() => { setSelectedLog(log); setIsDetailOpen(true) }}
                                >
                                    <TableCell className="text-zinc-400">
                                        <Clock className="h-3 w-3 inline mr-1" />
                                        {formatTime(log.created_at)}
                                    </TableCell>
                                    <TableCell>
                                        <TypeBadge type={log.log_type} />
                                    </TableCell>
                                    <TableCell className="capitalize">{log.source}</TableCell>
                                    <TableCell className="font-mono text-sm">
                                        {log.event_type || "-"}
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge status={log.status} />
                                    </TableCell>
                                    <TableCell className="text-right text-zinc-400">
                                        {log.duration_ms !== null ? `${log.duration_ms}ms` : "-"}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Detail Modal */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3">
                            <TypeBadge type={selectedLog?.log_type || ""} />
                            <span>{selectedLog?.event_type || "Log Details"}</span>
                        </DialogTitle>
                    </DialogHeader>

                    {selectedLog && (
                        <div className="space-y-4 mt-4">
                            {/* Meta info */}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-zinc-500">Source:</span>{" "}
                                    <span className="capitalize">{selectedLog.source}</span>
                                </div>
                                <div>
                                    <span className="text-zinc-500">Status:</span>{" "}
                                    <StatusBadge status={selectedLog.status} />
                                </div>
                                <div>
                                    <span className="text-zinc-500">Time:</span>{" "}
                                    {new Date(selectedLog.created_at).toLocaleString("en-GB")}
                                </div>
                                <div>
                                    <span className="text-zinc-500">Duration:</span>{" "}
                                    {selectedLog.duration_ms !== null ? `${selectedLog.duration_ms}ms` : "-"}
                                </div>
                            </div>

                            {/* Error message */}
                            {selectedLog.error_message && (
                                <div>
                                    <h4 className="text-sm font-medium text-rose-400 mb-1">Error Message</h4>
                                    <pre className="bg-rose-950/30 border border-rose-900/50 rounded-lg p-3 text-sm text-rose-300 overflow-x-auto">
                                        {selectedLog.error_message}
                                    </pre>
                                </div>
                            )}

                            {/* Request data */}
                            {selectedLog.request_data && (
                                <div>
                                    <h4 className="text-sm font-medium text-zinc-400 mb-1">Request Data</h4>
                                    <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-300 overflow-x-auto max-h-48">
                                        {JSON.stringify(selectedLog.request_data, null, 2)}
                                    </pre>
                                </div>
                            )}

                            {/* Response data */}
                            {selectedLog.response_data && (
                                <div>
                                    <h4 className="text-sm font-medium text-zinc-400 mb-1">Response Data</h4>
                                    <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-300 overflow-x-auto max-h-48">
                                        {JSON.stringify(selectedLog.response_data, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
