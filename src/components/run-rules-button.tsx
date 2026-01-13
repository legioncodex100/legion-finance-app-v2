"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Zap, RefreshCcw } from "lucide-react"
import { runRulesEngine } from "@/lib/actions/rules"
import { useRouter } from "next/navigation"

export function RunRulesButton() {
    const [loading, setLoading] = React.useState(false)
    const [includeConfirmed, setIncludeConfirmed] = React.useState(false)
    const router = useRouter()

    const handleRun = async () => {
        setLoading(true)
        try {
            const result = await runRulesEngine({ includeConfirmed })
            if (result.matched > 0) {
                let message = `✅ Found ${result.matched} matches from ${result.processed} transactions.`
                if (result.alreadyReconciled > 0) {
                    message += `\n⚠️ ${result.alreadyReconciled} were already reconciled.`
                }
                message += `\n\nReview them below!`
                alert(message)
            } else if (result.processed > 0) {
                alert(`No matches found. Processed ${result.processed} transactions.`)
            } else {
                alert(`No transactions to process.${!includeConfirmed ? ' Try enabling "Include Confirmed" to re-run on all transactions.' : ''}`)
            }
            router.refresh()
        } catch (e) {
            console.error(e)
            alert(`Error running rules: ${e}`)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex items-center gap-3 mb-6">
            <Button
                onClick={handleRun}
                disabled={loading}
                variant="outline"
                className="gap-2 border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/10 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold h-11"
            >
                {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <Zap className="h-4 w-4" />
                )}
                {loading ? "Processing..." : "Run Reconciliation Rules"}
            </Button>

            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                    type="checkbox"
                    checked={includeConfirmed}
                    onChange={(e) => setIncludeConfirmed(e.target.checked)}
                    className="rounded cursor-pointer"
                />
                <span className="text-muted-foreground font-medium">
                    Include confirmed
                </span>
                {includeConfirmed && (
                    <RefreshCcw className="h-3 w-3 text-amber-500" />
                )}
            </label>
        </div>
    )
}
