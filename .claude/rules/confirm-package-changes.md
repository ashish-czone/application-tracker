## Confirm Before Modifying Platform / Package Code

Always pause and ask the user before editing any file under `packages/core/`, `packages/platform/`, `packages/addons/`, or any third-party dependency. Domain work in `apps/*` and `domains/*` does NOT need this confirmation.

### Why

`packages/*` is the stable substrate every app builds on. A change there ripples to every consumer — recruit, compliance, agency, future apps — and risks regressions in code paths unrelated to today's task. The goal is for platform + packages to be **stable and not need changes for domain work**. If your domain task seems to require a package edit, that's a signal to either (a) move the change into the domain, or (b) confirm the package edit is genuinely platform-worthy.

### How to apply

1. While planning, flag any file path under `packages/*` you intend to touch.
2. Present the change to the user with: what file, what change, why the domain alone can't satisfy the requirement.
3. Wait for explicit approval before editing.
4. This applies to ALL changes: features, refactors, bugfixes, docs, types — no "small change" exception.

### Allowed without confirmation

- Reading package code for understanding.
- Editing `apps/*` and `domains/*` (the domain layer is where customisation belongs).
- Edits inside a package the user just told you to modify in this session — the approval covers the scope they specified, not unrelated drive-by edits in the same package.
