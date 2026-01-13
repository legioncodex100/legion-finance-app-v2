"use client"

import * as React from "react"
import {
    Search, Plus, Trash2, Edit2, Loader2,
    LayoutGrid, List, UserCircle, Briefcase,
    CheckCircle, XCircle, Phone, Mail
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { getStaff, createStaff, updateStaff, deleteStaff, Staff, StaffRole, Discipline, PayPeriod } from "@/lib/actions/staff"
import { DISCIPLINES } from "@/lib/types/staff"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export function StaffList() {
    const [staff, setStaff] = React.useState<Staff[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const [search, setSearch] = React.useState("")
    const [roleFilter, setRoleFilter] = React.useState<StaffRole | 'all'>('all')
    const [viewMode, setViewMode] = React.useState<"grid" | "list">("list")

    // Add Dialog
    const [isAddOpen, setIsAddOpen] = React.useState(false)
    const [newName, setNewName] = React.useState("")
    const [newRole, setNewRole] = React.useState<StaffRole>("coach")
    const [newEmail, setNewEmail] = React.useState("")
    const [newPhone, setNewPhone] = React.useState("")
    const [newPayRate, setNewPayRate] = React.useState("")
    const [newIsCoach, setNewIsCoach] = React.useState(false)
    const [newIsFacilities, setNewIsFacilities] = React.useState(false)
    const [newIsVa, setNewIsVa] = React.useState(false)
    const [newCoachDisciplines, setNewCoachDisciplines] = React.useState<Discipline[]>([])
    const [newCoachRate, setNewCoachRate] = React.useState("")
    const [newCoachPayPeriod, setNewCoachPayPeriod] = React.useState<PayPeriod>("hourly")
    const [newFacilitiesRate, setNewFacilitiesRate] = React.useState("")
    const [newFacilitiesPayPeriod, setNewFacilitiesPayPeriod] = React.useState<PayPeriod>("hourly")
    const [newVaRate, setNewVaRate] = React.useState("")
    const [newVaPayPeriod, setNewVaPayPeriod] = React.useState<PayPeriod>("monthly")
    const [newIsOwner, setNewIsOwner] = React.useState(false)
    const [newWeeklySalary, setNewWeeklySalary] = React.useState("")
    const [isSubmitting, setIsSubmitting] = React.useState(false)

    // Edit Dialog
    const [editingStaff, setEditingStaff] = React.useState<Staff | null>(null)
    const [editName, setEditName] = React.useState("")
    const [editRole, setEditRole] = React.useState<StaffRole>("coach")
    const [editEmail, setEditEmail] = React.useState("")
    const [editPhone, setEditPhone] = React.useState("")
    const [editPayRate, setEditPayRate] = React.useState("")
    const [editActive, setEditActive] = React.useState(true)
    const [editIsCoach, setEditIsCoach] = React.useState(false)
    const [editIsFacilities, setEditIsFacilities] = React.useState(false)
    const [editIsVa, setEditIsVa] = React.useState(false)
    const [editCoachDisciplines, setEditCoachDisciplines] = React.useState<Discipline[]>([])
    const [editCoachRate, setEditCoachRate] = React.useState("")
    const [editCoachPayPeriod, setEditCoachPayPeriod] = React.useState<PayPeriod>("hourly")
    const [editFacilitiesRate, setEditFacilitiesRate] = React.useState("")
    const [editFacilitiesPayPeriod, setEditFacilitiesPayPeriod] = React.useState<PayPeriod>("hourly")
    const [editVaRate, setEditVaRate] = React.useState("")
    const [editVaPayPeriod, setEditVaPayPeriod] = React.useState<PayPeriod>("monthly")
    const [editIsOwner, setEditIsOwner] = React.useState(false)
    const [editWeeklySalary, setEditWeeklySalary] = React.useState("")
    const [isEditing, setIsEditing] = React.useState(false)

    const fetchStaff = React.useCallback(async () => {
        setIsLoading(true)
        try {
            const data = await getStaff(roleFilter === 'all' ? undefined : roleFilter)
            setStaff(data || [])
        } catch (err) {
            console.error("Staff load error:", err)
            toast.error("Failed to load staff")
        } finally {
            setIsLoading(false)
        }
    }, [roleFilter])

    React.useEffect(() => { fetchStaff() }, [fetchStaff])

    const handleAdd = async () => {
        if (!newName.trim()) return
        setIsSubmitting(true)
        try {
            await createStaff({
                name: newName,
                role: newRole,
                email: newEmail || undefined,
                phone: newPhone || undefined,
                pay_rate: newPayRate ? parseFloat(newPayRate) : undefined,
                is_coach: newIsCoach,
                is_facilities: newIsFacilities,
                is_va: newIsVa,
                is_owner: newIsOwner,
                weekly_salary: newIsOwner && newWeeklySalary ? parseFloat(newWeeklySalary) : undefined,
                coach_disciplines: newIsCoach ? newCoachDisciplines : undefined,
                coach_hourly_rate: newIsCoach && newCoachRate ? parseFloat(newCoachRate) : undefined,
                coach_pay_period: newIsCoach ? newCoachPayPeriod : undefined,
                facilities_hourly_rate: newIsFacilities && newFacilitiesRate ? parseFloat(newFacilitiesRate) : undefined,
                facilities_pay_period: newIsFacilities ? newFacilitiesPayPeriod : undefined,
                va_monthly_rate: newIsVa && newVaRate ? parseFloat(newVaRate) : undefined,
                va_pay_period: newIsVa ? newVaPayPeriod : undefined
            })
            setNewName(""); setNewEmail(""); setNewPhone(""); setNewPayRate("")
            setNewIsCoach(false); setNewIsFacilities(false); setNewIsVa(false); setNewIsOwner(false)
            setNewCoachDisciplines([]); setNewCoachRate(""); setNewCoachPayPeriod("hourly")
            setNewFacilitiesRate(""); setNewFacilitiesPayPeriod("hourly")
            setNewVaRate(""); setNewVaPayPeriod("monthly"); setNewWeeklySalary("")
            setIsAddOpen(false)
            fetchStaff()
            toast.success("Team member added")
        } catch {
            toast.error("Failed to add")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleEdit = async () => {
        if (!editingStaff || !editName.trim()) return
        setIsEditing(true)
        try {
            await updateStaff(editingStaff.id, {
                name: editName,
                role: editRole,
                email: editEmail || undefined,
                phone: editPhone || undefined,
                pay_rate: editPayRate ? parseFloat(editPayRate) : undefined,
                is_active: editActive,
                is_coach: editIsCoach,
                is_facilities: editIsFacilities,
                is_va: editIsVa,
                is_owner: editIsOwner,
                weekly_salary: editIsOwner && editWeeklySalary ? parseFloat(editWeeklySalary) : undefined,
                coach_disciplines: editIsCoach ? editCoachDisciplines : undefined,
                coach_hourly_rate: editIsCoach && editCoachRate ? parseFloat(editCoachRate) : undefined,
                coach_pay_period: editIsCoach ? editCoachPayPeriod : undefined,
                facilities_hourly_rate: editIsFacilities && editFacilitiesRate ? parseFloat(editFacilitiesRate) : undefined,
                facilities_pay_period: editIsFacilities ? editFacilitiesPayPeriod : undefined,
                va_monthly_rate: editIsVa && editVaRate ? parseFloat(editVaRate) : undefined,
                va_pay_period: editIsVa ? editVaPayPeriod : undefined
            })
            toast.success("Updated")
            setEditingStaff(null)
            fetchStaff()
        } catch {
            toast.error("Failed to update")
        } finally {
            setIsEditing(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this staff member?")) return
        try {
            await deleteStaff(id)
            setStaff(prev => prev.filter(s => s.id !== id))
            toast.success("Deleted")
        } catch {
            toast.error("Failed to delete")
        }
    }

    const openEdit = (s: Staff) => {
        setEditingStaff(s)
        setEditName(s.name)
        setEditRole(s.role)
        setEditEmail(s.email || "")
        setEditPhone(s.phone || "")
        setEditPayRate(s.pay_rate?.toString() || "")
        setEditActive(s.is_active)
        setEditIsCoach(s.is_coach || false)
        setEditIsFacilities(s.is_facilities || false)
        setEditIsVa(s.is_va || false)
        setEditIsOwner(s.is_owner || false)
        setEditWeeklySalary(s.weekly_salary?.toString() || "")
        setEditCoachDisciplines(s.coach_disciplines || [])
        setEditCoachRate(s.coach_hourly_rate?.toString() || "")
        setEditCoachPayPeriod(s.coach_pay_period || "hourly")
        setEditFacilitiesRate(s.facilities_hourly_rate?.toString() || "")
        setEditFacilitiesPayPeriod(s.facilities_pay_period || "hourly")
        setEditVaRate(s.va_monthly_rate?.toString() || "")
        setEditVaPayPeriod(s.va_pay_period || "monthly")
    }

    const filtered = staff.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Team Management</h2>
                    <p className="text-muted-foreground">Manage coaches and staff members.</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* View Toggle */}
                    <div className="bg-slate-100 dark:bg-zinc-900 p-1 rounded-lg flex items-center border">
                        <Button variant="ghost" size="sm" className={cn("h-8 w-8 p-0", viewMode === 'grid' && "bg-white dark:bg-zinc-800 shadow-sm")} onClick={() => setViewMode('grid')}>
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className={cn("h-8 w-8 p-0", viewMode === 'list' && "bg-white dark:bg-zinc-800 shadow-sm")} onClick={() => setViewMode('list')}>
                            <List className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Add Button */}
                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Team Member</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add Team Member</DialogTitle>
                                <DialogDescription>Add a new coach or staff member.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Name</Label>
                                        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Role</Label>
                                        <Select value={newRole} onValueChange={(v: StaffRole) => setNewRole(v)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="coach">Coach</SelectItem>
                                                <SelectItem value="staff">Staff</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Email</Label>
                                        <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@example.com" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Phone</Label>
                                        <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+44..." />
                                    </div>
                                </div>
                                {/* Staff Types */}
                                <div className="grid gap-2">
                                    <Label>Staff Types</Label>
                                    <div className="flex flex-wrap gap-3">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={newIsOwner} onChange={e => setNewIsOwner(e.target.checked)} className="h-4 w-4 rounded" />
                                            <span className="text-sm font-semibold text-rose-500">Owner/Director</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={newIsCoach} onChange={e => setNewIsCoach(e.target.checked)} className="h-4 w-4 rounded" />
                                            <span className="text-sm">Coach</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={newIsFacilities} onChange={e => setNewIsFacilities(e.target.checked)} className="h-4 w-4 rounded" />
                                            <span className="text-sm">Facilities</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={newIsVa} onChange={e => setNewIsVa(e.target.checked)} className="h-4 w-4 rounded" />
                                            <span className="text-sm">Virtual Assistant</span>
                                        </label>
                                    </div>
                                </div>
                                {/* Owner Pay Section */}
                                {newIsOwner && (
                                    <div className="grid gap-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30">
                                        <Label className="text-rose-400 font-semibold">Owner Weekly Salary</Label>
                                        <div className="grid gap-2">
                                            <Label className="text-rose-400">Weekly Amount (£)</Label>
                                            <Input type="number" value={newWeeklySalary} onChange={e => setNewWeeklySalary(e.target.value)} placeholder="500" className="bg-zinc-900" />
                                            <p className="text-xs text-muted-foreground">This will appear in Cash Flow forecast every week</p>
                                        </div>
                                    </div>
                                )}
                                {/* Coach-specific fields */}
                                {newIsCoach && (
                                    <div className="grid gap-4 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/30">
                                        <div className="grid gap-2">
                                            <Label className="text-indigo-400">Disciplines</Label>
                                            <div className="flex flex-wrap gap-2">
                                                {DISCIPLINES.map(d => (
                                                    <button
                                                        key={d}
                                                        type="button"
                                                        onClick={() => setNewCoachDisciplines(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])}
                                                        className={cn("px-2 py-1 text-xs rounded-full border transition-colors", newCoachDisciplines.includes(d) ? "bg-indigo-500 text-white border-indigo-500" : "border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/20")}
                                                    >
                                                        {d}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="grid gap-2">
                                                <Label className="text-indigo-400">Rate (£)</Label>
                                                <Input type="number" value={newCoachRate} onChange={e => setNewCoachRate(e.target.value)} placeholder="0.00" className="bg-zinc-900" />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label className="text-indigo-400">Per</Label>
                                                <Select value={newCoachPayPeriod} onValueChange={(v: PayPeriod) => setNewCoachPayPeriod(v)}>
                                                    <SelectTrigger className="bg-zinc-900"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="hourly">Hour</SelectItem>
                                                        <SelectItem value="weekly">Week</SelectItem>
                                                        <SelectItem value="monthly">Month</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {newIsFacilities && (
                                    <div className="grid gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                                        <Label className="text-amber-400 font-semibold">Facilities Pay</Label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="grid gap-2">
                                                <Label className="text-amber-400">Rate (£)</Label>
                                                <Input type="number" value={newFacilitiesRate} onChange={e => setNewFacilitiesRate(e.target.value)} placeholder="0.00" className="bg-zinc-900" />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label className="text-amber-400">Per</Label>
                                                <Select value={newFacilitiesPayPeriod} onValueChange={(v: PayPeriod) => setNewFacilitiesPayPeriod(v)}>
                                                    <SelectTrigger className="bg-zinc-900"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="hourly">Hour</SelectItem>
                                                        <SelectItem value="weekly">Week</SelectItem>
                                                        <SelectItem value="monthly">Month</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {newIsVa && (
                                    <div className="grid gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                                        <Label className="text-emerald-400 font-semibold">Virtual Assistant Pay</Label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="grid gap-2">
                                                <Label className="text-emerald-400">Rate (£)</Label>
                                                <Input type="number" value={newVaRate} onChange={e => setNewVaRate(e.target.value)} placeholder="0.00" className="bg-zinc-900" />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label className="text-emerald-400">Per</Label>
                                                <Select value={newVaPayPeriod} onValueChange={(v: PayPeriod) => setNewVaPayPeriod(v)}>
                                                    <SelectTrigger className="bg-zinc-900"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="hourly">Hour</SelectItem>
                                                        <SelectItem value="weekly">Week</SelectItem>
                                                        <SelectItem value="monthly">Month</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                                <Button onClick={handleAdd} disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 max-w-sm">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9" />
                </div>
                <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as StaffRole | 'all')}>
                    <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="coach">Coaches</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading...
                </div>
            ) : filtered.length === 0 ? (
                <Card className="border-dashed p-8 text-center text-muted-foreground">No team members found.</Card>
            ) : viewMode === 'list' ? (
                <div className="border rounded-xl bg-white dark:bg-zinc-950 overflow-hidden shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/50 dark:bg-zinc-900/50">
                                <TableHead>Name</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Contact</TableHead>
                                <TableHead>Pay Rate</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.map(s => (
                                <TableRow key={s.id}>
                                    <TableCell className="font-semibold">{s.name}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={s.role === 'coach' ? 'border-indigo-500 text-indigo-500' : 'border-amber-500 text-amber-500'}>
                                            {s.role === 'coach' ? <UserCircle className="h-3 w-3 mr-1" /> : <Briefcase className="h-3 w-3 mr-1" />}
                                            {s.role}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {s.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {s.email}</span>}
                                        {s.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {s.phone}</span>}
                                    </TableCell>
                                    <TableCell>{s.pay_rate ? `£${s.pay_rate.toFixed(2)}` : '-'}</TableCell>
                                    <TableCell>
                                        {s.is_active ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Edit2 className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filtered.map(s => (
                        <Card key={s.id} className="group hover:border-indigo-500/50 transition-colors">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <Badge variant="outline" className={s.role === 'coach' ? 'border-indigo-500 text-indigo-500' : 'border-amber-500 text-amber-500'}>
                                    {s.role}
                                </Badge>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}><Edit2 className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <CardTitle className="text-lg">{s.name}</CardTitle>
                                {s.pay_rate && <p className="text-sm text-muted-foreground mt-1">£{s.pay_rate.toFixed(2)}/month</p>}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Edit Dialog */}
            <Dialog open={!!editingStaff} onOpenChange={(open) => !open && setEditingStaff(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Team Member</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Name</Label>
                                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Role</Label>
                                <Select value={editRole} onValueChange={(v: StaffRole) => setEditRole(v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="coach">Coach</SelectItem>
                                        <SelectItem value="staff">Staff</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Email</Label>
                                <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Phone</Label>
                                <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Status</Label>
                                <Select value={editActive ? 'active' : 'inactive'} onValueChange={(v) => setEditActive(v === 'active')}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        {/* Staff Types */}
                        <div className="grid gap-2">
                            <Label>Staff Types</Label>
                            <div className="flex flex-wrap gap-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={editIsOwner} onChange={e => setEditIsOwner(e.target.checked)} className="h-4 w-4 rounded" />
                                    <span className="text-sm font-semibold text-rose-500">Owner/Director</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={editIsCoach} onChange={e => setEditIsCoach(e.target.checked)} className="h-4 w-4 rounded" />
                                    <span className="text-sm">Coach</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={editIsFacilities} onChange={e => setEditIsFacilities(e.target.checked)} className="h-4 w-4 rounded" />
                                    <span className="text-sm">Facilities</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={editIsVa} onChange={e => setEditIsVa(e.target.checked)} className="h-4 w-4 rounded" />
                                    <span className="text-sm">Virtual Assistant</span>
                                </label>
                            </div>
                        </div>
                        {/* Owner Pay Section */}
                        {editIsOwner && (
                            <div className="grid gap-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30">
                                <Label className="text-rose-400 font-semibold">Owner Weekly Salary</Label>
                                <div className="grid gap-2">
                                    <Label className="text-rose-400">Weekly Amount (£)</Label>
                                    <Input type="number" value={editWeeklySalary} onChange={e => setEditWeeklySalary(e.target.value)} placeholder="500" className="bg-zinc-900" />
                                    <p className="text-xs text-muted-foreground">This will appear in Cash Flow forecast every week</p>
                                </div>
                            </div>
                        )}
                        {/* Coach-specific fields */}
                        {editIsCoach && (
                            <div className="grid gap-4 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/30">
                                <div className="grid gap-2">
                                    <Label className="text-indigo-400">Disciplines</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {DISCIPLINES.map(d => (
                                            <button
                                                key={d}
                                                type="button"
                                                onClick={() => setEditCoachDisciplines(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])}
                                                className={cn("px-2 py-1 text-xs rounded-full border transition-colors", editCoachDisciplines.includes(d) ? "bg-indigo-500 text-white border-indigo-500" : "border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/20")}
                                            >
                                                {d}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="grid gap-2">
                                        <Label className="text-indigo-400">Rate (£)</Label>
                                        <Input type="number" value={editCoachRate} onChange={e => setEditCoachRate(e.target.value)} placeholder="0.00" className="bg-zinc-900" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label className="text-indigo-400">Per</Label>
                                        <Select value={editCoachPayPeriod} onValueChange={(v: PayPeriod) => setEditCoachPayPeriod(v)}>
                                            <SelectTrigger className="bg-zinc-900"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="hourly">Hour</SelectItem>
                                                <SelectItem value="weekly">Week</SelectItem>
                                                <SelectItem value="monthly">Month</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        )}
                        {editIsFacilities && (
                            <div className="grid gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                                <Label className="text-amber-400 font-semibold">Facilities Pay</Label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="grid gap-2">
                                        <Label className="text-amber-400">Rate (£)</Label>
                                        <Input type="number" value={editFacilitiesRate} onChange={e => setEditFacilitiesRate(e.target.value)} placeholder="0.00" className="bg-zinc-900" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label className="text-amber-400">Per</Label>
                                        <Select value={editFacilitiesPayPeriod} onValueChange={(v: PayPeriod) => setEditFacilitiesPayPeriod(v)}>
                                            <SelectTrigger className="bg-zinc-900"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="hourly">Hour</SelectItem>
                                                <SelectItem value="weekly">Week</SelectItem>
                                                <SelectItem value="monthly">Month</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        )}
                        {editIsVa && (
                            <div className="grid gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                                <Label className="text-emerald-400 font-semibold">Virtual Assistant Pay</Label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="grid gap-2">
                                        <Label className="text-emerald-400">Rate (£)</Label>
                                        <Input type="number" value={editVaRate} onChange={e => setEditVaRate(e.target.value)} placeholder="0.00" className="bg-zinc-900" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label className="text-emerald-400">Per</Label>
                                        <Select value={editVaPayPeriod} onValueChange={(v: PayPeriod) => setEditVaPayPeriod(v)}>
                                            <SelectTrigger className="bg-zinc-900"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="hourly">Hour</SelectItem>
                                                <SelectItem value="weekly">Week</SelectItem>
                                                <SelectItem value="monthly">Month</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingStaff(null)}>Cancel</Button>
                        <Button onClick={handleEdit} disabled={isEditing}>
                            {isEditing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
