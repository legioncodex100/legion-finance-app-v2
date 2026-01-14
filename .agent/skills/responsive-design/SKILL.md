---
name: responsive-design
description: Responsive design patterns for Legion Finance. Use when building mobile-friendly layouts or handling tables on small screens.
---

# Responsive Design Skill

## When to Use
- Building new pages
- Fixing mobile layout issues
- Handling tables on mobile
- Testing responsive behavior

## Breakpoints

Tailwind CSS breakpoints:

| Prefix | Min Width | Typical Device |
|--------|-----------|----------------|
| (none) | 0px | Mobile (default) |
| `sm` | 640px | Large phone |
| `md` | 768px | Tablet |
| `lg` | 1024px | Laptop |
| `xl` | 1280px | Desktop |
| `2xl` | 1536px | Large desktop |

## Mobile-First Approach

Always design for mobile first, then add styles for larger screens:

```tsx
// ✅ Mobile-first
<div className="p-4 md:p-6 lg:p-8">
    {/* Padding increases on larger screens */}
</div>

// ✅ Mobile-first: stack to row
<div className="flex flex-col md:flex-row gap-4">
    <Sidebar />
    <MainContent />
</div>
```

## Common Responsive Patterns

### Hide/Show Elements

```tsx
// Hide on mobile, show on desktop
<div className="hidden md:block">Desktop only</div>

// Show on mobile, hide on desktop
<div className="md:hidden">Mobile only</div>
```

### Responsive Grid

```tsx
// 1 column on mobile, 2 on tablet, 3 on desktop
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {items.map(item => <Card key={item.id} />)}
</div>
```

### Responsive Table

Tables are tricky on mobile. Options:

```tsx
// Option 1: Hidden columns on mobile
<TableHead className="hidden lg:table-cell">Category</TableHead>
<TableCell className="hidden lg:table-cell">{item.category}</TableCell>

// Option 2: Horizontal scroll
<div className="overflow-x-auto">
    <Table className="min-w-[800px]">
        {/* Full table */}
    </Table>
</div>

// Option 3: Card layout on mobile
<div className="hidden md:block">
    <Table>...</Table>
</div>
<div className="md:hidden space-y-4">
    {items.map(item => <MobileCard item={item} />)}
</div>
```

### Responsive Text

```tsx
// Smaller text on mobile
<h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">
    Title
</h1>

// Truncate on mobile
<p className="truncate md:whitespace-normal">
    Long text that truncates on mobile but shows fully on desktop
</p>
```

### Responsive Sidebar

```tsx
// Legion Finance sidebar pattern
<div className="hidden md:flex md:w-64 md:flex-col">
    <Sidebar />
</div>

// Mobile menu button (shows hamburger on mobile)
<Button className="md:hidden" onClick={toggleMobileMenu}>
    <Menu className="h-6 w-6" />
</Button>
```

## Spacing Patterns

```tsx
// Responsive padding
<div className="p-4 md:p-6 lg:p-8">

// Responsive gap
<div className="flex flex-col gap-4 md:gap-6">

// Responsive margin
<div className="mt-4 md:mt-8">
```

## Testing Responsive Design

### Browser DevTools

1. Open DevTools (`Cmd + Option + I`)
2. Click device icon (or `Cmd + Shift + M`)
3. Select device or set custom size

### Common Sizes to Test

| Width | Device |
|-------|--------|
| 375px | iPhone SE/Mini |
| 390px | iPhone 14 |
| 768px | iPad |
| 1024px | iPad Pro / Laptop |
| 1440px | Desktop |

## Legion Finance Specific

### Dashboard Stats Grid

```tsx
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <StatCard title="Balance" value={balance} />
    {/* More stat cards */}
</div>
```

### Table Columns Priority

Show most important columns on mobile:

| Column | Mobile | Tablet | Desktop |
|--------|--------|--------|---------|
| Name | ✅ | ✅ | ✅ |
| Amount | ✅ | ✅ | ✅ |
| Due Date | ✅ | ✅ | ✅ |
| Category | ❌ | ❌ | ✅ |
| Linked | ❌ | ✅ | ✅ |
| Actions | ✅ | ✅ | ✅ |

```tsx
<TableHead className="hidden lg:table-cell">Category</TableHead>
<TableHead className="hidden md:table-cell">Linked</TableHead>
```
