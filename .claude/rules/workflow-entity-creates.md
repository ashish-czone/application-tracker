## Workflow-Bearing Entity Creates

Workflow state fields are **system-managed**. They are not user-supplied input on create or update. The workflow definition is the only description of which states an entity can be in and how it gets there — every state change goes through the engine.

### The rule

For any entity whose state field is governed by a `defineWorkflow(...)` (registered via `WorkflowsModule.forFeature(...)`):

1. **The workflow field MUST NOT appear in the create or update DTO.** Callers cannot supply it. Even if they try, Zod's `.pick({...})` strips the key silently — the column persists as `NULL`. Don't pick it.
2. **The service's `create(...)` MUST pre-fill the workflow field with `WORKFLOW.initialState`.** Do this unconditionally, not as a fallback. The caller cannot override.
3. **State changes after create go ONLY through `POST /<entity>/:id/transition`.** That endpoint runs guards, checks `requiredPermissions`, enforces `reasonRequired` / `commentRequired`, validates the legality of the move against the workflow, and writes a `workflow_transition_history` row.
4. **`update(...)` MUST NOT mutate the workflow field either.** Same exclusion from the update DTO. Generic update is for non-state fields; state changes go through `/transition`.
5. **The response shape MAY expose an external alias for the field** (e.g. response `status` derived from column `complianceStatus`) for back-compat with consumers that don't follow storage renames. The alias lives only in the response — never on the input side.

### Why

Each individual gate the workflow provides depends on entry-via-transition:

- **Audit trail integrity.** Every state change writes a `workflow_transition_history` row. If creates can land an entity in any state, that entity's history starts mid-graph. Reading history later means handling "started here" and "walked to here" as separate cases — and forgetting somewhere always leaks the inconsistency.
- **Permissions actually gate.** Transition rows can specify `requiredPermissions` (`clients.dormantise`, `compliance-rules.deprecate`). The moment a `POST /<entity>` body accepts the workflow field, a user with only `<entity>.create` can land in any state — bypassing the gate entirely.
- **Guards actually run.** Per-entity guards (`require-primary-contact` blocking `onboarding → active`, etc.) are invoked from the transition path. Direct creates skip them.
- **Reason / comment requirements actually fire.** Transitions marked `reasonRequired + commentRequired` exist because the side effects of that transition warrant explanation in the audit log. Creates that set the destination state directly skip the requirement.
- **The state machine becomes the contract.** The workflow definition is the source of truth for which states are reachable from which. If create can drop you anywhere in the graph, the definition is decorative — it describes the legal moves but not all of them.

These reasons stack. Every additional consumer of the workflow definition (audit log, permission gate, guard, requiredReason) silently leaks correctness when one path bypasses it.

### How to apply

For a new entity with a workflow:

```ts
// 1) <entity>.dto.ts — exclude the workflow field from create + update picks
export const CreateThingSchema = createInsertSchema(things).pick({
  name: true, ownerId: true, ...
  // status: NOT picked — system-managed by the workflow
});
export const UpdateThingSchema = CreateThingSchema.partial();

// 2) <entity>.service.ts — apply initialState unconditionally on create
import { THING_WORKFLOW } from './thing.workflow';

create(input: Record<string, unknown>, actorId: string) {
  return this.entityService.create(
    { ...input, status: THING_WORKFLOW.initialState },
    actorId,
  );
}
```

For an existing entity with a renamed storage column (e.g. `complianceStatus` exposed externally as `status`):

```ts
// Response transform exposes the public alias; input side does not.
private toResponse(row: ThingRow): ThingResponse {
  return {
    ...row,
    status: row.complianceStatus,  // alias for back-compat consumers
  };
}
```

### Bulk imports / migrations / seeds

These are the only paths that legitimately need to write a workflow field at non-initial state:

- **CLI seed scripts** (`apps/<app>/src/cli/seed.ts`) — run once, with an explicit operator. Write the column directly via the database service. If audit history matters for the seeded data, write the corresponding `workflow_transition_history` row in the same transaction.
- **Admin-only bulk import endpoints** (`POST /admin/<entity>/import` behind `*` permission) — when the product genuinely supports importing real-world data at its current state. Write the rows directly, write history rows directly, document the bypass.

These are deliberate and rare. They are not the regular create endpoint with a flag.

### Test convention

Tests creating workflow-bearing entities should NOT pass the workflow field. They should assert the server applied the initial state:

```ts
const thing = await apiClient.post('/things', { name: 'X', ownerId: u });
expect(thing.status).toBe(THING_WORKFLOW.initialState);
```

A test that sends `status: 'active'` on create is exercising a path that shouldn't exist. Update the test, not the API.
