---
name: use-worktrees
description: Always use isolated worktrees for code changes so work doesn't interfere with the main repo or other sessions.
type: rule
---

## Rule

All code changes MUST be made in an isolated worktree. Never modify files directly in the main repository checkout.

## Scope

This applies to **every** type of change:
- Features, fixes, refactors
- Documentation updates (PROMPT.md, CLAUDE.md, etc.)
- Chore/config changes (package.json, .env.example, etc.)
- Utility additions
- No exceptions for "small" or "quick" changes

## Workflow

1. **Enter worktree once per feature** — use `EnterWorktree` with a descriptive name before making any changes
2. **Create feature branch** — `git fetch origin main && git checkout -b <prefix>/<short-description> origin/main`
3. **Implement all tasks** — commit each task as a separate commit on the same branch. Do NOT exit the worktree between tasks.
4. **Push, create PR, merge** — after all tasks are done, push the branch, create one PR, and merge.
5. **Exit worktree** — use `ExitWorktree` with `action: "remove"` after merge (work is on main)
6. **Pull main** — immediately after exiting, run `git pull origin main` so the main checkout has the merged changes

## Why

- Main repo checkout stays clean for the user and other sessions
- Parallel work across sessions doesn't conflict
- Changes are isolated until explicitly merged via PR
- Prevents accidental direct commits to main
