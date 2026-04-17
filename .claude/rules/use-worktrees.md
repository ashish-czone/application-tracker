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

## CRITICAL: Never leave unmerged work in a worktree

**Steps 4–6 are mandatory before moving on.** A worktree with unmerged commits is invisible to future sessions and will be lost when cleaned up.

- **After every feature/task:** complete the full push → PR → merge → exit → pull cycle before starting the next feature or ending the session.
- **Never defer merging.** "I'll come back to it" is not acceptable — the next session won't know the worktree exists.
- **If the session is ending:** merge whatever is committed, even if the feature is partial. A partial PR on main is recoverable; uncommitted work in a deleted worktree is not.
- **If context is running low:** prioritize merging over new work. Losing 8 commits of finished work is worse than not starting the next task.

## Why

- Main repo checkout stays clean for the user and other sessions
- Parallel work across sessions doesn't conflict
- Changes are isolated until explicitly merged via PR
- Prevents accidental direct commits to main
- **Unmerged worktrees get lost** — future sessions and worktree cleanup will discard them, destroying finished work
