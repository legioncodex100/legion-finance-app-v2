"use client"

import * as React from "react"
import { Plus, Loader2, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StaffList } from "@/components/staff-list"

export default function StaffPage() {
    const [invoices, setInvoices] = React.useState<any[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const supabase = createClient()

    React.useEffect(() => {
        async function fetchCoachInvoices() {
            setIsLoading(true)
            const { data } = await supabase
                .from('coach_invoices')
                .select('*, staff(name)')
                .order('due_date', { ascending: true })
            if (data) setInvoices(data)
            setIsLoading(false)
        }
        fetchCoachInvoices()
    }, [supabase])

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Staff & Coaches</h1>
                <p className="text-muted-foreground">Manage your academy team and track their monthly payments.</p>
            </div>

            <Tabs defaultValue="team" className="w-full">
                <TabsList className="grid w-full max-w-[400px] grid-cols-2">
                    <TabsTrigger value="team" className="gap-2">Team Management</TabsTrigger>
                    <TabsTrigger value="invoices" className="gap-2">Monthly Invoices</TabsTrigger>
                </TabsList>

                <TabsContent value="team" className="mt-6">
                    <StaffList />
                </TabsContent>

                <TabsContent value="invoices" className="mt-6 flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold">Coach Invoices</h2>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" /> Log New Invoice
                        </Button>
                    </div>

                    {isLoading ? (
                        <div className="flex h-32 items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : invoices.length === 0 ? (
                        <Card className="p-12 text-center border-dashed">
                            <p className="text-muted-foreground italic text-sm">No coach invoices logged yet.</p>
                        </Card>
                    ) : (
                        <div className="grid gap-6 md:grid-cols-2">
                            {invoices.map((inv) => (
                                <Card key={inv.id} className="shadow-sm hover:border-slate-300 transition-all">
                                    <CardHeader className="flex flex-row items-center gap-4 p-6">
                                        <div className="h-12 w-12 rounded-xl bg-slate-100 dark:bg-zinc-900 flex items-center justify-center">
                                            <FileText className="h-6 w-6 text-slate-600 dark:text-zinc-400" />
                                        </div>
                                        <div className="flex flex-col">
                                            <CardTitle className="text-lg">{inv.staff?.name || 'Unknown'}</CardTitle>
                                            <CardDescription className="text-[10px] uppercase tracking-widest">
                                                Invoice #{inv.invoice_number || 'N/A'}
                                            </CardDescription>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-6 border-t flex justify-between items-center">
                                        <div>
                                            <span className="text-[10px] uppercase text-muted-foreground block">Amount</span>
                                            <span className="text-xl font-black">£{parseFloat(inv.amount).toFixed(2)}</span>
                                        </div>
                                        <div className="text-right">
                                            <Badge className={inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                                                {inv.status}
                                            </Badge>
                                            <span className="text-[10px] text-muted-foreground block mt-1">
                                                Due: {new Date(inv.due_date).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}
