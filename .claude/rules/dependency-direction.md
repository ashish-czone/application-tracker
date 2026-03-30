## Dependency Direction

Strictly enforced. Violations are build errors.

```
apps/api     →  packages/*
apps/web     →  packages/*
packages/*   →  other infrastructure packages only. NEVER import from apps/
```

- Backend modules (`apps/api/src/modules/`) may import other modules' **public API** (`index.ts`) — no circular deps.
- Frontend (`apps/web/src/`) imports from `packages/ui`, `packages/*-ui`, and `packages/common`. Never from backend modules.
- **Never import from backend modules in frontend code.** The API is the boundary. Frontend defines its own types.

### When to use direct calls vs events

| Scenario | Mechanism |
|---|---|
| Module A needs data/action from Module B | Direct call to B's public service API |
| Something happened, side effects should follow | Domain event via `emit()` |

**Rule:** Caller needs the result or cares about failure → direct call. Caller doesn't care who listens → event.
