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
    Mail,
    Loader2,
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    Calendar,
    RefreshCw
} from "lucide-react"
import Link from "next/link"
import { getPeriodDeclines, getRepeatDecliners } from "@/lib/actions/mindbody-bi"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"

type PeriodDecline = {
    clientId: string
    name: string
    email: string
    monthly_rate: number
    declineDate: string
    declineCount: number
}

type RepeatDecliner = {
    clientId: string
    name: string
    email: string
    monthly_rate: number
    monthsWithDeclines: number
    totalDeclineCount: number
    declineMonths: string[]
}

export default function DeclineRecoveryPage() {
    const [declines, setDeclines] = React.useState<PeriodDecline[]>([])
    const [repeatDecliners, setRepeatDecliners] = React.useState<RepeatDecliner[]>([])
    const [loading, setLoading] = React.useState(true)
    const [selectedDate, setSelectedDate] = React.useState(new Date())

    const getDateRange = React.useCallback(() => {
        const year = selectedDate.getFullYear()
        const month = selectedDate.getMonth()
        const today = new Date()

        const startDate = new Date(year, month, 1)
        let endDate: Date

        if (month < today.getMonth() || year < today.getFullYear()) {
            endDate = new Date(year, month + 1, 0)
        } else {
            endDate = today
        }

        return { startDate, endDate }
    }, [selectedDate])

    const loadDeclines = React.useCallback(async () => {
        setLoading(true)
        try {
            const { startDate, endDate } = getDateRange()
            const [periodData, repeatData] = await Promise.all([
                getPeriodDeclines(startDate, endDate),
                getRepeatDecliners(6)
            ])
            setDeclines(periodData)
            setRepeatDecliners(repeatData)
        } catch (error) {
            toast.error("Failed to load declines")
        } finally {
            setLoading(false)
        }
    }, [getDateRange])

    React.useEffect(() => {
        loadDeclines()
    }, [loadDeclines])

    const navigateMonth = (direction: -1 | 1) => {
        setSelectedDate(prev => {
            const newDate = new Date(prev)
            newDate.setMonth(newDate.getMonth() + direction)
            return newDate
        })
    }

    const monthName = selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' })
    const { startDate, endDate } = getDateRange()
    const dateRangeLabel = `${startDate.getDate()} ${startDate.toLocaleString('default', { month: 'short' })} - ${endDate.getDate()} ${endDate.toLocaleString('default', { month: 'short' })}`

    const totalAtRisk = declines.reduce((sum, d) => sum + (d.monthly_rate || 0), 0)
    const repeatAtRisk = repeatDecliners.reduce((sum, d) => sum + (d.monthly_rate || 0), 0)

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/mindbody">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <AlertTriangle className="h-8 w-8 text-red-500" />
                        Decline Recovery
                    </h1>
                    <p className="text-muted-foreground">
                        Recover failed payments and protect your revenue
                    </p>
                </div>
            </div>

            {/* Month Selector */}
            <div className="flex items-center gap-4 bg-card rounded-lg p-3 border">
                <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <span className="font-semibold text-lg">{monthName}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
                    <ChevronRight className="h-5 w-5" />
                </Button>
                <Badge variant="secondary" className="ml-auto">
                    {dateRangeLabel}
                </Badge>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <div className="text-4xl font-bold text-red-600">
                                {formatCurrency(totalAtRisk)}
                            </div>
                            <p className="text-muted-foreground mt-1">At Risk This Month</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <div className="text-4xl font-bold text-orange-500">
                                {declines.length}
                            </div>
                            <p className="text-muted-foreground mt-1">Unique Members (This Month)</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-orange-500/30 bg-orange-500/5">
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <div className="text-4xl font-bold text-orange-600 flex items-center justify-center gap-2">
                                <RefreshCw className="h-6 w-6" />
                                {repeatDecliners.length}
                            </div>
                            <p className="text-muted-foreground mt-1">Repeat Decliners (Multi-Month)</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Repeat Decliners - Priority Section */}
            {repeatDecliners.length > 0 && (
                <Card className="border-orange-500/30">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-orange-600">
                            <RefreshCw className="h-5 w-5" />
                            Repeat Decliners - Priority Follow-up
                        </CardTitle>
                        <CardDescription>
                            Members who have declined in multiple months (last 6 months) - {formatCurrency(repeatAtRisk)}/mo at risk
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Member</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead className="text-right">Monthly Rate</TableHead>
                                    <TableHead className="text-center">Months</TableHead>
                                    <TableHead className="text-center">Total Declines</TableHead>
                                    <TableHead>Decline History</TableHead>
                                    <TableHead className="text-center">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {repeatDecliners.map((d) => (
                                    <TableRow key={d.clientId} className="bg-orange-500/5">
                                        <TableCell className="font-medium">{d.name}</TableCell>
                                        <TableCell className="text-muted-foreground">{d.email || '-'}</TableCell>
                                        <TableCell className="text-right font-bold text-red-600">
                                            {formatCurrency(d.monthly_rate)}/mo
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="destructive">
                                                {d.monthsWithDeclines} months
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {d.totalDeclineCount}x
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {d.declineMonths.slice(0, 3).join(', ')}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex justify-center">
                                                {d.email && (
                                                    <a href={`mailto:${d.email}?subject=Urgent: Payment Update Required`}>
                                                        <Button variant="outline" size="icon" className="h-8 w-8">
                                                            <Mail className="h-4 w-4" />
                                                        </Button>
                                                    </a>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* This Month's Declines */}
            <Card>
                <CardHeader>
                    <CardTitle>This Month's Declines</CardTitle>
                    <CardDescription>
                        Members with failed payments in {monthName} (excluding recovered)
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : declines.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-2xl font-bold text-green-600">No Outstanding Declines! 🎉</p>
                            <p className="text-muted-foreground mt-2">
                                All payments succeeded or recovered in this period.
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Member</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead className="text-right">Monthly Rate</TableHead>
                                    <TableHead className="text-center">Declines</TableHead>
                                    <TableHead>First Decline</TableHead>
                                    <TableHead className="text-center">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {declines.map((d) => (
                                    <TableRow key={d.clientId}>
                                        <TableCell className="font-medium">{d.name}</TableCell>
                                        <TableCell className="text-muted-foreground">{d.email || '-'}</TableCell>
                                        <TableCell className="text-right font-bold text-red-600">
                                            {formatCurrency(d.monthly_rate)}/mo
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="destructive">
                                                {d.declineCount}x
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {d.declineDate ? new Date(d.declineDate).toLocaleDateString() : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex justify-center">
                                                {d.email && (
                                                    <a href={`mailto:${d.email}?subject=Payment Update Required`}>
                                                        <Button variant="outline" size="icon" className="h-8 w-8">
                                                            <Mail className="h-4 w-4" />
                                                        </Button>
                                                    </a>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
