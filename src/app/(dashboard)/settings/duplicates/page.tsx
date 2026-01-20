"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    AlertTriangle,
    CheckCircle2,
    Copy,
    Loader2,
    RefreshCw,
    Search,
    Trash2,
    ArrowLeft,
    ShieldCheck,
    Ban
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import {
    checkForDuplicates,
    cleanupDuplicates,
    checkForExternalIdDuplicates,
    checkForImportHashDuplicates,
    type DuplicateGroup,
    type DuplicateCheckResult
} from "@/lib/actions/duplicate-checker"

export default function DuplicateCheckerPage() {
    const [loading, setLoading] = React.useState<string | null>(null)
    const [checkResult, setCheckResult] = React.useState<DuplicateCheckResult | null>(null)
    const [externalIdDupes, setExternalIdDupes] = React.useState<{ count: number } | null>(null)
    const [importHashDupes, setImportHashDupes] = React.useState<{ count: number } | null>(null)
    const [selectedGroups, setSelectedGroups] = React.useState<Set<number>>(new Set())
    const [expandedGroup, setExpandedGroup] = React.useState<number | null>(null)

    const handleCheck = async () => {
        setLoading('check')
        try {
            const [result, externalResult, hashResult] = await Promise.all([
                checkForDuplicates(),
                checkForExternalIdDuplicates(),
                checkForImportHashDuplicates()
            ])

            setCheckResult(result)
            setExternalIdDupes({ count: externalResult.count })
            setImportHashDupes({ count: hashResult.count })
            setSelectedGroups(new Set())

            if (result.success && result.totalGroups === 0) {
                toast.success('No duplicates found!')
            } else if (result.success) {
                toast.info(`Found ${result.totalGroups} duplicate groups (${result.totalDuplicateRows} extra rows)`)
            }
        } catch (error) {
            toast.error('Failed to check for duplicates')
        }
        setLoading(null)
    }

    const handleCleanupAll = async () => {
        if (!checkResult || checkResult.totalDuplicateRows === 0) return

        if (!confirm(`This will delete ${checkResult.totalDuplicateRows} duplicate transactions. The most enriched version of each transaction will be kept. Continue?`)) {
            return
        }

        setLoading('cleanup')
        try {
            const result = await cleanupDuplicates()
            if (result.success) {
                toast.success(`Deleted ${result.deletedCount} duplicate transactions`)
                // Refresh the check
                await handleCheck()
            } else {
                toast.error(result.error || 'Cleanup failed')
            }
        } catch (error) {
            toast.error('Failed to cleanup duplicates')
        }
        setLoading(null)
    }

    const handleCleanupSelected = async () => {
        if (!checkResult || selectedGroups.size === 0) return

        const selectedDuplicates = Array.from(selectedGroups).flatMap(idx =>
            checkResult.duplicateGroups[idx]?.delete_ids || []
        )

        if (selectedDuplicates.length === 0) return

        if (!confirm(`This will delete ${selectedDuplicates.length} duplicate transactions from ${selectedGroups.size} groups. Continue?`)) {
            return
        }

        setLoading('cleanup-selected')
        try {
            const result = await cleanupDuplicates(selectedDuplicates)
            if (result.success) {
                toast.success(`Deleted ${result.deletedCount} duplicate transactions`)
                await handleCheck()
            } else {
                toast.error(result.error || 'Cleanup failed')
            }
        } catch (error) {
            toast.error('Failed to cleanup selected duplicates')
        }
        setLoading(null)
    }

    const toggleGroup = (index: number) => {
        const newSelected = new Set(selectedGroups)
        if (newSelected.has(index)) {
            newSelected.delete(index)
        } else {
            newSelected.add(index)
        }
        setSelectedGroups(newSelected)
    }

    const selectAll = () => {
        if (!checkResult) return
        setSelectedGroups(new Set(checkResult.duplicateGroups.map((_, i) => i)))
    }

    const deselectAll = () => {
        setSelectedGroups(new Set())
    }

    const formatAmount = (amount: string) => {
        const num = parseFloat(amount)
        const formatted = Math.abs(num).toFixed(2)
        return num < 0 ? `-£${formatted}` : `£${formatted}`
    }

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Link href="/settings" className="text-muted-foreground hover:text-foreground">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <Copy className="h-8 w-8 text-amber-500" />
                        <h1 className="text-3xl font-bold">Duplicate Checker</h1>
                    </div>
                    <p className="text-muted-foreground">
                        Detect and clean up duplicate transactions from CSV imports or sync issues.
                    </p>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className={checkResult?.totalGroups === 0 ? 'border-green-500/50 bg-green-500/5' : ''}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Duplicate Groups
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            {checkResult?.totalGroups === 0 ? (
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                            ) : checkResult?.totalGroups ? (
                                <AlertTriangle className="h-5 w-5 text-amber-500" />
                            ) : null}
                            <span className="text-2xl font-bold">
                                {checkResult?.totalGroups ?? '—'}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card className={checkResult?.totalDuplicateRows === 0 ? 'border-green-500/50 bg-green-500/5' : ''}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Extra Rows to Delete
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            {checkResult?.totalDuplicateRows === 0 ? (
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                            ) : checkResult?.totalDuplicateRows ? (
                                <Trash2 className="h-5 w-5 text-red-500" />
                            ) : null}
                            <span className="text-2xl font-bold">
                                {checkResult?.totalDuplicateRows ?? '—'}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card className={(externalIdDupes?.count === 0 && importHashDupes?.count === 0) ? 'border-green-500/50 bg-green-500/5' : ''}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            System Integrity
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-sm">
                                {externalIdDupes?.count === 0 ? (
                                    <ShieldCheck className="h-4 w-4 text-green-500" />
                                ) : (
                                    <Ban className="h-4 w-4 text-red-500" />
                                )}
                                <span>External ID: {externalIdDupes?.count ?? '—'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                {importHashDupes?.count === 0 ? (
                                    <ShieldCheck className="h-4 w-4 text-green-500" />
                                ) : (
                                    <Ban className="h-4 w-4 text-red-500" />
                                )}
                                <span>Import Hash: {importHashDupes?.count ?? '—'}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Actions */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Search className="h-5 w-5" />
                        Scan & Clean
                    </CardTitle>
                    <CardDescription>
                        Scan for duplicate transactions and clean them up. The most enriched version
                        (with categories, links, confirmed status) will be kept.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                    <Button
                        onClick={handleCheck}
                        disabled={!!loading}
                        className="bg-amber-600 hover:bg-amber-700"
                    >
                        {loading === 'check' ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Search className="h-4 w-4 mr-2" />
                        )}
                        Scan for Duplicates
                    </Button>

                    <Button
                        onClick={handleCleanupAll}
                        disabled={!!loading || !checkResult || checkResult.totalDuplicateRows === 0}
                        variant="destructive"
                    >
                        {loading === 'cleanup' ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Trash2 className="h-4 w-4 mr-2" />
                        )}
                        Clean Up All ({checkResult?.totalDuplicateRows || 0})
                    </Button>

                    {selectedGroups.size > 0 && (
                        <Button
                            onClick={handleCleanupSelected}
                            disabled={!!loading}
                            variant="outline"
                            className="border-red-500 text-red-500 hover:bg-red-500/10"
                        >
                            {loading === 'cleanup-selected' ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Trash2 className="h-4 w-4 mr-2" />
                            )}
                            Clean Selected ({selectedGroups.size} groups)
                        </Button>
                    )}
                </CardContent>
            </Card>

            {/* Results Table */}
            {checkResult && checkResult.duplicateGroups.length > 0 && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Duplicate Groups</CardTitle>
                                <CardDescription>
                                    Click a row to see details. Select groups to clean up individually.
                                </CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={selectAll}>
                                    Select All
                                </Button>
                                <Button size="sm" variant="outline" onClick={deselectAll}>
                                    Deselect All
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12"></TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Party</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead className="text-center">Copies</TableHead>
                                        <TableHead className="text-center">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {checkResult.duplicateGroups.map((group, idx) => (
                                        <React.Fragment key={idx}>
                                            <TableRow
                                                className={`cursor-pointer ${selectedGroups.has(idx) ? 'bg-amber-500/10' : ''}`}
                                                onClick={() => setExpandedGroup(expandedGroup === idx ? null : idx)}
                                            >
                                                <TableCell>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedGroups.has(idx)}
                                                        onChange={(e) => {
                                                            e.stopPropagation()
                                                            toggleGroup(idx)
                                                        }}
                                                        className="h-4 w-4 rounded border-gray-300"
                                                    />
                                                </TableCell>
                                                <TableCell className="font-mono text-sm">
                                                    {group.transaction_date}
                                                </TableCell>
                                                <TableCell className="max-w-[200px] truncate">
                                                    {group.description}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground max-w-[150px] truncate">
                                                    {group.raw_party || '—'}
                                                </TableCell>
                                                <TableCell className={`text-right font-mono ${parseFloat(group.amount) < 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                    {formatAmount(group.amount)}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="destructive">
                                                        {group.count}x
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="outline" className="text-amber-500 border-amber-500">
                                                        {group.delete_ids.length} to delete
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                            {expandedGroup === idx && (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="bg-muted/30 p-4">
                                                        <div className="space-y-2">
                                                            <div className="text-sm">
                                                                <span className="font-medium text-green-500">Keep:</span>{' '}
                                                                <code className="text-xs bg-green-500/10 px-2 py-1 rounded">
                                                                    {group.keep_id}
                                                                </code>
                                                            </div>
                                                            <div className="text-sm">
                                                                <span className="font-medium text-red-500">Delete:</span>{' '}
                                                                {group.delete_ids.map((id, i) => (
                                                                    <code key={id} className="text-xs bg-red-500/10 px-2 py-1 rounded mr-1">
                                                                        {id.slice(0, 8)}...
                                                                    </code>
                                                                ))}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                Source: {group.source || 'manual'} |
                                                                All {group.count} transactions have matching date, amount, description, and party
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Empty State */}
            {checkResult && checkResult.duplicateGroups.length === 0 && (
                <Card className="border-green-500/50">
                    <CardContent className="py-12 text-center">
                        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-green-500 mb-2">All Clear!</h3>
                        <p className="text-muted-foreground">
                            No duplicate transactions found in your database.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Initial State */}
            {!checkResult && (
                <Card className="border-dashed">
                    <CardContent className="py-12 text-center">
                        <Search className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                        <h3 className="text-xl font-bold mb-2">Ready to Scan</h3>
                        <p className="text-muted-foreground mb-4">
                            Click &quot;Scan for Duplicates&quot; to check your transaction database.
                        </p>
                        <Button onClick={handleCheck} disabled={!!loading}>
                            {loading === 'check' ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Search className="h-4 w-4 mr-2" />
                            )}
                            Start Scan
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
