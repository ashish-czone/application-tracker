## Event Conventions

### Naming
- Constants: `CANDIDATES_CANDIDATE_SUBMITTED` (UPPER_SNAKE_CASE)
- Values: `"candidates.CandidateSubmitted"` (dot-namespaced, PascalCase event name, past tense)
- Always exported constants, never magic strings

### Structure
All domain events extend `DomainEvent` from `packages/core/events/`:
```ts
{ eventName, entityType, entityId, actorId, correlationId, occurredAt, payload }
```

### Rules
- The emitting module owns the event definition (in `events/types.ts`)
- Side-effect packages subscribe generically via `DomainEvent` — they never import from app modules
- Side-effect handlers must be idempotent
- Handler failure never rolls back the domain operation
- Unreliable I/O (email, webhooks) → enqueue via `packages/platform/queue`, never inline
- Lightweight handlers (DB writes like audit-log) can run inline

### Audit logging
- Modules register auditable events with `AuditRegistryService` in `onModuleInit()`
- Update events must include `before`/`after` snapshots in payload
- Define a `Snapshot` interface and `toSnapshot()` method in the service
- Use `sensitiveFields` to redact passwords/tokens from audit logs
