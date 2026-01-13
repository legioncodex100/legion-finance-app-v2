import { createClient } from "@/lib/supabase/server"
import { ApprovalQueue } from "@/components/approval-queue"
import { RunRulesButton } from "@/components/run-rules-button"
import { getPendingCount, getPendingMatches } from "@/lib/actions/pending-matches"
import { Zap, RefreshCw } from "lucide-react"

export const dynamic = 'force-dynamic'

async function getCategories() {
    const supabase = await createClient()
    const { data } = await supabase
        .from('categories')
        .select('*')
        .order('name')
    return data || []
}

export default async function PendingApprovalsPage() {
    const categories = await getCategories()
    const pendingCount = await getPendingCount()
    const matches = await getPendingMatches()

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                        <Zap className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black">Pending Approvals</h1>
                        <p className="text-sm text-muted-foreground">
                            Review transactions matched by your reconciliation rules.
                        </p>
                    </div>
                </div>

                {pendingCount > 0 && (
                    <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-amber-500 text-white font-black text-sm flex items-center justify-center">
                            {pendingCount}
                        </div>
                        <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                            transactions are awaiting your approval
                        </span>
                    </div>
                )}
            </div>

            {/* Run Rules Button - for manual triggering */}
            <RunRulesButton />

            {/* Approval Queue */}
            <ApprovalQueue initialMatches={matches} categories={categories} />
        </div>
    )
}
