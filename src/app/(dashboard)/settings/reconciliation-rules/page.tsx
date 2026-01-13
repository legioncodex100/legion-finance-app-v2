import { createClient } from "@/lib/supabase/server"
import { RulesManagement } from "@/components/rules-management"
import { Settings, Zap } from "lucide-react"
import Link from "next/link"

export const dynamic = 'force-dynamic'

async function getVendors() {
    const supabase = await createClient()
    const { data } = await supabase
        .from('vendors')
        .select('id, name')
        .order('name')
    return data || []
}

async function getStaff() {
    const supabase = await createClient()
    const { data } = await supabase
        .from('staff')
        .select('id, name, role')
        .order('name')
    return data || []
}

async function getCategories() {
    const supabase = await createClient()
    const { data } = await supabase
        .from('categories')
        .select('*')
        .order('name')
    return data || []
}

export default async function ReconciliationRulesPage() {
    const [vendors, staff, categories] = await Promise.all([
        getVendors(),
        getStaff(),
        getCategories()
    ])

    return (
        <div className="p-6 max-w-5xl mx-auto">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
                <Link href="/settings" className="hover:text-foreground">Settings</Link>
                <span>/</span>
                <span className="text-foreground font-medium">Reconciliation Rules</span>
            </div>

            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Zap className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-black">Reconciliation Rules</h1>
                    <p className="text-sm text-muted-foreground">
                        Create rules to automatically categorize transactions. Matches require your approval.
                    </p>
                </div>
            </div>

            {/* Info Box */}
            <div className="mb-8 p-4 bg-slate-50 dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800">
                <h3 className="font-bold text-sm mb-2">How Rules Work</h3>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Define matching criteria (vendor, staff, description pattern, amount range)</li>
                    <li>Set the category to apply when a match is found</li>
                    <li>When transactions are imported, rules run and create <strong>pending matches</strong></li>
                    <li>Review and approve matches in the <Link href="/reconciliation/pending" className="text-indigo-600 hover:underline font-medium">Approval Queue</Link></li>
                </ol>
            </div>

            {/* Rules Management */}
            <RulesManagement vendors={vendors} staff={staff} categories={categories} />
        </div>
    )
}
