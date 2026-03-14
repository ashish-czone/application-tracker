# Testing Rules & Conventions

This document defines the testing stack, test types, patterns, and coverage expectations. Follow every instruction exactly.

---

## Tech Stack

- **Test runner:** Vitest (backend + frontend — one runner, one config pattern)
- **Backend integration:** Vitest + `@nestjs/testing` + Supertest
- **Frontend components:** Vitest + React Testing Library + happy-dom
- **E2E:** Playwright (critical flows only)
- **Test data:** Factory functions with Faker.js
- **Database:** Real Postgres + Redis in all tests. Never mock the database.
- **No Jest. No Enzyme. No snapshot testing.**

---

## 1. Test Types

### Unit tests

Pure business logic in service methods — validation, calculations, state transitions, conditional branching. Mock external dependencies (other module services, event emitter) but never mock the database.

```
modules/candidates/services/__tests__/candidatesService.unit.test.ts
```

### Integration tests (API)

Full HTTP request through the stack: controller → service → DB → response. Every endpoint gets integration tests. These are the highest-value tests in the codebase.

```
modules/candidates/controllers/__tests__/candidates.integration.test.ts
```

### Security tests

Verify auth and RBAC on every endpoint. These are mandatory — not optional, not sampled. Every route is tested for:

- Unauthenticated access → 401
- Wrong role/missing permission → 403
- Resource ownership where applicable → 403

```
modules/candidates/controllers/__tests__/candidates.security.test.ts
```

### Race condition tests

Concurrent mutations on shared resources. Every create/update endpoint that could be hit simultaneously gets a concurrency test.

```
modules/candidates/controllers/__tests__/candidates.race.test.ts
```

### Component tests

Complex interactive UI — forms with validation, tables with sorting/filtering, multi-step flows, conditional rendering based on permissions. Skip simple display-only components.

```
features/candidates/components/__tests__/CandidateForm.test.tsx
```

### E2E tests (Playwright)

Only the most critical user flows. Not comprehensive. These protect against full-stack integration regressions that other test types miss.

```
e2e/auth.spec.ts
e2e/candidate-submission.spec.ts
```

Typical E2E scope:

- Login → session → logout
- Core CRUD happy path (create → read → update → delete) for the primary entity
- RBAC redirect (unauthorized user tries protected page → redirected)
- One or two critical business flows specific to the application

---

## 2. File Naming & Location

### Backend

Tests live next to the code they test, inside a `__tests__/` directory:

```
modules/candidates/
  controllers/
    __tests__/
      candidates.integration.test.ts
      candidates.security.test.ts
      candidates.race.test.ts
    candidatesController.ts
  services/
    __tests__/
      candidatesService.unit.test.ts
    candidatesService.ts
```

### Frontend

Same pattern — `__tests__/` next to the source:

```
features/candidates/
  components/
    __tests__/
      CandidateForm.test.tsx
      CandidateTable.test.tsx
    CandidateForm.tsx
    CandidateTable.tsx
```

### E2E

Top-level `e2e/` directory, separate from unit/integration tests:

```
e2e/
  auth.spec.ts
  candidate-submission.spec.ts
  playwright.config.ts
```

### Naming convention

- Backend: `<name>.<type>.test.ts` — `candidates.integration.test.ts`, `candidatesService.unit.test.ts`
- Frontend: `<ComponentName>.test.tsx`
- E2E: `<flow-name>.spec.ts`

---

## 3. Test Database Strategy

### Real database, no mocks

All integration and security tests run against a real Postgres and Redis instance. CI provides these as service containers (see PROMPT-INFRA.md). Never mock the database — mock/prod divergence masks real bugs.

### Cleanup via truncation

After each test suite (file), truncate all tables. This is fast and ensures full isolation between suites.

```ts
// test/utils/db.ts
export async function cleanDatabase(prisma: PrismaClient) {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;
  for (const { tablename } of tables) {
    if (tablename !== '_prisma_migrations') {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE`);
    }
  }
}
```

```ts
// In test files
afterAll(async () => {
  await cleanDatabase(prisma);
});
```

### No global seed data

Each test creates exactly what it needs using factories. No shared seed that creates hidden coupling between tests.

**One exception:** RBAC structural data (roles + permissions) is needed by almost every test and rarely changes. Load it once in a global setup file:

```ts
// test/setup/rbac.ts
export async function seedRbac(prisma: PrismaClient) {
  // Insert standard roles and permissions
  // This runs once before all test suites
}
```

```ts
// vitest.config.ts (global setup)
globalSetup: ['./test/setup/globalSetup.ts'],
```

### Migrations

Run `prisma migrate deploy` once before the test suite starts (in global setup), not per test file.

---

## 4. Test Data Factories

Factories create test entities with sensible defaults. Every field has a default — tests override only what matters for the specific assertion.

```ts
// test/factories/candidateFactory.ts
import { faker } from '@faker-js/faker';

export const CandidateFactory = {
  build(overrides: Partial<CreateCandidateInput> = {}) {
    return {
      name: faker.person.fullName(),
      email: faker.internet.email(),
      phone: faker.phone.number(),
      status: 'active',
      ...overrides,
    };
  },

  async create(prisma: PrismaClient, overrides: Partial<CreateCandidateInput> = {}) {
    return prisma.candidate.create({
      data: this.build(overrides),
    });
  },
};
```

### Rules

1. **Factories live in `test/factories/`.** One factory per entity.
2. **`build()` returns a plain object** (for request bodies). **`create()` inserts into DB** (for test setup).
3. **Every field has a default.** Tests only override what's relevant to the assertion. This keeps tests readable — you see exactly what the test cares about.
4. **Use Faker.js for realistic data.** Not `"test"`, `"foo"`, `"user1@email.com"`. Realistic data catches edge cases (special characters, long names).
5. **Factories never depend on seed data.** If a candidate needs an order, the test creates the order explicitly or the factory accepts it as a parameter.

---

## 5. Integration Test Pattern

Every API endpoint follows this structure:

```ts
describe('POST /api/v1/candidates', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    // Apply the same pipes, guards, interceptors as production
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = module.get(PrismaClient);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  describe('happy path', () => {
    it('should create a candidate and return 201', async () => {
      const identity = await IdentityFactory.createWithRole(prisma, 'recruiter');
      const body = CandidateFactory.build();

      const res = await request(app.getHttpServer())
        .post('/api/v1/candidates')
        .set('Authorization', `Bearer ${tokenFor(identity)}`)
        .send(body);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        name: body.name,
        email: body.email,
      });

      // Verify DB state
      const saved = await prisma.candidate.findUnique({ where: { id: res.body.id } });
      expect(saved).not.toBeNull();
      expect(saved!.name).toBe(body.name);
    });
  });

  describe('validation', () => {
    it('should return 400 for missing required fields', async () => {
      const identity = await IdentityFactory.createWithRole(prisma, 'recruiter');

      const res = await request(app.getHttpServer())
        .post('/api/v1/candidates')
        .set('Authorization', `Bearer ${tokenFor(identity)}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'name' }),
          expect.objectContaining({ field: 'email' }),
        ]),
      );
    });

    it('should return 400 for unknown properties', async () => {
      const identity = await IdentityFactory.createWithRole(prisma, 'recruiter');
      const body = { ...CandidateFactory.build(), hackerField: 'injected' };

      const res = await request(app.getHttpServer())
        .post('/api/v1/candidates')
        .set('Authorization', `Bearer ${tokenFor(identity)}`)
        .send(body);

      expect(res.status).toBe(400);
    });
  });
});
```

### Rules

1. **Configure the test app identically to production.** Same global prefix, pipes, guards, interceptors. Tests that skip production middleware give false confidence.
2. **Verify both the HTTP response AND the DB state.** A 201 response means nothing if the data wasn't actually persisted correctly.
3. **Test validation thoroughly.** Missing fields, invalid formats, boundary values (min/max length), unknown properties (should be rejected by `forbidNonWhitelisted`).
4. **Use a `tokenFor(identity)` helper** that generates a valid JWT for any test user. Never hardcode tokens.

---

## 6. Security Test Pattern

Security tests are checklisted per endpoint. Every endpoint must have these tests. No exceptions.

```ts
describe('POST /api/v1/candidates — security', () => {
  it('should return 401 without auth token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/candidates')
      .send(CandidateFactory.build());

    expect(res.status).toBe(401);
  });

  it('should return 401 with expired token', async () => {
    const identity = await IdentityFactory.createWithRole(prisma, 'recruiter');

    const res = await request(app.getHttpServer())
      .post('/api/v1/candidates')
      .set('Authorization', `Bearer ${expiredTokenFor(identity)}`)
      .send(CandidateFactory.build());

    expect(res.status).toBe(401);
  });

  it('should return 403 without candidates.create permission', async () => {
    const identity = await IdentityFactory.createWithRole(prisma, 'viewer');

    const res = await request(app.getHttpServer())
      .post('/api/v1/candidates')
      .set('Authorization', `Bearer ${tokenFor(identity)}`)
      .send(CandidateFactory.build());

    expect(res.status).toBe(403);
  });

  it('should not expose soft-deleted records', async () => {
    const identity = await IdentityFactory.createWithRole(prisma, 'recruiter');
    const candidate = await CandidateFactory.create(prisma, {
      deletedAt: new Date(),
    });

    const res = await request(app.getHttpServer())
      .get(`/api/v1/candidates/${candidate.id}`)
      .set('Authorization', `Bearer ${tokenFor(identity)}`);

    expect(res.status).toBe(404);
  });
});
```

### Security checklist (per endpoint)

- [ ] Unauthenticated → 401
- [ ] Expired token → 401
- [ ] Wrong role / missing permission → 403
- [ ] Resource ownership (if applicable) → 403 for other users' resources
- [ ] Soft-deleted records → 404 (not leaked)
- [ ] ID tampering → cannot access/modify another user's data by guessing UUIDs
- [ ] Mass assignment → unknown fields rejected (covered by `forbidNonWhitelisted`)

### Password handling tests

Any endpoint that accepts or returns user data must verify:

- [ ] Password is never included in API responses (GET user, GET users list, login response)
- [ ] Password is hashed in DB — verify stored value is not plain text after registration
- [ ] Login with wrong password returns 401, not a different error that leaks information
- [ ] Timing is consistent for valid vs invalid usernames (prevent user enumeration)
- [ ] Password change requires current password

```ts
it('should never return password in user response', async () => {
  const res = await request(app.getHttpServer())
    .get('/api/v1/auth/me')
    .set('Authorization', `Bearer ${tokenFor(identity)}`);

  expect(res.body).not.toHaveProperty('password');
  expect(res.body).not.toHaveProperty('passwordHash');
});

it('should store password as hash, not plain text', async () => {
  await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({ email: 'test@example.com', password: 'SecurePass123!' });

  const dbUser = await prisma.user.findUnique({ where: { email: 'test@example.com' } });
  expect(dbUser!.passwordHash).not.toBe('SecurePass123!');
});
```

---

## 7. Race Condition Test Pattern

Test concurrent access to shared resources. These catch bugs that only appear under load.

```ts
describe('POST /api/v1/candidates/:id/submit — race conditions', () => {
  it('should not double-submit a candidate to the same order', async () => {
    const identity = await IdentityFactory.createWithRole(prisma, 'recruiter');
    const order = await OrderFactory.create(prisma);
    const candidate = await CandidateFactory.create(prisma);

    // Fire two identical requests concurrently
    const [res1, res2] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/candidates/${candidate.id}/submit`)
        .set('Authorization', `Bearer ${tokenFor(identity)}`)
        .send({ orderId: order.id }),
      request(app.getHttpServer())
        .post(`/api/v1/candidates/${candidate.id}/submit`)
        .set('Authorization', `Bearer ${tokenFor(identity)}`)
        .send({ orderId: order.id }),
    ]);

    // Exactly one should succeed, the other should fail
    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 409]);

    // Verify only one submission exists in DB
    const submissions = await prisma.submission.findMany({
      where: { candidateId: candidate.id, orderId: order.id },
    });
    expect(submissions).toHaveLength(1);
  });

  it('should not exceed order capacity under concurrent submissions', async () => {
    const identity = await IdentityFactory.createWithRole(prisma, 'recruiter');
    const order = await OrderFactory.create(prisma, { capacity: 1 });
    const candidates = await Promise.all(
      Array.from({ length: 5 }, () => CandidateFactory.create(prisma)),
    );

    const results = await Promise.all(
      candidates.map((c) =>
        request(app.getHttpServer())
          .post(`/api/v1/candidates/${c.id}/submit`)
          .set('Authorization', `Bearer ${tokenFor(identity)}`)
          .send({ orderId: order.id }),
      ),
    );

    const successes = results.filter((r) => r.status === 200);
    expect(successes).toHaveLength(1);
  });
});
```

### When to write race condition tests

- Any endpoint that creates a record with a uniqueness constraint
- Any endpoint that checks a count/capacity before inserting
- Any endpoint that transitions state (status changes, submissions, approvals)
- Any endpoint that modifies a shared counter or balance

### How to prevent race conditions in code

- **Unique constraints in DB** — the last line of defense. Always add them.
- **Optimistic locking** — use a `version` column. `UPDATE ... WHERE id = ? AND version = ?`.
- **Pessimistic locking** — `SELECT ... FOR UPDATE` in a transaction for critical sections.
- **Idempotency keys** — client sends a unique key per request. Server deduplicates.

---

## 8. Event-Driven Code Test Pattern

### Testing event producers

When a service emits domain events, verify the right event was emitted with the correct payload. Mock the event emitter — don't test side-effect handlers here.

```ts
describe('candidatesService.submitCandidate — events', () => {
  it('should emit CANDIDATES_CANDIDATE_SUBMITTED with correct payload', async () => {
    const order = await OrderFactory.create(prisma);
    const candidate = await CandidateFactory.create(prisma);

    await candidatesService.submitCandidate(
      { candidateId: candidate.id, orderId: order.id },
      user.id,
    );

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      CANDIDATES_CANDIDATE_SUBMITTED,
      expect.objectContaining({
        eventName: CANDIDATES_CANDIDATE_SUBMITTED,
        entityType: 'candidate',
        entityId: candidate.id,
        actorId: user.id,
        correlationId: expect.any(String),
        payload: expect.objectContaining({
          orderId: order.id,
        }),
      }),
    );
  });

  it('should not emit event if domain operation fails', async () => {
    await expect(
      candidatesService.submitCandidate(
        { candidateId: 'nonexistent', orderId: 'nonexistent' },
        user.id,
      ),
    ).rejects.toThrow();

    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
```

### Testing event consumers

When a listener handles domain events, verify it produces the expected side effect. Use a real DB but mock external services (queue, SMTP, etc.).

```ts
describe('notificationListener.handleAnyEvent', () => {
  it('should enqueue a job when matching rules exist', async () => {
    // Setup: create a notification rule that matches the event
    await NotificationRuleFactory.create(prisma, {
      eventName: CANDIDATES_CANDIDATE_SUBMITTED,
      templateId: 'submission-email',
    });

    const event: DomainEvent = {
      eventName: CANDIDATES_CANDIDATE_SUBMITTED,
      entityType: 'candidate',
      entityId: 'candidate-1',
      actorId: 'user-1',
      correlationId: 'req-123',
      occurredAt: new Date().toISOString(),
      payload: { orderId: 'order-1' },
    };

    await listener.handleAnyEvent(event);

    expect(queueService.enqueue).toHaveBeenCalledWith(
      'notification.send',
      expect.objectContaining({
        templateId: 'submission-email',
        event,
      }),
    );
  });

  it('should skip silently when no rules match', async () => {
    const event: DomainEvent = {
      eventName: 'some.UnknownEvent',
      entityType: 'unknown',
      entityId: 'id-1',
      actorId: 'user-1',
      correlationId: 'req-456',
      occurredAt: new Date().toISOString(),
      payload: {},
    };

    await listener.handleAnyEvent(event);

    expect(queueService.enqueue).not.toHaveBeenCalled();
  });
});
```

### Rules

1. **Test producers and consumers separately.** Producers verify the event shape. Consumers verify the reaction. Don't wire them together in unit/integration tests.
2. **Mock the event emitter in producer tests.** You're testing that the service emits correctly, not that handlers react.
3. **Mock external I/O in consumer tests.** Use a real DB for rule lookups, but mock the queue/SMTP/webhook calls.
4. **Test the "no match" case.** Consumers must handle events they have no rules for — verify they skip silently without errors.
5. **Test idempotency for consumers that do inline work** (e.g., activity-log writes). Calling the handler twice with the same event should not create duplicate entries.

---

## 9. Component Test Pattern

Test user interaction behavior, not implementation details. Never test internal state, never query by CSS class, never assert on DOM structure.

```tsx
describe('CandidateForm', () => {
  it('should show validation errors on submit with empty fields', async () => {
    const onSubmit = vi.fn();
    render(<CandidateForm onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('button', { name: /create/i }));

    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('should call onSubmit with form data when valid', async () => {
    const onSubmit = vi.fn();
    render(<CandidateForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/name/i), 'John Doe');
    await userEvent.type(screen.getByLabelText(/email/i), 'john@example.com');
    await userEvent.click(screen.getByRole('button', { name: /create/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'John Doe',
        email: 'john@example.com',
      }),
    );
  });

  it('should disable submit button while submitting', async () => {
    const onSubmit = vi.fn(() => new Promise(() => {})); // never resolves
    render(<CandidateForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/name/i), 'John Doe');
    await userEvent.type(screen.getByLabelText(/email/i), 'john@example.com');
    await userEvent.click(screen.getByRole('button', { name: /create/i }));

    expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
  });
});
```

### Rules

1. **Query by role, label, or text** — never by test ID, CSS class, or DOM structure.
2. **Use `userEvent` over `fireEvent`** — it simulates real user interaction (focus, type, blur).
3. **Test what the user sees and does** — form validation, button states, conditional rendering, error messages.
4. **Mock API calls, not components.** Use `msw` (Mock Service Worker) or vi.mock the API layer. Never mock child components.
5. **Skip tests for simple display components** that just render props. Test the complex ones — forms, tables with filters, permission-gated UI.

---

## 10. E2E Test Pattern (Playwright)

E2E tests cover critical user flows end-to-end. They run against a fully deployed stack (API + web + DB + Redis).

```ts
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should login and redirect to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText('Welcome')).toBeVisible();
  });

  test('should redirect unauthenticated user to login', async ({ page }) => {
    await page.goto('/candidates');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show session expired modal after token expiry', async ({ page }) => {
    // Login, then invalidate tokens, then navigate
    // Assert modal appears without immediate redirect
  });
});
```

### Rules

1. **Only test critical flows.** Auth, core CRUD, RBAC redirect, one or two business-critical flows. Not every feature.
2. **Use a seeded test environment.** E2E tests run against a known state — seed specific users and data before the suite.
3. **Tests must be independent.** Each test sets up its own preconditions. Never depend on execution order.
4. **Use Playwright locators** — `getByRole`, `getByLabel`, `getByText`. Same philosophy as React Testing Library.
5. **Run E2E in CI but not on every push.** Run on merge to main or on a schedule. They're slow and flaky-prone.

---

## 11. Test Helpers & Utilities

Shared test utilities live in `test/` at the root:

```
test/
  factories/
    identityFactory.ts
    candidateFactory.ts
    orderFactory.ts
  utils/
    db.ts              # cleanDatabase()
    auth.ts            # tokenFor(identity), expiredTokenFor(identity)
    app.ts             # createTestApp() — bootstraps NestJS with production config
  setup/
    globalSetup.ts     # runs migrations, seeds RBAC
    globalTeardown.ts  # closes connections
```

### `createTestApp()` helper

Avoids duplicating app bootstrap in every test file:

```ts
// test/utils/app.ts
export async function createTestApp() {
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = module.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();

  return {
    app,
    prisma: module.get(PrismaClient),
    httpServer: app.getHttpServer(),
  };
}
```

---

## 12. What NOT to Test

- **Prisma queries** — you're testing the ORM, not your code.
- **NestJS decorators and pipes** — framework internals. Trust them.
- **Simple CRUD with no business logic** — if the service just calls `prisma.create()` and returns the result, the integration test covers it. No separate unit test needed.
- **Simple display components** — a component that renders props has nothing to test.
- **Third-party libraries** — don't test that `date-fns` formats dates correctly.
- **Implementation details** — internal method calls, state shape, render counts.

---

## 13. Coverage Expectations

No hard percentage targets. Coverage metrics incentivize testing trivial code while skipping the hard parts.

### Mandatory coverage

| Category | Requirement |
|---|---|
| Auth (401) | Every endpoint tested for unauthenticated access |
| RBAC (403) | Every endpoint tested with wrong role |
| Validation (400) | Every POST/PATCH endpoint tested with invalid input |
| Happy path | Every endpoint has at least one success case |
| Race conditions | Every endpoint with uniqueness/capacity constraints |
| E2E | Auth flow + core business flow |

### CI enforcement

- All tests must pass. No exceptions.
- No `it.skip` on security tests — lint rule to catch this.
- Coverage report is generated and uploaded as a PR artifact for review. **No minimum threshold gate.**

### PR discipline

- Every PR that adds an endpoint also adds its integration + security tests.
- Every PR that fixes a bug adds a regression test proving the fix.
- Tests are reviewed with the same scrutiny as production code.
