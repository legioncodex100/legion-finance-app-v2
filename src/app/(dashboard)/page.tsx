"use client"

import * as React from "react"
import {
    ArrowDownRight,
    ArrowUpRight,
    Plus,
    Loader2,
    TrendingUp,
    TrendingDown,
    Users,
    DollarSign,
    AlertTriangle,
    UserMinus,
    Calendar,
    CheckCircle,
    Clock,
    FileText,
    RefreshCcw,
    ChevronRight,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { StatCard } from "@/components/dashboard/stat-card"
import { getInFlightCash } from "@/lib/actions/in-flight-cash"
import { getCurrentBankBalance } from "@/lib/actions/cash-flow"

interface DashboardStats {
    bankBalance: number
    thisMonthIncome: number
    thisMonthExpenses: number
    netPosition: number
    lastMonthNet: number
    activeMembers: number
    newMembersThisMonth: number
    monthlyMRR: number
    mrrChange: number
    declinesThisMonth: number
    atRiskMembers: number
    unreconciledCount: number
    billsDueThisWeek: number
    overdueInvoices: number
    lastSyncDays: number
    inFlightCash: number
    inFlightCount: number
}

interface UpcomingPayment {
    id: string
    name: string
    amount: number
    dueDate: string
    vendorName: string | null
}

interface RecentTransaction {
    id: string
    description: string
    amount: number
    type: string
    date: string
    category: string | null
    vendorName: string | null
}

interface ForecastWeek {
    weekNumber: number
    weekStart: string
    inflows: number
    outflows: number
    balance: number
}

export default function DashboardPage() {
    const [stats, setStats] = React.useState<DashboardStats>({
        bankBalance: 0,
        thisMonthIncome: 0,
        thisMonthExpenses: 0,
        netPosition: 0,
        lastMonthNet: 0,
        activeMembers: 0,
        newMembersThisMonth: 0,
        monthlyMRR: 0,
        mrrChange: 0,
        declinesThisMonth: 0,
        atRiskMembers: 0,
        unreconciledCount: 0,
        billsDueThisWeek: 0,
        overdueInvoices: 0,
        lastSyncDays: 0,
        inFlightCash: 0,
        inFlightCount: 0,
    })
    const [upcomingPayments, setUpcomingPayments] = React.useState<UpcomingPayment[]>([])
    const [recentTransactions, setRecentTransactions] = React.useState<RecentTransaction[]>([])
    const [forecast, setForecast] = React.useState<ForecastWeek[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const supabase = createClient()

    // Compute previous month name once to avoid hydration mismatch
    const previousMonthName = React.useMemo(() => {
        const now = new Date()
        return new Date(now.getFullYear(), now.getMonth() - 1, 1)
            .toLocaleString('default', { month: 'short' })
    }, [])

    React.useEffect(() => {
        fetchDashboardData()
    }, [])

    async function fetchDashboardData() {
        setIsLoading(true)
        const now = new Date()
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

        // Fetch this month's transactions
        const { data: thisMonthTx } = await supabase
            .from('transactions')
            .select('amount, type')
            .gte('transaction_date', thisMonthStart)

        const thisMonthIncome = thisMonthTx?.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0) || 0
        const thisMonthExpenses = thisMonthTx?.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(Number(t.amount)), 0) || 0

        // Fetch last month's transactions for comparison
        const { data: lastMonthTx } = await supabase
            .from('transactions')
            .select('amount, type')
            .gte('transaction_date', lastMonthStart)
            .lte('transaction_date', lastMonthEnd)

        const lastMonthIncome = lastMonthTx?.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0) || 0
        const lastMonthExpenses = lastMonthTx?.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(Number(t.amount)), 0) || 0

        // Fetch bank balance (uses live Starling balance if available, otherwise calculated)
        const bankBalance = await getCurrentBankBalance()

        // Fetch Mindbody member stats
        const { data: members } = await supabase
            .from('mb_members')
            .select('membership_status, monthly_rate, created_at, synced_at')
            .in('membership_status', ['Active', 'Declined'])

        const activeMembers = members?.filter(m => m.membership_status === 'Active').length || 0
        const monthlyMRR = members?.filter(m => m.membership_status === 'Active').reduce((s, m) => s + (m.monthly_rate || 0), 0) || 0
        // Filter declines to those synced this month (proxy for when status changed)
        const declinesThisMonth = members?.filter(m =>
            m.membership_status === 'Declined' &&
            m.synced_at && new Date(m.synced_at) >= new Date(thisMonthStart)
        ).length || 0

        // Fetch at-risk members (active but haven't visited in 35-45 days)
        const thirtyFiveDaysAgo = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        const fortyFiveDaysAgo = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        const { count: atRiskCount } = await supabase
            .from('mb_members')
            .select('id', { count: 'exact', head: true })
            .eq('membership_status', 'Active')
            .lt('last_visit_date', thirtyFiveDaysAgo)
            .gte('last_visit_date', fortyFiveDaysAgo)

        // Fetch unreconciled count
        const { count: unreconciledCount } = await supabase
            .from('transactions')
            .select('id', { count: 'exact', head: true })
            .is('category_id', null)
            .eq('confirmed', false)

        // Fetch bills due this week
        const { count: billsDueCount } = await supabase
            .from('payables')
            .select('id', { count: 'exact', head: true })
            .eq('is_template', false)
            .eq('is_paid', false)
            .lte('next_due', weekFromNow)

        // Fetch upcoming payments
        const { data: upcoming } = await supabase
            .from('payables')
            .select('id, name, amount, next_due, vendors(name)')
            .eq('is_template', false)
            .eq('is_paid', false)
            .not('next_due', 'is', null)
            .order('next_due')
            .limit(5)

        setUpcomingPayments(upcoming?.map(p => ({
            id: p.id,
            name: p.name,
            amount: Number(p.amount),
            dueDate: p.next_due,
            vendorName: (p.vendors as any)?.name || null
        })) || [])

        // Fetch recent transactions
        const { data: recent } = await supabase
            .from('transactions')
            .select('id, description, amount, type, transaction_date, categories(name), vendors(name)')
            .order('transaction_date', { ascending: false })
            .limit(5)

        setRecentTransactions(recent?.map(t => ({
            id: t.id,
            description: t.description,
            amount: Number(t.amount),
            type: t.type,
            date: t.transaction_date,
            category: (t.categories as any)?.name || null,
            vendorName: (t.vendors as any)?.name || null
        })) || [])

        // Build simple 4-week forecast
        const forecastWeeks: ForecastWeek[] = []
        let runningBalance = bankBalance

        for (let w = 0; w < 4; w++) {
            const weekStart = new Date(now)
            weekStart.setDate(now.getDate() + w * 7)

            // Simplified forecast - just use scheduled payments
            const weekEnd = new Date(weekStart)
            weekEnd.setDate(weekStart.getDate() + 6)

            const { data: weekPayables } = await supabase
                .from('payables')
                .select('amount')
                .eq('is_template', false)
                .eq('is_paid', false)
                .gte('next_due', weekStart.toISOString().split('T')[0])
                .lte('next_due', weekEnd.toISOString().split('T')[0])

            const { data: weekScheduled } = await supabase
                .from('scheduled_payments')
                .select('amount')
                .eq('payment_status', 'scheduled')
                .gte('scheduled_date', weekStart.toISOString().split('T')[0])
                .lte('scheduled_date', weekEnd.toISOString().split('T')[0])

            const inflows = weekScheduled?.reduce((s, p) => s + Number(p.amount), 0) || 0
            const outflows = weekPayables?.reduce((s, p) => s + Number(p.amount), 0) || 0
            runningBalance += inflows - outflows

            forecastWeeks.push({
                weekNumber: w + 1,
                weekStart: weekStart.toISOString().split('T')[0],
                inflows,
                outflows,
                balance: runningBalance
            })
        }
        setForecast(forecastWeeks)

        // Fetch in-flight cash (money collected but not yet deposited)
        const inFlight = await getInFlightCash()

        setStats({
            bankBalance,
            thisMonthIncome,
            thisMonthExpenses,
            netPosition: thisMonthIncome - thisMonthExpenses,
            lastMonthNet: lastMonthIncome - lastMonthExpenses,
            activeMembers,
            newMembersThisMonth: 0, // Would need created_at filtering
            monthlyMRR,
            mrrChange: 0,
            declinesThisMonth,
            atRiskMembers: atRiskCount || 0,
            unreconciledCount: unreconciledCount || 0,
            billsDueThisWeek: billsDueCount || 0,
            overdueInvoices: 0,
            lastSyncDays: 0,
            inFlightCash: inFlight?.inFlight || 0,
            inFlightCount: 0, // Not tracking count anymore
        })

        setIsLoading(false)
    }

    const formatCurrency = (amount: number) => {
        return Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    }

    if (isLoading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    const minBalance = Math.min(...forecast.map(f => f.balance), stats.bankBalance)
    const maxBalance = Math.max(...forecast.map(f => f.balance), stats.bankBalance)
    const dangerThreshold = 2000

    return (
        <div className="flex flex-col gap-4 md:gap-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
                    <p className="text-muted-foreground">Welcome back. Here's your business at a glance.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={fetchDashboardData}>
                        <RefreshCcw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                    <Link href="/transactions">
                        <Button className="h-9 gap-2 bg-black hover:bg-zinc-800 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200">
                            <Plus className="h-4 w-4" /> Import Transactions
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Row 1: Financial Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Bank Balance"
                    value={formatCurrency(stats.bankBalance)}
                    valuePrefix="£"
                    badgeText="LIVE"
                    status={stats.bankBalance >= 0 ? "neutral" : "danger"}
                    subtext="All Accounts Total"
                />

                <StatCard
                    title="This Month Income"
                    value={formatCurrency(stats.thisMonthIncome)}
                    valuePrefix="+£"
                    icon={ArrowUpRight}
                    status="success"
                    subtext={`vs ${previousMonthName}`}
                />

                <StatCard
                    title="This Month Expenses"
                    value={formatCurrency(stats.thisMonthExpenses)}
                    valuePrefix="-£"
                    icon={ArrowDownRight}
                    status="danger"
                    subtext={`vs ${previousMonthName}`}
                />

                <StatCard
                    title="Net Position"
                    value={formatCurrency(Math.abs(stats.netPosition))}
                    valuePrefix={stats.netPosition >= 0 ? "+£" : "-£"}
                    icon={stats.netPosition >= 0 ? TrendingUp : TrendingDown}
                    status={stats.netPosition >= 0 ? "success" : "danger"}
                    subtext="This month so far"
                />

                <StatCard
                    title="In-Flight Cash"
                    value={formatCurrency(stats.inFlightCash)}
                    valuePrefix="£"
                    icon={Clock}
                    status="info"
                    subtext="Collected but not deposited"
                />
            </div>

            {/* Row 2: Member Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Active Members"
                    value={stats.activeMembers}
                    icon={Users}
                    status="info"
                    badgeText={stats.newMembersThisMonth > 0 ? `+${stats.newMembersThisMonth} new` : undefined}
                />

                <StatCard
                    title="Monthly MRR"
                    value={formatCurrency(stats.monthlyMRR)}
                    valuePrefix="£"
                    icon={DollarSign}
                    status="success"
                    subtext="Recurring Revenue"
                />

                <StatCard
                    title="Declines This Mo"
                    value={stats.declinesThisMonth}
                    icon={AlertTriangle}
                    status={stats.declinesThisMonth > 0 ? "warning" : "neutral"}
                    badgeText={stats.declinesThisMonth > 0 ? "Action needed" : undefined}
                />

                <StatCard
                    title="At Risk Churn"
                    value={stats.atRiskMembers}
                    icon={UserMinus}
                    status="neutral"
                    subtext="35-45 day inactive"
                />
            </div>

            {/* Row 3: Chart + Actions */}
            <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4 shadow-sm border-slate-200 dark:border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-xl font-bold">4-Week Cash Flow Forecast</CardTitle>
                        <CardDescription>Projected balance based on scheduled payments</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[200px] flex items-end gap-2 relative pt-4">
                            {/* Danger threshold line */}
                            <div
                                className="absolute left-0 right-0 border-t-2 border-dashed border-red-400 opacity-50"
                                style={{
                                    bottom: `${((dangerThreshold - minBalance) / (maxBalance - minBalance)) * 100}%`
                                }}
                            >
                                <span className="absolute -top-4 right-0 text-[10px] text-red-400">Danger: £{dangerThreshold}</span>
                            </div>

                            {forecast.map((week, i) => {
                                const height = ((week.balance - minBalance) / (maxBalance - minBalance)) * 100
                                const isDanger = week.balance < dangerThreshold
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                        <div className="w-full flex gap-0.5 items-end h-[160px]">
                                            {/* Inflow bar */}
                                            <div
                                                className="flex-1 bg-emerald-500 rounded-t"
                                                style={{ height: `${(week.inflows / Math.max(...forecast.map(f => f.inflows + f.outflows), 1)) * 100}%` }}
                                                title={`Inflows: £${week.inflows}`}
                                            />
                                            {/* Outflow bar */}
                                            <div
                                                className="flex-1 bg-red-500 rounded-t"
                                                style={{ height: `${(week.outflows / Math.max(...forecast.map(f => f.inflows + f.outflows), 1)) * 100}%` }}
                                                title={`Outflows: £${week.outflows}`}
                                            />
                                        </div>
                                        <div className={`text-xs font-bold ${isDanger ? 'text-red-600' : ''}`}>
                                            £{formatCurrency(week.balance)}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">W{week.weekNumber}</div>
                                    </div>
                                )
                            })}
                        </div>
                        <div className="flex gap-4 mt-4 justify-center text-[10px]">
                            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-500 rounded" /> Inflows</div>
                            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded" /> Outflows</div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-3 shadow-sm border-slate-200 dark:border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-xl font-bold">Actions Needed</CardTitle>
                        <CardDescription>Items requiring your attention</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {stats.unreconciledCount > 0 && (
                            <Link href="/transactions" className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                                <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                                    <CheckCircle className="h-4 w-4 text-amber-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold">{stats.unreconciledCount} transactions to review</p>
                                    <p className="text-[10px] text-muted-foreground">Uncategorized transactions</p>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </Link>
                        )}

                        {stats.billsDueThisWeek > 0 && (
                            <Link href="/accounts-payable" className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                                <div className="h-8 w-8 rounded-full bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center">
                                    <Calendar className="h-4 w-4 text-rose-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold">{stats.billsDueThisWeek} bills due this week</p>
                                    <p className="text-[10px] text-muted-foreground">Accounts payable</p>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </Link>
                        )}

                        {stats.declinesThisMonth > 0 && (
                            <Link href="/mindbody" className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                                <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold">Follow up with {stats.declinesThisMonth} declined members</p>
                                    <p className="text-[10px] text-muted-foreground">Payment recovery</p>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </Link>
                        )}

                        {stats.unreconciledCount === 0 && stats.billsDueThisWeek === 0 && stats.declinesThisMonth === 0 && (
                            <div className="flex items-center gap-3 p-3">
                                <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-emerald-600">All caught up!</p>
                                    <p className="text-[10px] text-muted-foreground">No pending actions</p>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Row 4: Tables */}
            <div className="grid gap-4 md:gap-6 md:grid-cols-2">
                <Card className="shadow-sm border-slate-200 dark:border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold">Upcoming Payments</CardTitle>
                        <CardDescription>Bills due soon</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {upcomingPayments.length === 0 ? (
                            <div className="p-6 text-center text-muted-foreground text-sm">No upcoming payments</div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-zinc-900">
                                {upcomingPayments.map((payment) => (
                                    <div key={payment.id} className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                                        <div>
                                            <p className="text-sm font-semibold">{payment.vendorName || payment.name}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase">
                                                {new Date(payment.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </p>
                                        </div>
                                        <div className="text-sm font-black tabular-nums font-mono text-red-600">
                                            -£{formatCurrency(payment.amount)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <Link href="/accounts-payable" className="block p-4 border-t border-slate-100 dark:border-zinc-900">
                            <Button variant="outline" size="sm" className="w-full">
                                View All Payables
                            </Button>
                        </Link>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200 dark:border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold">Latest Transactions</CardTitle>
                        <CardDescription>Recent account activity</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {recentTransactions.length === 0 ? (
                            <div className="p-6 text-center text-muted-foreground text-sm">No transactions yet</div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-zinc-900">
                                {recentTransactions.map((tx) => (
                                    <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                                        <div className="flex items-center gap-3">
                                            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${tx.type === 'income' ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-rose-50 dark:bg-rose-950/40'}`}>
                                                {tx.type === 'income' ? <ArrowUpRight className="h-4 w-4 text-emerald-600" /> : <ArrowDownRight className="h-4 w-4 text-rose-600" />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold">{tx.vendorName || tx.description.substring(0, 25)}</p>
                                                <p className="text-[10px] text-muted-foreground uppercase">
                                                    {tx.category || 'Uncategorized'} • {new Date(tx.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                </p>
                                            </div>
                                        </div>
                                        <div className={`text-sm font-black tabular-nums font-mono ${tx.type === 'income' ? 'text-emerald-600' : ''}`}>
                                            {tx.type === 'income' ? '+' : '-'}£{formatCurrency(Math.abs(tx.amount))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <Link href="/transactions" className="block p-4 border-t border-slate-100 dark:border-zinc-900">
                            <Button variant="outline" size="sm" className="w-full">
                                View All Transactions
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
