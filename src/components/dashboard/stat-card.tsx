import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LucideIcon } from "lucide-react"

interface StatCardProps {
    title: string
    value: string | number
    icon?: LucideIcon
    subtext?: string
    badgeText?: string
    status?: "success" | "warning" | "danger" | "neutral" | "info"
    valuePrefix?: string
    valueSuffix?: string
    onClick?: () => void
    className?: string
}

export function StatCard({
    title,
    value,
    icon: Icon,
    subtext,
    badgeText,
    status = "neutral",
    valuePrefix,
    valueSuffix,
    onClick,
    className
}: StatCardProps) {
    const statusStyles = {
        success: {
            text: "text-success",
            bg: "bg-success-subtle",
            icon: "text-success",
            badge: "bg-success-subtle text-success"
        },
        warning: {
            text: "text-warning",
            bg: "bg-warning-subtle",
            icon: "text-warning",
            badge: "bg-warning-subtle text-warning"
        },
        danger: {
            text: "text-destructive",
            bg: "bg-destructive/10",
            icon: "text-destructive",
            badge: "bg-destructive/10 text-destructive"
        },
        info: {
            text: "text-info",
            bg: "bg-info/10",
            icon: "text-info",
            badge: "bg-info/10 text-info"
        },
        neutral: {
            text: "text-foreground",
            bg: "bg-muted",
            icon: "text-muted-foreground",
            badge: "bg-muted text-muted-foreground"
        }
    }

    const styles = statusStyles[status]

    return (
        <Card
            className={`shadow-sm border-border transition-all hover:shadow-md ${onClick ? 'cursor-pointer hover:bg-muted/50' : ''} ${className || ''}`}
            onClick={onClick}
        >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    {title}
                </CardTitle>
                {Icon && (
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${styles.bg}`}>
                        <Icon className={`h-4 w-4 ${styles.icon}`} />
                    </div>
                )}
                {badgeText && !Icon && (
                    <Badge variant="secondary" className={`${styles.badge} border-none font-bold text-[10px]`}>
                        {badgeText}
                    </Badge>
                )}
            </CardHeader>
            <CardContent>
                <div className={`text-2xl font-black tabular-nums font-mono ${styles.text}`}>
                    {valuePrefix}{value}{valueSuffix}
                </div>
                {(subtext || (badgeText && Icon)) && (
                    <div className="flex items-center gap-2 mt-1">
                        {badgeText && Icon && (
                            <Badge variant="secondary" className={`${styles.badge} border-none font-bold text-[10px]`}>
                                {badgeText}
                            </Badge>
                        )}
                        {subtext && (
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">
                                {subtext}
                            </p>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
