---
name: memory-documentation
description: Guidelines for maintaining memory.md in Legion Finance. Use when updating documentation, adding session notes, or reviewing project history.
---

# Memory Documentation Skill

## When to Use
- After completing a feature
- At the end of a work session
- When making significant decisions
- Before starting major refactors

## File Locations

| File | Purpose |
|------|---------|
| `docs/memory.md` | **Current lean reference** (~180 lines max) |
| `docs/archive/2026-01-full-history.md` | Full detailed history |

## What Goes in memory.md

### ✅ KEEP (Reference Material)
- Project overview
- Development timeline (summary table)
- Core features (bullet points)
- Technical decisions
- Database tables list
- File structure
- Critical gotchas
- Recent session summaries (last 2-3 sessions only)

### ❌ MOVE TO ARCHIVE (Detailed History)
- Code snippets
- Step-by-step debugging logs
- Full implementation details
- Verbose session notes
- Migration scripts content
- Historical troubleshooting

## Updating After a Session

At the end of each work session, update memory.md:

### 1. Update "Last Updated" Date
```markdown
> **Last Updated:** January 14, 2026
```

### 2. Add Session Summary (Brief!)
```markdown
### January 14, 2026
- Bulk delete, search for Accounts Payable
- Created 22 agent skills
- Set up Jest testing
```

### 3. Move Old Sessions to Archive
Keep only the **last 2-3 sessions** in memory.md. Move older ones to archive.

### 4. Update Timeline If Major Phase
If you completed a major feature phase, add a row to the timeline table.

## When to Update What

| Change | Update memory.md? | Update archive? |
|--------|-------------------|-----------------|
| New feature complete | ✅ Session note | ✅ Full details |
| Bug fix | ❌ Skip | ✅ If significant |
| Refactoring | ✅ If structural | ✅ Details |
| New integration | ✅ Features + Timeline | ✅ Full setup |
| New skill created | ✅ Skills list | ❌ Skip |
| Config change | ❌ Skip | ✅ Note it |

## Keeping It Lean

### Target Size
- memory.md: **~150-200 lines**
- If exceeding 250 lines, archive old content

### Archive Process
1. Copy detailed content to archive file
2. Replace with summary in memory.md
3. Link to archive: `*See [archive/...](archive/...) for details*`

## Critical Gotchas Section

Add to gotchas when you discover something that:
- Wasted time debugging
- Is non-obvious behavior
- Affects multiple places
- Future-you will forget

Format:
```markdown
> [!IMPORTANT]
> **Short Title**  
> Brief explanation of the gotcha.
```

## Example Session Note

```markdown
### January 15, 2026
- Added vendor bulk import feature
- Fixed Starling sync date range (full day)
- Refactored PayableTable into separate component
- New skill: `vendor-management`
```

Keep it to **3-5 bullets max**. No code, no details.
