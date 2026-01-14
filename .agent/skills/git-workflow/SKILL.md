---
name: git-workflow
description: Git workflow and best practices for Legion Finance. Use when committing code, creating branches, or managing version control.
---

# Git Workflow Skill

## When to Use
- Committing changes
- Creating branches for features
- Writing commit messages
- Understanding when to push

## Basic Commands

```bash
# Check status
git status

# Stage all changes
git add .

# Stage specific files
git add src/lib/actions/payables.ts

# Commit with message
git commit -m "feat: add bulk delete for bills"

# Push to remote
git push

# Pull latest changes
git pull
```

## Commit Message Format

Use conventional commits:

```
<type>: <short description>

<optional longer description>
```

### Types

| Type | When to Use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code change that doesn't add feature or fix bug |
| `style` | Formatting, no code change |
| `docs` | Documentation updates |
| `test` | Adding tests |
| `chore` | Maintenance tasks |

### Examples

```bash
# Feature
git commit -m "feat: add search to accounts payable"

# Bug fix
git commit -m "fix: correct weekly bill generation for Fridays"

# Refactor
git commit -m "refactor: extract PayeeIcon component"

# With description
git commit -m "feat: add partial payment support

- Track amount_paid on payables
- Show progress bar in bill details
- Display remaining balance in table"
```

## Branching (Optional)

For larger features:

```bash
# Create and switch to new branch
git checkout -b feature/mindbody-webhooks

# Make changes and commit
git add .
git commit -m "feat: add mindbody webhook handler"

# Push branch
git push -u origin feature/mindbody-webhooks

# When done, merge to main
git checkout main
git merge feature/mindbody-webhooks
git push
```

## When to Commit

| Situation | Commit? |
|-----------|---------|
| Feature is working | ✅ Yes |
| Fixed a bug | ✅ Yes |
| End of work session | ✅ Yes (WIP is fine) |
| Code is broken | ❌ No |
| Just testing something | ❌ No |

## When to Push

Pushing sends your commits to the remote repository (GitHub/backup).

| Situation | Push? | Why |
|-----------|-------|-----|
| Feature complete & working | ✅ Yes | Safe checkpoint, triggers deploy |
| End of work session | ✅ Yes | Backup your work |
| Before trying risky change | ✅ Yes | Easy rollback point |
| After multiple local commits | ✅ Yes | Keep remote in sync |
| Want feedback from others | ✅ Yes | They can see your code |
| Code is broken | ❌ No | Don't break production |
| Mid-experiment | ❌ No | Clean up first |
| Sensitive data in code | ❌ Never | Remove it first! |

### Push Frequency

**My advice for solo developers like you:**

```
Work session → Multiple commits → Push at end (or when feature done)
```

**Example workflow:**
```bash
# Morning: Start feature
git add .
git commit -m "feat: start bulk delete UI"

# After lunch: More progress
git add .
git commit -m "feat: add delete confirmation"

# Feature working: Push!
git add .
git commit -m "feat: complete bulk delete"
git push  # ← Now push all 3 commits

# End of day (even if not done)
git add .
git commit -m "WIP: bulk delete - need to add loading state"
git push  # ← Backup your work
```

### Golden Rules

1. **Always push working code** - Others (and Vercel) will use it
2. **Push before risky changes** - Easy rollback
3. **Push at end of day** - Backup!
4. **Don't push secrets** - Check before pushing

## Useful Commands

```bash
# See what changed
git diff

# See commit history
git log --oneline -10

# Undo uncommitted changes to a file
git checkout src/lib/actions/payables.ts

# Undo last commit (keep changes)
git reset --soft HEAD~1

# See which branch you're on
git branch
```

## .gitignore

Already set up, but key things ignored:
- `node_modules/`
- `.env.local` (secrets!)
- `.next/`
- `*.log`

## Don't Commit

- `.env.local` (API keys, secrets)
- `node_modules/`
- Build output
- IDE settings (usually)
