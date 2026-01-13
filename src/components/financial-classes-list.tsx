"use client"

import * as React from "react"
import { Plus, Edit2, Trash2, Loader2, TrendingUp, LayoutGrid, List } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
    getFinancialClasses, createFinancialClass, updateFinancialClass, deleteFinancialClass,
    FinancialClass
} from "@/lib/actions/financial-classes"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export function FinancialClassesList() {
    const [classes, setClasses] = React.useState<FinancialClass[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const [viewMode, setViewMode] = React.useState<"grid" | "list">("list")

    // Add Dialog
    const [isAddOpen, setIsAddOpen] = React.useState(false)
    const [newCode, setNewCode] = React.useState("")
    const [newName, setNewName] = React.useState("")
    const [newDesc, setNewDesc] = React.useState("")
    const [newAffectsProfit, setNewAffectsProfit] = React.useState(true)
    const [isSubmitting, setIsSubmitting] = React.useState(false)

    // Edit Dialog
    const [editingClass, setEditingClass] = React.useState<FinancialClass | null>(null)
    const [editCode, setEditCode] = React.useState("")
    const [editName, setEditName] = React.useState("")
    const [editDesc, setEditDesc] = React.useState("")
    const [editAffectsProfit, setEditAffectsProfit] = React.useState(true)
    const [isEditing, setIsEditing] = React.useState(false)

    const fetchClasses = React.useCallback(async () => {
        setIsLoading(true)
        try {
            const data = await getFinancialClasses()
            setClasses(data || [])
        } catch {
            toast.error("Failed to load financial classes")
        } finally {
            setIsLoading(false)
        }
    }, [])

    React.useEffect(() => { fetchClasses() }, [fetchClasses])

    const handleAdd = async () => {
        if (!newCode.trim() || !newName.trim()) return
        setIsSubmitting(true)
        try {
            await createFinancialClass({
                code: newCode,
                name: newName,
                description: newDesc,
                affects_profit: newAffectsProfit,
                sort_order: classes.length + 1
            })
            setNewCode("")
            setNewName("")
            setNewDesc("")
            setNewAffectsProfit(true)
            setIsAddOpen(false)
            fetchClasses()
            toast.success("Financial class created")
        } catch {
            toast.error("Failed to create class")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleEdit = async () => {
        if (!editingClass || !editCode.trim() || !editName.trim()) return
        setIsEditing(true)
        try {
            await updateFinancialClass(editingClass.id, {
                code: editCode,
                name: editName,
                description: editDesc,
                affects_profit: editAffectsProfit
            })
            toast.success("Class updated")
            setEditingClass(null)
            fetchClasses()
        } catch {
            toast.error("Failed to update class")
        } finally {
            setIsEditing(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this class? Categories using it will be unlinked.")) return
        try {
            await deleteFinancialClass(id)
            setClasses(prev => prev.filter(c => c.id !== id))
            toast.success("Class deleted")
        } catch {
            toast.error("Failed to delete class")
        }
    }

    const openEdit = (fc: FinancialClass) => {
        setEditingClass(fc)
        setEditCode(fc.code)
        setEditName(fc.name)
        setEditDesc(fc.description || "")
        setEditAffectsProfit(fc.affects_profit)
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Financial Classes</h2>
                    <p className="text-muted-foreground">Classification for your chart of accounts (Revenue, COGS, Expense, Equity).</p>
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
                            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Class</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add Financial Class</DialogTitle>
                                <DialogDescription>Create a new chart of accounts classification.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Code</Label>
                                        <Input value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} placeholder="e.g. COGS" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Name</Label>
                                        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Cost of Goods Sold" />
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Description</Label>
                                    <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What does this class represent?" className="min-h-[80px]" />
                                </div>
                                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-zinc-900 border">
                                    <div>
                                        <Label className="font-medium">Affects Profit & Loss</Label>
                                        <p className="text-xs text-muted-foreground">Include in P&L calculations</p>
                                    </div>
                                    <Switch checked={newAffectsProfit} onCheckedChange={setNewAffectsProfit} />
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

            {/* Content */}
            {isLoading ? (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading...
                </div>
            ) : classes.length === 0 ? (
                <Card className="border-dashed p-8 text-center text-muted-foreground">
                    No financial classes yet. Run the SQL migration to seed defaults.
                </Card>
            ) : viewMode === 'list' ? (
                <div className="border rounded-xl bg-white dark:bg-zinc-950 overflow-hidden shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/50 dark:bg-zinc-900/50">
                                <TableHead className="w-10"></TableHead>
                                <TableHead className="w-24">Code</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-center">P&L</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {classes.map(fc => (
                                <TableRow key={fc.id}>
                                    <TableCell><TrendingUp className="h-4 w-4 text-indigo-500" /></TableCell>
                                    <TableCell><Badge variant="outline" className="font-mono">{fc.code}</Badge></TableCell>
                                    <TableCell className="font-semibold">{fc.name}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{fc.description || "-"}</TableCell>
                                    <TableCell className="text-center">
                                        {fc.affects_profit ? (
                                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Yes</Badge>
                                        ) : (
                                            <Badge variant="secondary">No</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => openEdit(fc)}><Edit2 className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(fc.id)}><Trash2 className="h-4 w-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {classes.map(fc => (
                        <Card key={fc.id} className="group hover:border-indigo-500/50 transition-colors">
                            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-indigo-500" />
                                    <Badge variant="outline" className="font-mono">{fc.code}</Badge>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(fc)}><Edit2 className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(fc.id)}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <CardTitle className="text-lg">{fc.name}</CardTitle>
                                <CardDescription className="mt-1">{fc.description || "No description"}</CardDescription>
                                <div className="mt-3">
                                    {fc.affects_profit ? (
                                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Affects P&L</Badge>
                                    ) : (
                                        <Badge variant="secondary">Non-P&L</Badge>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Edit Dialog */}
            <Dialog open={!!editingClass} onOpenChange={(open) => !open && setEditingClass(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Edit Financial Class</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Code</Label>
                                <Input value={editCode} onChange={(e) => setEditCode(e.target.value.toUpperCase())} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Name</Label>
                                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Description</Label>
                            <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="min-h-[80px]" />
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-zinc-900 border">
                            <div>
                                <Label className="font-medium">Affects Profit & Loss</Label>
                                <p className="text-xs text-muted-foreground">Include in P&L calculations</p>
                            </div>
                            <Switch checked={editAffectsProfit} onCheckedChange={setEditAffectsProfit} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingClass(null)}>Cancel</Button>
                        <Button onClick={handleEdit} disabled={isEditing}>
                            {isEditing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
