---
name: accessibility
description: Accessibility patterns for Legion Finance. Use when building interactive elements, forms, or ensuring the app is usable by everyone.
---

# Accessibility Skill

## When to Use
- Building interactive components
- Creating forms
- Adding icons/images
- Ensuring keyboard navigation

## Why Accessibility?

- Legal requirement in many places
- Better for all users (not just disabled)
- Improves SEO
- Better code structure

## Key Principles

### 1. Semantic HTML

Use correct elements:

```tsx
// ✅ GOOD: Semantic elements
<button onClick={handleClick}>Submit</button>
<nav>...</nav>
<main>...</main>
<article>...</article>

// ❌ BAD: Divs for everything
<div onClick={handleClick}>Submit</div>
```

### 2. Labels for Inputs

Every input needs a label:

```tsx
// ✅ GOOD: Linked label
<Label htmlFor="name">Name</Label>
<Input id="name" />

// ✅ GOOD: Wrapped label
<label>
    Name
    <input />
</label>

// ❌ BAD: No label
<Input placeholder="Name" />
```

### 3. Alt Text for Images

```tsx
// ✅ GOOD: Descriptive alt
<img src="/logo.png" alt="Legion Finance logo" />

// ✅ GOOD: Decorative image (empty alt)
<img src="/decorative-bg.png" alt="" />

// ❌ BAD: Missing alt
<img src="/logo.png" />
```

### 4. Keyboard Navigation

Everything clickable should be keyboard accessible:

```tsx
// ✅ GOOD: Button is keyboard accessible by default
<Button onClick={handleClick}>Click me</Button>

// ✅ GOOD: Adding keyboard support to custom element
<div
    role="button"
    tabIndex={0}
    onClick={handleClick}
    onKeyDown={(e) => e.key === 'Enter' && handleClick()}
>
    Click me
</div>

// ❌ BAD: Not keyboard accessible
<div onClick={handleClick}>Click me</div>
```

### 5. Focus Indicators

Don't remove focus outlines without replacement:

```css
/* ❌ BAD: Removes all focus indicators */
* { outline: none; }

/* ✅ GOOD: Custom focus indicator */
button:focus-visible {
    outline: 2px solid rgb(56 189 248);
    outline-offset: 2px;
}
```

## ARIA Attributes

When semantic HTML isn't enough:

```tsx
// Button that opens modal
<Button aria-haspopup="dialog" aria-expanded={isOpen}>
    Open Settings
</Button>

// Loading state
<Button disabled aria-busy={isLoading}>
    {isLoading ? 'Loading...' : 'Save'}
</Button>

// Icon-only buttons need labels
<Button aria-label="Delete bill">
    <Trash2 className="h-4 w-4" />
</Button>

// Announce dynamic content
<div role="status" aria-live="polite">
    {message}
</div>
```

## Common Patterns

### Icon Buttons

```tsx
// ✅ Always add aria-label
<Button variant="ghost" size="icon" aria-label="Edit bill">
    <Edit className="h-4 w-4" />
</Button>
```

### Error Messages

```tsx
// Link error to input
<div>
    <Label htmlFor="email">Email</Label>
    <Input
        id="email"
        aria-invalid={!!error}
        aria-describedby={error ? 'email-error' : undefined}
    />
    {error && (
        <p id="email-error" className="text-rose-400 text-sm mt-1">
            {error}
        </p>
    )}
</div>
```

### Loading States

```tsx
// Announce loading to screen readers
{isLoading && (
    <div role="status" aria-live="polite">
        <Loader2 className="animate-spin" />
        <span className="sr-only">Loading...</span>
    </div>
)}
```

### Skip Links

For keyboard users to skip navigation:

```tsx
// At very top of page
<a href="#main-content" className="sr-only focus:not-sr-only">
    Skip to main content
</a>

// Main content area
<main id="main-content">...</main>
```

## Screen Reader Only

Hide visually but keep for screen readers:

```tsx
// Tailwind class
<span className="sr-only">Additional context for screen readers</span>
```

## Color Contrast

Minimum contrast ratios:
- Normal text: 4.5:1
- Large text (18px+): 3:1
- UI components: 3:1

Legion Finance's zinc-on-dark theme generally meets these.

## Testing

1. **Keyboard only**: Navigate without mouse
2. **Screen reader**: Test with VoiceOver (Mac) or NVDA (Windows)
3. **Browser extensions**: axe DevTools, WAVE

## Checklist

- [ ] All inputs have labels
- [ ] Images have alt text
- [ ] Color isn't the only indicator
- [ ] Focus is visible
- [ ] Can navigate by keyboard
- [ ] Icon buttons have labels
- [ ] Errors are linked to inputs
