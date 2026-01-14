"use client"

import * as React from "react"
import { Search, Plus, Trash2, Edit2, Loader2, LayoutGrid, List, Building2, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { getVendors, createVendor, updateVendor, deleteVendor, convertVendorToStaff, Vendor } from "@/lib/actions/vendors"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export function VendorList() {
    const [vendors, setVendors] = React.useState<Vendor[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const [search, setSearch] = React.useState("")
    const [viewMode, setViewMode] = React.useState<"grid" | "list">("list")

    // Add Dialog
    const [isAddOpen, setIsAddOpen] = React.useState(false)
    const [newName, setNewName] = React.useState("")
    const [isSubmitting, setIsSubmitting] = React.useState(false)

    // Edit Dialog
    const [editingVendor, setEditingVendor] = React.useState<Vendor | null>(null)
    const [editName, setEditName] = React.useState("")
    const [isEditing, setIsEditing] = React.useState(false)

    const fetchVendors = React.useCallback(async () => {
        setIsLoading(true)
        try {
            const data = await getVendors()
            setVendors(data || [])
        } catch {
            toast.error("Failed to load vendors")
        } finally {
            setIsLoading(false)
        }
    }, [])

    React.useEffect(() => { fetchVendors() }, [fetchVendors])

    const handleAdd = async () => {
        if (!newName.trim()) return
        setIsSubmitting(true)
        try {
            await createVendor({ name: newName })
            setNewName("")
            setIsAddOpen(false)
            fetchVendors()
            toast.success("Vendor added")
        } catch {
            toast.error("Failed to add")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleEdit = async () => {
        if (!editingVendor || !editName.trim()) return
        setIsEditing(true)
        try {
            await updateVendor(editingVendor.id, { name: editName })
            toast.success("Updated")
            setEditingVendor(null)
            fetchVendors()
        } catch {
            toast.error("Failed to update")
        } finally {
            setIsEditing(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this vendor? Transactions will remain but lose their vendor link.")) return
        try {
            await deleteVendor(id)
            setVendors(prev => prev.filter(v => v.id !== id))
            toast.success("Deleted")
        } catch {
            toast.error("Failed to delete")
        }
    }

    const handleConvertToStaff = async (id: string, name: string) => {
        const role = confirm(`Convert "${name}" to Staff.\n\nClick OK for Coach, Cancel for Staff role.`) ? 'coach' : 'staff'
        try {
            await convertVendorToStaff(id, role)
            setVendors(prev => prev.filter(v => v.id !== id))
            toast.success(`Converted to ${role}! Check the Staff page.`)
        } catch {
            toast.error("Failed to convert")
        }
    }

    const filtered = vendors.filter(v => v.name.toLowerCase().includes(search.toLowerCase()))

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Vendor Management</h2>
                    <p className="text-muted-foreground">External suppliers, companies, and recurring billers.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-slate-100 dark:bg-zinc-900 p-1 rounded-lg flex items-center border">
                        <Button variant="ghost" size="sm" className={cn("h-8 w-8 p-0", viewMode === 'grid' && "bg-white dark:bg-zinc-800 shadow-sm")} onClick={() => setViewMode('grid')}>
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className={cn("h-8 w-8 p-0", viewMode === 'list' && "bg-white dark:bg-zinc-800 shadow-sm")} onClick={() => setViewMode('list')}>
                            <List className="h-4 w-4" />
                        </Button>
                    </div>

                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Vendor</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add Vendor</DialogTitle>
                                <DialogDescription>Add a new external supplier or company.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label>Company Name</Label>
                                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. British Gas" onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
                                </div>
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

            {/* Search */}
            <div className="flex items-center gap-2 max-w-sm">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search vendors..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9" />
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading...
                </div>
            ) : filtered.length === 0 ? (
                <Card className="border-dashed p-8 text-center text-muted-foreground">No vendors found.</Card>
            ) : viewMode === 'list' ? (
                <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block border rounded-xl bg-white dark:bg-zinc-950 overflow-hidden shadow-sm">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50/50 dark:bg-zinc-900/50">
                                    <TableHead className="w-10"></TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>ID</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map(v => (
                                    <TableRow key={v.id}>
                                        <TableCell><Building2 className="h-4 w-4" /></TableCell>
                                        <TableCell className="font-semibold">{v.name}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground font-mono">{v.id}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" title="Convert to Staff" onClick={() => handleConvertToStaff(v.id, v.name)}><UserPlus className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" onClick={() => { setEditingVendor(v); setEditName(v.name) }}><Edit2 className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(v.id)}><Trash2 className="h-4 w-4" /></Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    {/* Mobile List View (Stacks Cards) */}
                    <div className="md:hidden grid gap-4 grid-cols-1">
                        {filtered.map(v => (
                            <Card key={v.id} className="group hover:border-emerald-500/50 transition-colors">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <Building2 className="h-4 w-4" />
                                    <div className="flex gap-1 opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Convert to Staff" onClick={() => handleConvertToStaff(v.id, v.name)}><UserPlus className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingVendor(v); setEditName(v.name) }}><Edit2 className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(v.id)}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <CardTitle className="text-lg truncate">{v.name}</CardTitle>
                                    <p className="text-xs text-muted-foreground mt-1">ID: {v.id.slice(0, 8)}...</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filtered.map(v => (
                        <Card key={v.id} className="group hover:border-emerald-500/50 transition-colors">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <Building2 className="h-4 w-4" />
                                <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Convert to Staff" onClick={() => handleConvertToStaff(v.id, v.name)}><UserPlus className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingVendor(v); setEditName(v.name) }}><Edit2 className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(v.id)}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <CardTitle className="text-lg truncate">{v.name}</CardTitle>
                                <p className="text-xs text-muted-foreground mt-1">ID: {v.id.slice(0, 8)}...</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Edit Dialog */}
            <Dialog open={!!editingVendor} onOpenChange={(open) => !open && setEditingVendor(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Edit Vendor</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Name</Label>
                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingVendor(null)}>Cancel</Button>
                        <Button onClick={handleEdit} disabled={isEditing}>
                            {isEditing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
