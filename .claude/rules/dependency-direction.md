## Dependency Direction

Strictly enforced. Violations are build errors.

```
apps/*               →  packages/{core,platform,addons}/* + domains/*
domains/*            →  packages/{core,platform,addons}/*
                        NEVER other domains
                        NEVER apps/*
packages/addons/*    →  packages/core/* + packages/platform/* + other addons
packages/platform/*  →  packages/core/* + other platform packages
                        EXCEPTION: app-shell may import from addons (it is the
                        integrator that wires every package into a runnable app)
packages/core/*      →  other core packages only. NEVER import from apps/ or domains/
```

**Addon → addon imports are allowed.** Some addons (workflows, automations, ...) are foundational enough that other addons depend on them at runtime. The only constraint is that the dependency graph stays acyclic — no circular addon imports.

**`packages/platform/app-shell` is the documented exception** to the platform → addon rule. App-shell's job is to wire every module (core + platform + addon + domain) into a `NestModule`/`AppRouter`; it has no kernel-tier code of its own. No other platform package may import from addons.

**Domain packages** (`domains/*`) are self-contained verticals. They are consumed by apps, never by packages, and never by other domains. If two domains genuinely need a shared concept, that concept graduates to a platform package — it does not get copied between domains and it does not create a domain-to-domain dependency. Apps import only domain manifests, never a domain's internal files; the manifest is the public API of a domain.

- Backend modules (`apps/api/src/modules/`) may import other modules' **public API** (`index.ts`) — no circular deps.
- Frontend (`apps/web/src/`) imports from `packages/core/ui`, `packages/{platform,addons}/*-ui`, and `packages/core/common`. Never from backend modules.
- **Never import from backend modules in frontend code.** The API is the boundary. Frontend defines its own types.

### When to use direct calls vs events

| Scenario | Mechanism |
|---|---|
| Module A needs data/action from Module B | Direct call to B's public service API |
| Something happened, side effects should follow | Domain event via `emit()` |

**Rule:** Caller needs the result or cares about failure → direct call. Caller doesn't care who listens → event.
