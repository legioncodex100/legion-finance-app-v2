"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Users,
    TrendingDown,
    Calendar,
    Mail,
    Phone,
    Loader2,
    ArrowLeft
} from "lucide-react"
import Link from "next/link"
import { getAtRiskMembers } from "@/lib/actions/mindbody-bi"
import { MBMember, getChurnRiskTier, getChurnRiskColor } from "@/lib/integrations/mindbody/bi-types"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"

export default function ChurnRiskPage() {
    const [members, setMembers] = React.useState<MBMember[]>([])
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        async function load() {
            try {
                const data = await getAtRiskMembers(50)
                setMembers(data)
            } catch (error) {
                toast.error("Failed to load members")
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    const totalAtRisk = members.reduce((sum, m) => sum + (m.monthly_rate || 0), 0)
    const criticalCount = members.filter(m => m.churn_risk >= 76).length
    const highCount = members.filter(m => m.churn_risk >= 51 && m.churn_risk < 76).length

    const getRiskBadge = (score: number) => {
        const tier = getChurnRiskTier(score)
        const colors = {
            critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
            high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
            medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
            low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        }
        return (
            <Badge className={colors[tier]}>
                {tier.toUpperCase()} ({score}%)
            </Badge>
        )
    }

    const daysSince = (dateStr: string | null) => {
        if (!dateStr) return null
        const days = Math.floor(
            (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
        )
        return days
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/mindbody">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <TrendingDown className="h-8 w-8 text-orange-500" />
                        Churn Risk Analysis
                    </h1>
                    <p className="text-muted-foreground">
                        Members at risk of canceling - sorted by value
                    </p>
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <div className="text-4xl font-bold text-orange-600">
                                {formatCurrency(totalAtRisk)}
                            </div>
                            <p className="text-muted-foreground mt-1">Monthly Revenue at Risk</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <div className="text-4xl font-bold text-red-600">
                                {criticalCount}
                            </div>
                            <p className="text-muted-foreground mt-1">Critical Risk</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <div className="text-4xl font-bold text-orange-500">
                                {highCount}
                            </div>
                            <p className="text-muted-foreground mt-1">High Risk</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Risk Factors Legend */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm">How Risk is Calculated</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-4 text-sm">
                        <span className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-red-500"></span>
                            No visit in 14+ days (+30-50pts)
                        </span>
                        <span className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                            Declining visits (+20pts)
                        </span>
                        <span className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                            Contract expiring (+25pts)
                        </span>
                        <span className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                            Payment declined (+40pts)
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Member List */}
            {members.length === 0 ? (
                <Card>
                    <CardContent className="py-16 text-center">
                        <Users className="h-16 w-16 text-green-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold">No High-Risk Members!</h2>
                        <p className="text-muted-foreground mt-2">
                            Your members are engaged and active.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {members.map((member) => {
                        const lastVisitDays = daysSince(member.last_visit_date)

                        return (
                            <Card key={member.id} className={
                                member.churn_risk >= 76
                                    ? 'border-red-200 dark:border-red-900'
                                    : member.churn_risk >= 51
                                        ? 'border-orange-200 dark:border-orange-900'
                                        : ''
                            }>
                                <CardContent className="py-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3">
                                                <h3 className="font-semibold text-lg">
                                                    {member.first_name} {member.last_name}
                                                </h3>
                                                {getRiskBadge(member.churn_risk)}
                                            </div>
                                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                                {member.email && (
                                                    <span className="flex items-center gap-1">
                                                        <Mail className="h-3 w-3" />
                                                        {member.email}
                                                    </span>
                                                )}
                                                {member.phone && (
                                                    <span className="flex items-center gap-1">
                                                        <Phone className="h-3 w-3" />
                                                        {member.phone}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="text-right space-y-1">
                                            <div className="text-xl font-bold">
                                                {formatCurrency(member.monthly_rate)}/mo
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {member.membership_name}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Risk Factors */}
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        {lastVisitDays !== null && lastVisitDays > 14 && (
                                            <Badge variant="outline" className="text-red-600 border-red-300">
                                                <Calendar className="h-3 w-3 mr-1" />
                                                No visit in {lastVisitDays} days
                                            </Badge>
                                        )}
                                        {member.membership_status === 'Declined' && (
                                            <Badge variant="outline" className="text-purple-600 border-purple-300">
                                                Payment declined
                                            </Badge>
                                        )}
                                        {member.visits_30d < (member.visits_prev_30d || 0) * 0.7 && member.visits_prev_30d > 0 && (
                                            <Badge variant="outline" className="text-orange-600 border-orange-300">
                                                Visits down {Math.round((1 - member.visits_30d / member.visits_prev_30d) * 100)}%
                                            </Badge>
                                        )}
                                        {member.contract_end_date && daysSince(member.contract_end_date) && daysSince(member.contract_end_date)! < 0 && daysSince(member.contract_end_date)! > -30 && (
                                            <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                                                Contract ends in {Math.abs(daysSince(member.contract_end_date)!)} days
                                            </Badge>
                                        )}
                                    </div>

                                    {/* Quick Actions */}
                                    <div className="flex gap-2 mt-3">
                                        {member.phone && (
                                            <a href={`tel:${member.phone}`}>
                                                <Button size="sm" variant="outline">
                                                    <Phone className="h-4 w-4 mr-2" />
                                                    Call
                                                </Button>
                                            </a>
                                        )}
                                        {member.email && (
                                            <a href={`mailto:${member.email}?subject=We miss you at Legion!`}>
                                                <Button size="sm" variant="outline">
                                                    <Mail className="h-4 w-4 mr-2" />
                                                    Email
                                                </Button>
                                            </a>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
