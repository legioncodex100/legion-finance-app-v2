---
name: ui-patterns
description: UI patterns for Legion Finance. Use when building modals, forms, loading states, or empty states. Covers common UI components and their patterns.
---

# UI Patterns Skill

## When to Use
- Building new UI features
- Implementing modals/dialogs
- Creating forms
- Handling loading/empty states

## Loading States

Always show loading indicator during async operations:

```tsx
const [isLoading, setIsLoading] = React.useState(false)

const handleSubmit = async () => {
    setIsLoading(true)
    try {
        await saveData()
    } finally {
        setIsLoading(false)
    }
}

return (
    <Button disabled={isLoading}>
        {isLoading ? (
            <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
            </>
        ) : (
            'Save'
        )}
    </Button>
)
```

## Empty States

Show helpful message when no data:

```tsx
{payables.length === 0 ? (
    <div className="p-12 text-center border-2 border-dashed border-zinc-800 rounded-xl">
        <FileText className="h-12 w-12 mx-auto text-zinc-700 mb-4" />
        <h3 className="text-lg font-medium text-zinc-400 mb-2">
            No bills yet
        </h3>
        <p className="text-sm text-zinc-500 mb-4">
            Create your first bill to get started
        </p>
        <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Bill
        </Button>
    </div>
) : (
    <PayableList payables={payables} />
)}
```

## Modal Pattern

```tsx
const [isModalOpen, setIsModalOpen] = React.useState(false)
const [selectedItem, setSelectedItem] = React.useState<Item | null>(null)

// Open modal with item
const openEditModal = (item: Item) => {
    setSelectedItem(item)
    setIsModalOpen(true)
}

// Close and reset
const closeModal = () => {
    setIsModalOpen(false)
    setSelectedItem(null)
}

return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>
                    {selectedItem ? 'Edit Bill' : 'New Bill'}
                </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit}>
                {/* Form fields */}
            </form>
            
            <DialogFooter>
                <Button variant="outline" onClick={closeModal}>
                    Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Saving...' : 'Save'}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
)
```

## Form Pattern

```tsx
const [formData, setFormData] = React.useState({
    name: '',
    amount: '',
    dueDate: ''
})
const [error, setError] = React.useState<string | null>(null)

const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError(null) // Clear error on change
}

const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    // Validate
    if (!formData.name.trim()) {
        setError('Name is required')
        return
    }
    
    try {
        await createPayable(formData)
        closeModal()
    } catch (err: any) {
        setError(err.message || 'Something went wrong')
    }
}

return (
    <form onSubmit={handleSubmit}>
        {error && (
            <div className="p-3 mb-4 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-sm">
                {error}
            </div>
        )}
        
        <div className="space-y-4">
            <div>
                <Label htmlFor="name">Name</Label>
                <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="Enter name"
                />
            </div>
            {/* More fields... */}
        </div>
    </form>
)
```

## Confirmation Dialog

For destructive actions:

```tsx
const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this? This cannot be undone.')) {
        return
    }
    
    await deletePayable(id)
    await refreshData()
}
```

## Status Badges

```tsx
function StatusBadge({ status }: { status: string }) {
    const variants: Record<string, string> = {
        paid: 'bg-emerald-500/20 text-emerald-400',
        scheduled: 'bg-sky-500/20 text-sky-400',
        overdue: 'bg-rose-500/20 text-rose-400',
        draft: 'bg-zinc-500/20 text-zinc-400',
    }
    
    return (
        <Badge className={variants[status] || variants.draft}>
            {status}
        </Badge>
    )
}
```

## Tooltip Pattern

```tsx
<TooltipProvider>
    <Tooltip>
        <TooltipTrigger asChild>
            <Button variant="ghost" size="icon">
                <Info className="h-4 w-4" />
            </Button>
        </TooltipTrigger>
        <TooltipContent>
            <p>This is helpful information</p>
        </TooltipContent>
    </Tooltip>
</TooltipProvider>
```

## Table Styling

```tsx
<Table>
    <TableHeader>
        <TableRow className="border-zinc-800 hover:bg-transparent">
            <TableHead className="text-zinc-400 text-xs uppercase">
                Name
            </TableHead>
            {/* More headers */}
        </TableRow>
    </TableHeader>
    <TableBody>
        {items.map(item => (
            <TableRow 
                key={item.id}
                className="border-zinc-800 hover:bg-zinc-900/50 cursor-pointer"
                onClick={() => openDetail(item)}
            >
                <TableCell>{item.name}</TableCell>
            </TableRow>
        ))}
    </TableBody>
</Table>
```

## Color Conventions

| Purpose | Color |
|---------|-------|
| Success | `emerald` |
| Info/Primary | `sky` |
| Warning | `amber` |
| Error/Danger | `rose` |
| Muted | `zinc` |
