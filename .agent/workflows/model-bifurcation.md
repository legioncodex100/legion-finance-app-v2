---
description: Model bifurcation rule - Claude for planning, Gemini for execution
---

# AI Model Assignment Rule

## Planning Phase (PLANNING mode)
- Use **Claude 4.5 Opus** for:
  - Requirements analysis
  - Architecture decisions
  - Implementation planning
  - Design documents
  - Code reviews

## Execution Phase (EXECUTION mode)
- Use **Gemini 3.0 Flash** for:
  - Writing code
  - Making file changes
  - Running commands
  - Building features
  - Bug fixes

## Verification Phase (VERIFICATION mode)
- Use **Gemini 3.0 Flash** for:
  - Running tests
  - Validating changes
  - Creating walkthroughs

This rule applies automatically to all tasks in this workspace.
