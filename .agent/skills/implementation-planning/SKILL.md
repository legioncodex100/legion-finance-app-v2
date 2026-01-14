---
name: implementation-planning
description: Patterns for creating clear, actionable implementation plans. Use when planning new features or significant changes before coding.
---

# Implementation Planning Skill

Use this skill when creating plans for new features or significant changes. Good plans enable smooth handoffs between planning (Claude) and execution (Gemini).

---

## When to Create a Plan

**Always plan when:**
- Adding a new feature or page
- Changing database schema
- Modifying authentication or security
- Refactoring multiple files
- Integrating external APIs

**Skip planning for:**
- Single-file bug fixes
- Text/styling changes
- Adding simple UI elements
- Obvious refactoring (rename, extract function)

---

## Plan Structure

A good implementation plan has:

```markdown
# [Feature Name] Implementation Plan

## Goal
One sentence: what are we building and why?

## Proposed Changes

### [Component 1]
- [MODIFY] `file.tsx` - Brief change description
- [NEW] `new-file.ts` - What it contains

### [Component 2]
- ...

## Verification Plan
- How to test it works
- Edge cases to check
```

---

## Key Principles

### 1. File-Level Granularity
List every file that will be created or modified. No surprises during execution.

### 2. Order Matters
List dependencies first. Schema changes before code that uses them.

### 3. Scope Control
If scope grows, update the plan and get approval before continuing.

### 4. Questions First
If requirements are unclear, ask before planning. Don't assume.

---

## Handoff Checklist

Before handing a plan to execution mode:

- [ ] All files listed (new and modified)
- [ ] Database changes documented with migration SQL
- [ ] No open questions about requirements
- [ ] Verification steps are specific and testable
- [ ] User has approved the approach

---

## Example: Adding a New Feature

**User Request:** "Add a members page that shows all Mindbody members"

**Good Plan Response:**
```markdown
## Proposed Changes

### Database
- [MODIFY] mb_members table - Add profile fields (phone, gender, dob)

### Server Actions
- [NEW] `src/lib/actions/members.ts`
  - getMembers() with pagination
  - getMember(id) for profile

### UI
- [NEW] `src/app/(dashboard)/members/page.tsx`
  - List view with search/filter
  - Profile modal on click

## Verification
- Navigate to /members
- Search works by name/email
- Click member opens profile modal
```

---

## Anti-Patterns

❌ **Too vague:** "Update the UI to show members"  
✅ **Specific:** "Create `/members/page.tsx` with table, search, and profile modal"

❌ **Missing files:** Describing changes without listing which files  
✅ **Complete:** Every file change listed with [NEW], [MODIFY], or [DELETE]

❌ **No verification:** "Test it works"  
✅ **Actionable:** "Navigate to /members, search for 'John', verify results filter"
