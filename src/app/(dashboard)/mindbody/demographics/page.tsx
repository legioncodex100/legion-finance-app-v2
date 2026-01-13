"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Users,
    MapPin,
    Calendar,
    Loader2,
    ArrowLeft,
    UserCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { getMemberDemographics, DemographicsData } from "@/lib/actions/mindbody-demographics"
import { toast } from "sonner"

export default function DemographicsPage() {
    const [data, setData] = React.useState<DemographicsData | null>(null)
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        async function load() {
            try {
                const demographics = await getMemberDemographics()
                setData(demographics)
            } catch (error) {
                toast.error("Failed to load demographics")
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!data) return null

    const getBarWidth = (count: number, max: number) => {
        return `${Math.round((count / max) * 100)}%`
    }

    const maxAge = Math.max(...data.age_brackets.map(a => a.count))
    const maxGender = Math.max(...data.gender_breakdown.map(g => g.count))
    const maxLocation = data.top_locations[0]?.count || 1

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
                        <Users className="h-8 w-8 text-blue-500" />
                        Member Demographics
                    </h1>
                    <p className="text-muted-foreground">
                        Insights for marketing and engagement
                    </p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <div className="text-4xl font-bold text-blue-600">
                                {data.total_members.toLocaleString()}
                            </div>
                            <p className="text-muted-foreground mt-1">Total Members</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <div className="text-4xl font-bold text-green-600">
                                {Math.round((data.data_completeness.have_dob / data.total_members) * 100)}%
                            </div>
                            <p className="text-muted-foreground mt-1">Have DOB</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <div className="text-4xl font-bold text-purple-600">
                                {Math.round((data.data_completeness.have_gender / data.total_members) * 100)}%
                            </div>
                            <p className="text-muted-foreground mt-1">Have Gender</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <div className="text-4xl font-bold text-orange-600">
                                {Math.round((data.data_completeness.have_address / data.total_members) * 100)}%
                            </div>
                            <p className="text-muted-foreground mt-1">Have Address</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gender Breakdown */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <UserCircle className="h-5 w-5 text-purple-500" />
                            Gender Breakdown
                        </CardTitle>
                        <CardDescription>Member distribution by gender</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {data.gender_breakdown.map((g) => (
                            <div key={g.gender} className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium">{g.gender}</span>
                                    <span className="text-muted-foreground">
                                        {g.count.toLocaleString()} ({Math.round((g.count / data.total_members) * 100)}%)
                                    </span>
                                </div>
                                <div className="h-3 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${g.gender === 'Male' ? 'bg-blue-500' :
                                                g.gender === 'Female' ? 'bg-pink-500' :
                                                    'bg-gray-400'
                                            }`}
                                        style={{ width: getBarWidth(g.count, maxGender) }}
                                    />
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Age Distribution */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-green-500" />
                            Age Distribution
                        </CardTitle>
                        <CardDescription>Member distribution by age group</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {data.age_brackets.map((a) => (
                            <div key={a.bracket} className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium">{a.bracket}</span>
                                    <span className="text-muted-foreground">
                                        {a.count.toLocaleString()} ({Math.round((a.count / data.total_members) * 100)}%)
                                    </span>
                                </div>
                                <div className="h-3 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-green-500 rounded-full"
                                        style={{ width: getBarWidth(a.count, maxAge) }}
                                    />
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>

            {/* Top Locations */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-orange-500" />
                        Top 10 Postcodes
                    </CardTitle>
                    <CardDescription>Where your members live - for geo-targeted marketing</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {data.top_locations.map((loc, i) => (
                            <div key={loc.postal_code} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                                <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">
                                    {i + 1}
                                </Badge>
                                <div className="flex-1">
                                    <p className="font-mono font-medium">{loc.postal_code}</p>
                                    <p className="text-sm text-muted-foreground">{loc.city}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold">{loc.count}</p>
                                    <p className="text-xs text-muted-foreground">members</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
