"use client"

import * as React from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createCategory, updateCategory, getFinancialClasses } from "@/lib/actions/transactions"
import { Loader2, FolderTree, Info } from "lucide-react"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

interface CategoryModalProps {
    category?: any // If provided, we're editing; otherwise creating
    parentCategories: any[]
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    onUpdate: () => void
}

export function CategoryModal({
    category,
    parentCategories,
    isOpen,
    onOpenChange,
    onUpdate
}: CategoryModalProps) {
    const [isSaving, setIsSaving] = React.useState(false)
    const [name, setName] = React.useState("")
    const [code, setCode] = React.useState("")
    const [description, setDescription] = React.useState("")
    const [type, setType] = React.useState<'income' | 'expense'>('expense')
    const [parentId, setParentId] = React.useState<string>("")
    const [classId, setClassId] = React.useState<string>("")
    const [classes, setClasses] = React.useState<any[]>([])
    const [isLoadingClasses, setIsLoadingClasses] = React.useState(false)

    const isEditing = !!category && !!category.id

    React.useEffect(() => {
        const fetchClasses = async () => {
            setIsLoadingClasses(true)
            try {
                const data = await getFinancialClasses()
                setClasses(data)
            } finally {
                setIsLoadingClasses(false)
            }
        }
        if (isOpen) {
            fetchClasses()
            if (category) {
                setName(category.name || "")
                setCode(category.code || "")
                setDescription(category.description || "")
                setType(category.type || 'expense')
                setParentId(category.parent_id || category.parentId || "")
                setClassId(category.class_id || "")
            } else {
                setName("")
                setCode("")
                setDescription("")
                setType('expense')
                setParentId("")
                setClassId("")
            }
        }
    }, [isOpen, category])

    const handleSave = async () => {
        if (!name.trim()) return
        setIsSaving(true)
        try {
            if (isEditing) {
                // Only pass code for parent categories (not subcategories)
                const isParent = !category.parent_id
                await updateCategory(category.id, {
                    name,
                    type,
                    description,
                    classId: classId || undefined,
                    code: isParent ? (code || undefined) : undefined
                })
            } else {
                await createCategory({
                    name,
                    type,
                    description,
                    parentId: parentId || undefined,
                    classId: classId || undefined,
                    code: parentId ? undefined : code || undefined
                })
            }
            onUpdate()
            onOpenChange(false)
        } catch (error) {
            console.error(error)
            alert("Failed to save category")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px] border-none shadow-2xl overflow-hidden p-0 dark:bg-zinc-950">
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black flex items-center gap-2">
                            <FolderTree className="h-5 w-5" />
                            {isEditing ? 'Edit Category' : 'Create New Category'}
                        </DialogTitle>
                        <DialogDescription className="text-indigo-100 opacity-90 font-medium mt-1">
                            {isEditing ? 'Update the category details below.' : 'Add a new category to your chart of accounts.'}
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-6 space-y-5">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="grid gap-2">
                            <Label className="text-[11px] uppercase font-black tracking-widest text-muted-foreground">Code</Label>
                            <Input
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                className="font-bold h-11"
                                placeholder="e.g. 2000"
                                disabled={!!parentId}
                            />
                            {parentId && <span className="text-[10px] text-muted-foreground">Auto-generated</span>}
                        </div>
                        <div className="col-span-2 grid gap-2">
                            <Label className="text-[11px] uppercase font-black tracking-widest text-muted-foreground">Category Name</Label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="font-bold h-11"
                                placeholder="e.g. Rent, Wages, Equipment..."
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label className="text-[11px] uppercase font-black tracking-widest text-muted-foreground">Type</Label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value as any)}
                                className="h-11 rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 text-sm font-bold outline-none"
                            >
                                <option value="expense">Expense</option>
                                <option value="income">Income</option>
                            </select>
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-[11px] uppercase font-black tracking-widest text-muted-foreground flex items-center gap-1">
                                Accounting Class
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-3 w-3 opacity-50 cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p className="max-w-xs text-[10px]">Normalizes reporting for P&L and Cash Flow statements.</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </Label>
                            <select
                                value={classId}
                                onChange={(e) => setClassId(e.target.value)}
                                disabled={isLoadingClasses}
                                className="h-11 rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 text-sm font-bold outline-none disabled:opacity-50"
                            >
                                <option value="">— Select Class —</option>
                                {classes
                                    .filter(c => c.type === type || c.type === 'both' || !c.type)
                                    .map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))
                                }
                            </select>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label className="text-[11px] uppercase font-black tracking-widest text-muted-foreground">Description</Label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm outline-none resize-none h-20"
                            placeholder="Explain what transactions should be categorized here..."
                        />
                    </div>

                    {!isEditing && (
                        <div className="grid gap-2">
                            <Label className="text-[11px] uppercase font-black tracking-widest text-muted-foreground">Parent Category (Optional)</Label>
                            <select
                                value={parentId}
                                onChange={(e) => setParentId(e.target.value)}
                                className="h-11 rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 text-sm font-bold outline-none"
                            >
                                <option value="">— Top-Level Category —</option>
                                {parentCategories.filter(c => !c.parent_id).map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-6 bg-slate-50 dark:bg-zinc-900/50 border-t border-slate-100 dark:border-zinc-800 gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="font-bold">Cancel</Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving || !name.trim()}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 px-6 gap-2"
                    >
                        {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isEditing ? 'Save Changes' : 'Create Category'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
