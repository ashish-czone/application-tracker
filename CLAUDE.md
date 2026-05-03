# Claude Code — Project Instructions

Read at the start of every conversation. Defines how you work in this codebase.

The full earlier version is preserved at `.claude/CLAUDE-archive-2026-05-03.md` for reference.

---

## CRITICAL: Never make architectural decisions automatically

When multiple approaches exist — especially when a choice involves bypassing established service layers, crossing package/module boundaries, introducing a pattern that doesn't exist yet, or trading "quick hack" for "proper implementation" — **stop, present options with trade-offs, ask explicitly, wait for an answer.**

Never default to the easiest approach. Even when one option seems obviously better, name the trade-offs and let the user choose. Architectural consistency in this platform codebase outweighs speed.

---

## Project goal

Build a **compliance app** on top of a reusable **platform** of libraries that handle cross-cutting concerns. The platform stays domain-agnostic so other apps (recruit, agency, marketing, …) can compose the same foundation.

## The four layers

```
apps/*               compose domains + own routing/screens (deployable units)
domains/*            self-contained business verticals (recruit, compliance, agency)
packages/addons/*    opt-in capabilities (entity-engine, workflows, automations, …)
packages/core/*      pure infra primitives (no NestJS surface)
packages/platform/*  NestJS-aware foundation (rbac, audit, auth, settings, …)
```

**Dependency direction is strict:** `apps → domains → addons → (core + platform)`. Domains never depend on other domains. Foundation never depends on addons (two documented exceptions: `app-shell` and `platform/testing` are integrators).

**Design principles:**
- **Library, not framework.** Public APIs are services and types you import. Apps own their NestJS modules and React routes.
- **Narrow foundation.** Cross-cutting concerns are abstracted *away* (decorator for RBAC, one line to emit an event). The cost of using core stays small.
- **Opt-in addons.** `defineEntity()` is one optional way to build an entity, not the central contract. Hand-written services + controllers are equally first-class.
- **Domain isolation.** A domain can be lifted into a different app without dragging another domain. Cross-domain wiring lives at the app layer (`apps/<app>/cross-domain/`).
- **Composition over configuration.** Hooks and registries exist only where cross-cutting demand is proven.

Every architectural decision asks: "Does this keep the foundation narrow and addons opt-in? Could a domain or app skip this capability entirely?" If no, the abstraction is too eager.

---

## Auto-loaded rules

Critical conventions live in `.claude/rules/*.md` and load automatically every conversation. **Read them.** They cover:

| File | Topic |
|---|---|
| `dependency-direction.md` | What may import what |
| `module-architecture.md` | File shape inside an entity-bearing module + camp-B helpers |
| `module-boundaries.md` | DB ownership, cross-module joins, shared identity tables |
| `data-fetching.md` | No `limit=1000`, no client-side joins, no JS filter derivation |
| `data-scoping.md` | `withScope(table, …)` mandatory on raw queries |
| `data-access-scope.md` | Actor-scope (row-level RBAC) via `buildPredicate` |
| `data-formatting.md` | Dates, money, phones, percentages, timezones |
| `event-conventions.md` | Naming, structure, audit registration |
| `workflow-entity-creates.md` | Workflow state is system-managed, never on create/update DTOs |
| `init-vs-seed.md` | `onModuleInit` is in-memory only; DB writes go to `cli/seed.ts` |
| `frontend-conventions.md` | No barrels, semantic tokens, `Form*` wrappers, TanStack Query |
| `branch-hygiene.md` | Branch from fresh `main` per feature |
| `use-worktrees.md` | Every change goes through a worktree |
| `pre-merge-checks.md` | Tests + builds + lint pipeline once before merge |
| `confirm-package-changes.md` | Pause and ask before editing `packages/*` |

When the auto-loaded rules conflict with this file, the rules win — they're the source of truth.

---

## Deep-reference prompts

`PROMPT.md`, `PROMPT-API.md`, `PROMPT-UI.md`, `PROMPT-TESTING.md`, `PROMPT-INFRA.md`, `PROMPT-AUTH.md` cover topics in depth. Read on demand:

| Task | Read |
|---|---|
| New backend module / first time on a backend pattern | `PROMPT.md`, `PROMPT-API.md`, `PROMPT-TESTING.md` |
| Frontend feature in unfamiliar territory | `PROMPT.md`, `PROMPT-UI.md`, `PROMPT-TESTING.md` |
| Infrastructure / deployment | `PROMPT-INFRA.md` |
| Auth changes | `PROMPT-AUTH.md` |

For routine changes to existing code, the auto-loaded rules + the existing code are sufficient.

---

## Workflow

Per `.claude/rules/use-worktrees.md` and `.claude/rules/branch-hygiene.md`:

1. **Plan.** Read relevant prompts and existing code. Break the feature into atomic tasks (each independently testable, one commit each). Present the plan and get approval before coding.
2. **Worktree.** `EnterWorktree` once per feature, then `git fetch origin main && git checkout -b <prefix>/<short-description> origin/main`.
3. **Implement → test → commit, per task.** Run only the tests directly relevant to the task. If they fail, fix before committing. **Auto-commit** each task — don't ask permission, but never combine tasks into one commit.
4. **Push → PR → merge.** After all tasks, run the full pre-merge checks (`.claude/rules/pre-merge-checks.md`), push the branch, open one PR for the feature, merge immediately. Multi-package features may use 2–3 intermediate PRs at natural seams.
5. **Exit worktree, pull main.** `ExitWorktree` with `action: "remove"`, then `git pull origin main` in the main checkout. **Never leave unmerged work in a worktree** — future sessions will lose it.
6. **Audit (after the final merge).** Spawn a supervisor agent to grep for stale references, boundary violations, broken imports, type drift, missing security tests, and PROMPT drift. Fix findings in a follow-up PR.

### Branch + commit conventions

- Prefixes: `feat/` `fix/` `chore/` `refactor/` `test/` `docs/`.
- Conventional commits: imperative mood, lowercase subject under 72 chars, body explains why, list key changes as bullets.
- One commit per task. One PR per feature. Never commit to `main`. Never amend or force-push without explicit ask.
- Code and its tests ship in the same commit.

---

## Mandatory pre-task checks

Before considering any task complete:

- Tests for the affected code are written and passing.
- Every new endpoint has security tests (401 + 403).
- No `console.log` — use the structured logger.
- No hardcoded colors — use semantic tokens.
- No raw HTML form elements — use `Form*` wrappers.
- No DB access outside the owning module's service layer (see `module-boundaries.md` for shared-identity exceptions).
- No side effects in domain services — emit events instead.
- Lint passes.

---

## What NOT to do (headlines)

The auto-loaded rules cover specifics; these are the headlines:

- **Don't make architectural decisions without asking.** See the CRITICAL rule above.
- **Don't create new packages** without discussing.
- **Don't skip tests.** Code + tests are one unit.
- **Don't read code superficially before changing it.** Understand first.
- **Don't make monolithic changes.** Atomic tasks, atomic commits.
- **Don't add domain logic to packages.** Packages are domain-agnostic.
- **Don't add new platform plumbing without solid reasoning.** Default to extending via services in `domains/*` or `apps/*`.
- **Don't decorate addons or feature modules with `@Global()`.** Reserved for kernel-tier infra.
- **Don't write to the DB in `onModuleInit`.** Boot lifecycle is in-memory only.
- **Don't accept workflow state on create/update DTOs.** Use `/transition`.
- **Don't bypass `withScope(...)` on raw queries.** Soft-delete + tenant + actor-scope are caller-side responsibilities once you leave the entity-engine.
- **Don't fetch with `limit=1000`** or join list endpoints client-side. Server-side filtering, sorting, pagination, joins are mandatory.
- **Don't use event listeners as a code-execution path.** Events are for side effects only; cross-module state mutation goes through direct service calls.
