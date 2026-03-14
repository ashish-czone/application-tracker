Launch a supervisor audit agent (using the Agent tool) to verify the codebase is standards-compliant and respects domain boundaries. The agent must check:

1. **Naming consistency** — grep the ENTIRE codebase for stale references to old naming patterns. Check types, delegates, route paths, factories, decorators, and variable names. Every rename should be fully propagated.

2. **Domain boundary violations** — each module should only access its own database tables. No module should import services or repositories from another module directly. Packages should use entity-agnostic delegate patterns.

3. **Import path correctness** — no broken imports pointing to moved/renamed files. Check both relative and aliased (`@modules/`, `@packages/`) import paths.

4. **Type safety** — exported types in package `index.ts` files must match what's defined in `types.ts`. No stale re-exports of renamed or deleted types.

5. **Test coverage** — all API endpoints have security tests (401 unauthenticated + 403 unauthorized). Test factories and helpers use correct terminology matching the current schema.

6. **Documentation drift** — PROMPT-*.md files reflect current code patterns (decorator names, factory names, type names, variable names in examples).

The agent should use grep/glob extensively across the entire codebase (not just recently changed files) and report findings as:
- PASS: [what was checked and passed]
- FAIL: [what failed, with file path and line number]
- WARNING: [potential issues worth noting]

After the audit report, fix all FAIL items in a new branch, commit, PR, and merge.
