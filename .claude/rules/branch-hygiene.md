---
name: branch-hygiene
description: Always start new work from a fresh branch off up-to-date main. Never commit to a stale or already-merged branch.
type: rule
---

Before starting a new **feature** (not each task within a feature):

1. **Check if the current branch is stale or already merged.** If you just merged a PR, the current local branch is dead — do not commit to it.
2. **Switch to main and pull:**
   ```
   git checkout main && git pull
   ```
   If in a worktree where main is locked, fetch and reset:
   ```
   git fetch origin main && git checkout -b <new-branch> origin/main
   ```
3. **Create a fresh branch from the updated main:**
   ```
   git checkout -b <prefix>/<short-description>
   ```
4. **Never reuse a branch that has already been merged.** Pushing to a merged branch does not update main — it creates orphaned commits.

This applies when starting a new feature. Within a feature flow, multiple tasks are committed sequentially to the same branch — do NOT create a new branch per task.
