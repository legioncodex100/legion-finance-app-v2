import { FinancialClassesList } from "@/components/financial-classes-list"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function FinancialClassesPage() {
    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/settings" className="text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div>
                    <h1 className="text-3xl font-black tracking-tight">Financial Classes</h1>
                    <p className="text-muted-foreground">Manage your chart of accounts classifications.</p>
                </div>
            </div>

            <FinancialClassesList />
        </div>
    )
}
