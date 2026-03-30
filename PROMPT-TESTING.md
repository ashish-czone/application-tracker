# Testing Rules & Conventions

Testing stack, patterns, and coverage expectations.

---

## Tech Stack

- **Test runner:** Vitest (backend + frontend)
- **Backend integration:** `@nestjs/testing` + Supertest
- **Frontend components:** React Testing Library + happy-dom
- **E2E:** Playwright
- **Test data:** Factory functions with Faker.js
- **Database:** Real Postgres + Redis. Never mock the database.
- **No Jest. No Enzyme. No snapshot testing.**

---

## 1. Test Types & File Naming

| Type | Location | Naming |
|---|---|---|
| Unit | `services/__tests__/` | `candidatesService.unit.test.ts` |
| Integration (API) | `controllers/__tests__/` | `candidates.integration.test.ts` |
| Security | `controllers/__tests__/` | `candidates.security.test.ts` |
| Race condition | `controllers/__tests__/` | `candidates.race.test.ts` |
| Component | `components/__tests__/` | `CandidateForm.test.tsx` |
| E2E | `e2e/` | `candidates.spec.ts` |

---

## 2. Test Database Strategy

- Real Postgres + Redis. Never mock DB.
- Cleanup: truncate all tables `afterAll` each suite.
- No global seed data — each test creates what it needs via factories.
- **Exception:** RBAC structural data (roles + permissions) loaded once in global setup.
- Migrations: `drizzle-kit migrate` once in global setup.

---

## 3. Test Data Factories

Located in `test/factories/`. One per entity.

- `build()` → plain object (for request bodies). `create()` → inserts into DB.
- Every field has a default. Tests override only what matters.
- Use Faker.js for realistic data.
- Factories never depend on seed data.

---

## 4. Integration Test Pattern

Every endpoint follows: setup → request → assert response → assert DB state.

**Rules:**
1. Test app configured identically to production (same prefix, pipes, guards).
2. Verify both HTTP response AND DB state.
3. Test validation: missing fields, invalid formats, boundary values, unknown properties.
4. Use `tokenFor(identity)` helper for auth.

---

## 5. Security Test Pattern

Mandatory per endpoint. No exceptions.

**Checklist:**
- [ ] Unauthenticated → 401
- [ ] Expired token → 401
- [ ] Wrong role / missing permission → 403
- [ ] Resource ownership (if applicable) → 403
- [ ] Soft-deleted records → 404
- [ ] ID tampering → cannot access others' data
- [ ] Mass assignment → unknown fields rejected

**Password endpoints additionally:**
- [ ] Password never in API responses
- [ ] Stored as hash
- [ ] Wrong password → 401 (no info leak)
- [ ] Consistent timing for valid/invalid usernames
- [ ] Change requires current password

---

## 6. Race Condition Tests

Test concurrent access when:
- Uniqueness constraints, count/capacity checks before insert
- State transitions, shared counters/balances

Fire concurrent `Promise.all` requests. Assert exactly one succeeds. Verify DB state.

**Prevention:** DB unique constraints, optimistic locking (`version` column), pessimistic locking (`SELECT FOR UPDATE`), idempotency keys.

---

## 7. Event-Driven Code Tests

**Producers:** Mock event emitter. Verify correct event shape emitted. Verify no event on failure.

**Consumers:** Real DB for rule lookups, mock external I/O (queue, SMTP). Verify side effect produced. Test "no match" case (skip silently). Test idempotency for inline handlers.

Test producers and consumers separately.

---

## 8. Component Tests

- Query by role, label, text — never by test ID or CSS class.
- `userEvent` over `fireEvent`.
- Test what user sees: form validation, button states, conditional rendering.
- Mock API calls, not components.
- Skip simple display-only components.

---

## 9. E2E Tests (Playwright)

One spec per module. Every module with a UI gets:
- CRUD happy path
- Validation (invalid/missing data → error messages)
- RBAC (unauthorized → redirect/403)
- Search & filtering
- Pagination
- State transitions
- Cross-module interactions

**Platform-wide:** login/logout, invalid credentials, session expiry, RBAC redirect.

**Fixtures:** `e2e/fixtures/auth.fixture.ts` (loginAs helper), `e2e/fixtures/seed.ts` (global setup).

**Rules:** Tests independent (no order dependency). Use Playwright locators (`getByRole`, `getByLabel`). One spec per module.

---

## 10. Test Helpers

```
test/
  factories/          — One factory per entity
  utils/
    db.ts             — cleanDatabase()
    auth.ts           — tokenFor(), expiredTokenFor()
    app.ts            — createTestApp() (production-identical bootstrap)
  setup/
    globalSetup.ts    — migrations, RBAC seed
    globalTeardown.ts — close connections
```

---

## 11. What NOT to Test

Drizzle queries, NestJS decorators/pipes, simple CRUD with no business logic (integration covers it), simple display components, third-party libraries, implementation details.

---

## 12. Coverage & Enforcement

No hard percentage targets.

**Mandatory:**
- Auth (401) + RBAC (403) + validation (400) + happy path for every endpoint
- Race conditions for uniqueness/capacity endpoints
- E2E per module: CRUD, validation, RBAC, search/filter, pagination, state transitions

**Pre-merge:** All tests must pass. No `it.skip` / `describe.skip` — ever. Every PR with an endpoint includes integration + security tests. Every PR with a UI module includes E2E spec.
