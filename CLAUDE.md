# Claude Code — Project Instructions

This file is read automatically at the start of every conversation. It defines how you work within this codebase.

---

## Project Prompts

This project has detailed architectural and coding prompts. **PROMPT.md is mandatory for every task** — it defines the modular architecture, dependency rules, event system, and database conventions that all code must follow.

| Task | Always read | Also read |
|---|---|---|
| Backend module/feature | PROMPT.md | PROMPT-API.md, PROMPT-TESTING.md |
| Frontend feature | PROMPT.md | PROMPT-UI.md, PROMPT-TESTING.md |
| Full-stack feature | PROMPT.md | PROMPT-API.md, PROMPT-UI.md, PROMPT-TESTING.md |
| Infrastructure/deployment | PROMPT.md | PROMPT-INFRA.md |
| Tests only | PROMPT.md | PROMPT-TESTING.md |

**Never write code without reading the relevant prompts first.** The prompts define architecture, conventions, data handling rules, and test patterns. Violating them creates inconsistency.

---

## Implementation Workflow

Every feature request follows this exact workflow. No shortcuts.

### Step 0: Ensure you are on `main`

Before starting any work, verify you are on the `main` branch with the latest changes:

```bash
git checkout main && git pull
```

**Never start a new feature branch from another feature branch.** Always branch from an up-to-date `main`.

### Step 1: Plan

Before writing any code:

1. Read the relevant prompts (see table above).
2. Read existing code that relates to the feature — understand what's there before changing it.
3. Break the feature into **atomic tasks**. Each task is independently testable and results in one commit.
4. Present the task breakdown to the user for approval before proceeding.

### Step 2: Implement → Test → Commit → PR → Merge (per task)

Work through tasks one at a time, in order. For each task:

```
Implement → Write tests → Run tests → Fix if failing → Commit → Push → Create PR → Merge to main
```

**After each task is done, immediately create a PR and merge it to `main`.** Do not accumulate multiple tasks on one branch. Each task gets its own branch, its own PR, and is merged before starting the next task.

Before starting the next task, switch back to `main` and pull:

```bash
git checkout main && git pull
```

**Never move to the next task until the current task's PR is merged.**

---

## Task Breakdown Pattern

Break features into these standard tasks. Skip tasks that don't apply. Never combine multiple tasks into one.

### Backend feature

| Task | What's included | Tests included |
|---|---|---|
| 1. Schema | Prisma schema + migration | — |
| 2. Service | Service layer + business logic | Unit tests |
| 3. API | Controller + DTOs + route wiring | Integration tests + security tests |
| 4. Events | Event types + emission in service + side-effect wiring | Race condition tests (if applicable) |

### Frontend feature

| Task | What's included | Tests included |
|---|---|---|
| 5. API layer | API functions + TanStack Query hooks | — |
| 6. Components | Feature components (forms, tables, cards) | Component tests (for complex components) |
| 7. Pages | Page containers + route wiring | — |

### Full-stack feature

Tasks 1–7 in order. Backend first, then frontend.

### Infrastructure change

For changes to Docker, CI/CD, environment config — not feature code.

| Task | What's included | Verification |
|---|---|---|
| 1. Config | Docker Compose / Dockerfile / CI pipeline / env files | Build images, start services, verify health checks pass |
| 2. Document | Update `.env.example` if env vars changed, update PROMPT-INFRA.md if architecture changed | — |

### Each task must be:

- **Independently reviewable** — the commit makes sense on its own.
- **Testable** — if the task includes logic, it includes tests.
- **Small** — if a task feels large, split it further.

---

## Git Flow

### Branch naming

```
feat/short-description      — new feature
fix/short-description       — bug fix
chore/short-description     — refactoring, config, dependencies
```

Create the feature branch before the first commit:

```bash
git checkout -b feat/add-candidate-submission
```

### Commit convention

Use Conventional Commits format:

```
feat: add candidate submission service

- Add submitCandidate method with order validation
- Emit CANDIDATES_CANDIDATE_SUBMITTED event
- Add unit tests for submission logic
```

Prefix types:

| Prefix | When |
|---|---|
| `feat` | New feature or functionality |
| `fix` | Bug fix |
| `refactor` | Code restructure with no behavior change |
| `test` | Adding or fixing tests only |
| `chore` | Config, dependencies, tooling |
| `docs` | Documentation only |

Rules:
- Subject line: imperative mood, lowercase, no period, under 72 characters.
- Body: describe what and why, not how. List key changes as bullet points.
- **Auto-commit after each task.** Do not ask for permission — commit immediately when tests pass.

### Pull requests

Each task gets its own PR, created and merged immediately after the task is done:

1. Push the branch: `git push -u origin feat/add-candidate-submission`
2. Create PR with a summary of the task's changes.
3. PR title follows the same conventional format: `feat: add candidate submission`
4. Merge the PR to `main` immediately.
5. Switch back to `main` and pull before starting the next task.

### Rules

- **Never commit directly to `main`.** Always use a feature branch.
- **Never force-push** unless explicitly asked.
- **Never amend a commit** unless explicitly asked. Create new commits.
- **Code and tests are committed together** — never commit code in one commit and its tests in another.
- **Always start from `main`.** Every new task branches from an up-to-date `main`, never from another feature branch.
- **Merge PRs immediately.** Do not wait for all tasks to finish — merge each PR as soon as its task is complete.

---

## Mandatory Checks

Before considering any task complete, verify:

- [ ] Code follows the relevant prompt conventions (architecture, API, UI)
- [ ] Tests are written and passing
- [ ] Security tests exist for every new endpoint (401 + 403)
- [ ] No `console.log` in production code — use structured logger
- [ ] No hardcoded colors — use semantic tokens
- [ ] No raw HTML form elements — use `Form*` wrappers from `@packages/ui`
- [ ] No database access outside the owning module's service layer
- [ ] No side effects in domain services — emit events instead
- [ ] Lint passes

---

## What NOT to Do

- **Don't create new packages without discussing.** Most things belong in existing modules/packages.
- **Don't skip tests.** Code + tests are one unit. "I'll add tests later" is not acceptable.
- **Don't write code without reading existing code first.** Understand the codebase before modifying it.
- **Don't make large, monolithic changes.** Break into atomic tasks and commit each one.
- **Don't guess at architecture decisions.** If unsure, ask. Reference the prompts.
- **Don't add dependencies without justification.** Check if the need is already covered by the existing stack.
- **Don't deviate from the data handling rules.** Dates, currency, phone numbers, emails, passwords, percentages, and timezones all have specific storage/display rules defined in the prompts.
