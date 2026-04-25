# gen-entity

Scaffolds the per-entity controller / service / DTO / module set that
domain authors fork when adding a new entity, plus the
fully-derived-from-config `<entity>.dto.generated.ts` that the
generator rewrites idempotently every run.

## Usage

```bash
# First-time scaffold for a new entity (errors if any target file already exists)
pnpm gen:entity <entity> --domain <domain> --init

# Re-run on an existing entity to refresh derived files
pnpm gen:entity <entity> --domain <domain>
```

`<entity>` is the directory name under `domains/<domain>/api/`. The
entity config must already exist at
`domains/<domain>/api/<entity>/<entity>.config.ts` and export a
`<entity>Config` (or `<ENTITY>_CONFIG`) value.

## Output

Writes into `domains/<domain>/api/<entity>/`:

| File                              | Mode       | Notes                                            |
| --------------------------------- | ---------- | ------------------------------------------------ |
| `<entity>.dto.generated.ts`       | regenerable| Derived from Drizzle schema + cross-cutting fields. |
| `<entity>.module.ts`              | regenerable| Module DI wiring. Hand-edit if you need extra providers. |
| `<entity>.permissions.ts`         | regenerable| RBAC manifest (CRUD slugs).                      |
| `index.ts`                        | regenerable| Public barrel (module export).                   |
| `<entity>.dto.ts`                 | scaffold   | User-owned wrapper. Refinements live here.       |
| `<entity>.service.ts`             | scaffold   | Explicit composition lives here.                 |
| `<entity>.controller.ts`          | scaffold   | RBAC + zod-parse pass-through.                   |

In re-run mode, scaffold-only files are left alone; regenerable files
are rewritten in place. In `--init` mode, all seven files are written;
the run aborts if any of them already exists.

## Cross-cutting features

The generator inspects `fieldMeta` in the entity config to detect
fields that participate in cross-cutting subsystems and emits the
corresponding payload fields + composition lines:

- `fieldType: 'tags'` → emits `<key>: z.array(z.string().uuid()).optional()`
  in the DTO + `taxonomy.setTagsForEntityInGroup(...)` calls in the
  service. Each tag field needs `tagGroupSlug` declared on its meta.
- Other field types use the engine's row + EAV write path; no extra
  composition lines are emitted.

Multi-value fields (`multi_user`, `multi_lookup`) and other
addon-owned write hooks will be migrated to explicit composition in
follow-up PRs as those addons opt in.
