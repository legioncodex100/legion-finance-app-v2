"use client"

import { useState, useEffect, useCallback } from "react"
import {
    Users, Search, Filter, RefreshCw, ChevronUp, ChevronDown,
    Mail, Phone, Calendar, CreditCard, X, FileText, Clock
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { formatCurrency } from "@/lib/utils"
import {
    getMembers, getMember, getMemberTransactions,
    getMemberStats, updateMemberNotes,
    type Member, type MemberFilters
} from "@/lib/actions/members"

// ============================================
// STATUS BADGE COMPONENT
// ============================================
function StatusBadge({ status }: { status: string | null }) {
    const variants: Record<string, string> = {
        "Active": "bg-emerald-500/20 text-emerald-400",
        "Declined": "bg-rose-500/20 text-rose-400",
        "Suspended": "bg-amber-500/20 text-amber-400",
        "Terminated": "bg-zinc-500/20 text-zinc-400",
        "Expired": "bg-zinc-500/20 text-zinc-400",
        "New": "bg-sky-500/20 text-sky-400",
    }

    return (
        <Badge className={variants[status || ""] || "bg-zinc-500/20 text-zinc-400"}>
            {status || "Unknown"}
        </Badge>
    )
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================
export default function MembersPage() {
    // State
    const [members, setMembers] = useState<Member[]>([])
    const [stats, setStats] = useState({ total: 0, active: 0, declined: 0, suspended: 0, terminated: 0 })
    const [isLoading, setIsLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [sortColumn, setSortColumn] = useState<string>("first_name")
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

    // Profile modal state
    const [selectedMember, setSelectedMember] = useState<Member | null>(null)
    const [memberTransactions, setMemberTransactions] = useState<any[]>([])
    const [isProfileOpen, setIsProfileOpen] = useState(false)
    const [notes, setNotes] = useState("")
    const [isSavingNotes, setIsSavingNotes] = useState(false)

    // Fetch members
    const fetchMembers = useCallback(async () => {
        setIsLoading(true)
        try {
            const filters: MemberFilters = {
                search: search || undefined,
                status: statusFilter !== "all" ? statusFilter : undefined
            }
            const { members: data } = await getMembers(filters, 5000, 0)
            setMembers(data)

            // Also fetch stats
            const statsData = await getMemberStats()
            setStats(statsData)
        } catch (error) {
            console.error("Failed to fetch members:", error)
        } finally {
            setIsLoading(false)
        }
    }, [search, statusFilter])

    useEffect(() => {
        fetchMembers()
    }, [fetchMembers])

    // Open profile modal
    const openProfile = async (member: Member) => {
        setSelectedMember(member)
        setNotes(member.notes || "")
        setIsProfileOpen(true)

        // Fetch transactions
        try {
            const { transactions } = await getMemberTransactions(member.mb_client_id, 20)
            setMemberTransactions(transactions)
        } catch (error) {
            console.error("Failed to fetch transactions:", error)
        }
    }

    // Save notes
    const saveNotes = async () => {
        if (!selectedMember) return
        setIsSavingNotes(true)
        try {
            await updateMemberNotes(selectedMember.mb_client_id, notes)
            setSelectedMember({ ...selectedMember, notes })
        } catch (error) {
            console.error("Failed to save notes:", error)
        } finally {
            setIsSavingNotes(false)
        }
    }

    // Sort members
    const sortedMembers = [...members].sort((a, b) => {
        let aVal: any = a[sortColumn as keyof Member]
        let bVal: any = b[sortColumn as keyof Member]

        if (aVal === null) aVal = ""
        if (bVal === null) bVal = ""

        if (typeof aVal === "string") aVal = aVal.toLowerCase()
        if (typeof bVal === "string") bVal = bVal.toLowerCase()

        if (sortDirection === "asc") {
            return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
        } else {
            return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
        }
    })

    // Toggle sort
    const toggleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(d => d === "asc" ? "desc" : "asc")
        } else {
            setSortColumn(column)
            setSortDirection("asc")
        }
    }

    const SortIcon = ({ column }: { column: string }) => {
        if (sortColumn !== column) return null
        return sortDirection === "asc"
            ? <ChevronUp className="h-4 w-4 inline ml-1" />
            : <ChevronDown className="h-4 w-4 inline ml-1" />
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Users className="h-8 w-8 text-sky-400" />
                    <div>
                        <h1 className="text-2xl font-bold">Members</h1>
                        <p className="text-sm text-zinc-500">
                            {stats.total} total • {stats.active} active • {stats.declined} declined
                        </p>
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={fetchMembers} disabled={isLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="text-3xl font-bold text-emerald-400">{stats.active}</div>
                    <div className="text-sm text-zinc-500">Active</div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="text-3xl font-bold text-rose-400">{stats.declined}</div>
                    <div className="text-sm text-zinc-500">Declined</div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="text-3xl font-bold text-amber-400">{stats.suspended}</div>
                    <div className="text-sm text-zinc-500">Suspended</div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="text-3xl font-bold text-zinc-400">{stats.terminated}</div>
                    <div className="text-sm text-zinc-500">Terminated</div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input
                        placeholder="Search by name or email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full md:w-48">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Declined">Declined</SelectItem>
                        <SelectItem value="Suspended">Suspended</SelectItem>
                        <SelectItem value="Terminated">Terminated</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Members Table */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="border-zinc-800 hover:bg-transparent">
                            <TableHead
                                className="text-zinc-400 cursor-pointer"
                                onClick={() => toggleSort("first_name")}
                            >
                                Name <SortIcon column="first_name" />
                            </TableHead>
                            <TableHead className="text-zinc-400 hidden md:table-cell">Email</TableHead>
                            <TableHead
                                className="text-zinc-400 cursor-pointer"
                                onClick={() => toggleSort("membership_status")}
                            >
                                Status <SortIcon column="membership_status" />
                            </TableHead>
                            <TableHead
                                className="text-zinc-400 cursor-pointer hidden lg:table-cell"
                                onClick={() => toggleSort("membership_name")}
                            >
                                Membership <SortIcon column="membership_name" />
                            </TableHead>
                            <TableHead
                                className="text-zinc-400 text-right cursor-pointer"
                                onClick={() => toggleSort("monthly_rate")}
                            >
                                Rate <SortIcon column="monthly_rate" />
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-12 text-zinc-500">
                                    Loading members...
                                </TableCell>
                            </TableRow>
                        ) : sortedMembers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-12 text-zinc-500">
                                    No members found
                                </TableCell>
                            </TableRow>
                        ) : (
                            sortedMembers.map((member) => (
                                <TableRow
                                    key={member.id || member.mb_client_id}
                                    className="border-zinc-800 hover:bg-zinc-800/50 cursor-pointer"
                                    onClick={() => openProfile(member)}
                                >
                                    <TableCell className="font-medium">
                                        {member.first_name || ""} {member.last_name || ""}
                                        {member.is_merged && (
                                            <span className="ml-2 text-xs text-zinc-500">(merged)</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-zinc-400 hidden md:table-cell">
                                        {member.email || "-"}
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge status={member.membership_status} />
                                    </TableCell>
                                    <TableCell className="text-zinc-400 hidden lg:table-cell">
                                        {member.membership_name || "-"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {member.monthly_rate > 0
                                            ? formatCurrency(member.monthly_rate)
                                            : "-"}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Profile Modal */}
            <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-zinc-800 flex items-center justify-center text-xl font-bold">
                                {selectedMember?.first_name?.[0] || "?"}{selectedMember?.last_name?.[0] || ""}
                            </div>
                            <div>
                                <div className="text-xl">
                                    {selectedMember?.first_name} {selectedMember?.last_name}
                                </div>
                                <div className="text-sm text-zinc-500 font-normal">
                                    Member since {selectedMember?.join_date
                                        ? new Date(selectedMember.join_date).toLocaleDateString("en-GB")
                                        : "Unknown"}
                                </div>
                            </div>
                        </DialogTitle>
                    </DialogHeader>

                    {selectedMember && (
                        <div className="space-y-6 mt-4">
                            {/* Status & Rate */}
                            <div className="flex items-center gap-4">
                                <StatusBadge status={selectedMember.membership_status} />
                                {selectedMember.monthly_rate > 0 && (
                                    <span className="text-lg font-semibold">
                                        {formatCurrency(selectedMember.monthly_rate)}/month
                                    </span>
                                )}
                                {selectedMember.membership_name && (
                                    <span className="text-zinc-500">
                                        {selectedMember.membership_name}
                                    </span>
                                )}
                            </div>

                            {/* Contact Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {selectedMember.email && (
                                    <div className="flex items-center gap-2 text-zinc-400">
                                        <Mail className="h-4 w-4" />
                                        <a href={`mailto:${selectedMember.email}`} className="hover:text-white">
                                            {selectedMember.email}
                                        </a>
                                    </div>
                                )}
                                {(selectedMember.phone || selectedMember.mobile_phone) && (
                                    <div className="flex items-center gap-2 text-zinc-400">
                                        <Phone className="h-4 w-4" />
                                        <a href={`tel:${selectedMember.mobile_phone || selectedMember.phone}`} className="hover:text-white">
                                            {selectedMember.mobile_phone || selectedMember.phone}
                                        </a>
                                    </div>
                                )}
                                {selectedMember.birth_date && (
                                    <div className="flex items-center gap-2 text-zinc-400">
                                        <Calendar className="h-4 w-4" />
                                        {new Date(selectedMember.birth_date).toLocaleDateString("en-GB")}
                                        {selectedMember.gender && ` • ${selectedMember.gender}`}
                                    </div>
                                )}
                                {selectedMember.next_payment_date && (
                                    <div className="flex items-center gap-2 text-zinc-400">
                                        <CreditCard className="h-4 w-4" />
                                        Next payment: {new Date(selectedMember.next_payment_date).toLocaleDateString("en-GB")}
                                    </div>
                                )}
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="text-sm font-medium text-zinc-400 mb-2 block">
                                    <FileText className="h-4 w-4 inline mr-2" />
                                    Notes
                                </label>
                                <Textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Add notes about this member..."
                                    rows={3}
                                />
                                <Button
                                    size="sm"
                                    className="mt-2"
                                    onClick={saveNotes}
                                    disabled={isSavingNotes || notes === selectedMember.notes}
                                >
                                    {isSavingNotes ? "Saving..." : "Save Notes"}
                                </Button>
                            </div>

                            {/* Payment History */}
                            <div>
                                <h3 className="font-medium mb-3 flex items-center gap-2">
                                    <Clock className="h-4 w-4" />
                                    Payment History
                                </h3>
                                {memberTransactions.length === 0 ? (
                                    <p className="text-zinc-500 text-sm">No transactions found</p>
                                ) : (
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {memberTransactions.map((tx) => (
                                            <div
                                                key={tx.id}
                                                className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg"
                                            >
                                                <div>
                                                    <div className="text-sm font-medium">
                                                        {tx.description || tx.payment_type || "Payment"}
                                                        {tx.from_merged_client && (
                                                            <span className="ml-2 text-xs text-zinc-500">
                                                                (from merged account)
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-zinc-500">
                                                        {new Date(tx.transaction_date).toLocaleDateString("en-GB")}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className={tx.status === "Approved" ? "text-emerald-400" : "text-rose-400"}>
                                                        {formatCurrency(tx.gross_amount)}
                                                    </div>
                                                    <div className="text-xs text-zinc-500">
                                                        {tx.status}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
