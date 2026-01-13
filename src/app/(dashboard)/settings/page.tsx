import { Zap, Shield, User, Bell, Database, Layers, Bot, RefreshCw, Bug } from "lucide-react"
import Link from "next/link"

export default function SettingsPage() {
    const settingSections = [
        {
            title: "AI Assistant",
            description: "Configure Aria AI model, temperature, and custom instructions.",
            icon: Bot,
            href: "/settings/ai",
            color: "text-violet-600",
            bgColor: "bg-violet-100 dark:bg-violet-900/30"
        },
        {
            title: "Sync Management",
            description: "View sync logs, trigger manual syncs, and configure webhooks.",
            icon: RefreshCw,
            href: "/settings/sync",
            color: "text-cyan-600",
            bgColor: "bg-cyan-100 dark:bg-cyan-900/30"
        },
        {
            title: "Debug Console",
            description: "Inspect raw API responses and database data for troubleshooting.",
            icon: Bug,
            href: "/settings/debug",
            color: "text-orange-500",
            bgColor: "bg-orange-100 dark:bg-orange-900/30"
        },
        {
            title: "Financial Classes",
            description: "Manage chart of accounts classifications (Revenue, COGS, Expense, Equity).",
            icon: Layers,
            href: "/settings/financial-classes",
            color: "text-indigo-600",
            bgColor: "bg-indigo-100 dark:bg-indigo-900/30"
        },
        {
            title: "Automation & Rules",
            description: "Manage reconciliation rules and transaction auto-categorization.",
            icon: Zap,
            href: "/settings/reconciliation-rules",
            color: "text-purple-600",
            bgColor: "bg-purple-100 dark:bg-purple-900/30"
        },
        {
            title: "Profile & Account",
            description: "Update your personal information and security settings.",
            icon: User,
            href: "/settings/profile",
            color: "text-blue-600",
            bgColor: "bg-blue-100 dark:bg-blue-900/30",
            disabled: true
        },
        {
            title: "Security",
            description: "Manage password, multi-factor authentication and active sessions.",
            icon: Shield,
            href: "/settings/security",
            color: "text-emerald-600",
            bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
            disabled: true
        },
        {
            title: "Notifications",
            description: "Choose how and when you want to be notified about activity.",
            icon: Bell,
            href: "/settings/notifications",
            color: "text-amber-600",
            bgColor: "bg-amber-100 dark:bg-amber-950/30",
            disabled: true
        },
        {
            title: "Data Management",
            description: "Export your financial data or manage your system resets.",
            icon: Database,
            href: "/settings/data",
            color: "text-rose-600",
            bgColor: "bg-rose-100 dark:bg-rose-950/30",
            disabled: true
        }
    ]

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-black tracking-tight">Settings</h1>
                <p className="text-muted-foreground mt-2">
                    Manage your preferences, automation rules, and account security.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {settingSections.map((section) => (
                    <Link
                        key={section.title}
                        href={section.disabled ? "#" : section.href}
                        className={`group relative p-6 rounded-2xl border transition-all duration-200 ${section.disabled
                            ? "opacity-60 cursor-not-allowed border-slate-100 dark:border-zinc-900"
                            : "hover:shadow-xl hover:-translate-y-1 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 hover:border-indigo-500/50"
                            }`}
                    >
                        <div className="flex items-start gap-4">
                            <div className={`p-3 rounded-xl ${section.bgColor} ${section.color}`}>
                                <section.icon className="h-6 w-6" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-lg group-hover:text-indigo-600 transition-colors">
                                    {section.title}
                                    {section.disabled && (
                                        <span className="ml-2 text-[10px] bg-slate-100 dark:bg-zinc-800 text-muted-foreground px-2 py-0.5 rounded uppercase tracking-wider font-black">
                                            Coming Soon
                                        </span>
                                    )}
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                                    {section.description}
                                </p>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>

            <div className="p-6 rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-black">?</div>
                    <div>
                        <h4 className="font-bold">Need help with these settings?</h4>
                        <p className="text-sm text-indigo-600/80 dark:text-indigo-400 font-medium cursor-pointer hover:underline">
                            View our documentation or contact support →
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
