---
description: Model bifurcation rule - Claude for planning, Gemini for execution
---

# AI Model Assignment Rule

## When to Use Claude (Planning)
Use **Claude Opus 4** for:
- Requirements analysis and clarification
- Architecture decisions
- Implementation planning (creating `implementation_plan.md`)
- Design documents
- Complex debugging requiring deep reasoning
- Code reviews

**Switch to Gemini when:** Plan is approved and ready for coding.

---

## When to Use Gemini (Execution)
Use **Gemini 2.5 Pro** for:
- Writing code and making file changes
- Running commands and builds
- Building features from approved plans
- Bug fixes with clear reproduction steps
- Creating/updating tests
- Verification and walkthroughs

**Switch to Claude when:** You need architectural guidance or hit unexpected complexity.

---

## Quick Reference

| Task | Model |
|------|-------|
| "How should we design X?" | Claude |
| "Build the plan we discussed" | Gemini |
| "Why isn't this working?" | Claude (analyze) → Gemini (fix) |
| "Add a button to do Y" | Gemini |
| "Refactor the auth system" | Claude (plan) → Gemini (execute) |

This rule applies automatically to all tasks in this workspace.
