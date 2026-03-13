# Auth System — Backend Implementation Plan

## Context

Auth is the first real feature being built. No code exists yet. The monorepo foundation (Task 0) is included as prerequisite. Frontend auth deferred to a separate plan.

Auth must be complete before RBAC, which must be complete before taxonomy.

## Structure

Domain logic lives inside each app, not at the top level:

```
starter-template/
  apps/
    api/
      src/
        modules/                  # backend domain modules
          users/                  # owns User entity + auth wiring
          admin/                  # admin config, taxonomy CRUD later
        main.ts
        app.module.ts
    web/
      src/
        modules/                  # frontend domain modules
  packages/                       # shared, domain-agnostic
    auth/
    auth-nestjs/
    database/
    common/
    events/
```

- `pnpm-workspace.yaml`: only `apps/*` and `packages/*`
- `collect-schemas.js` scans `apps/api/src/modules/` and `packages/`
- Backend modules are plain folders (not workspace packages)
- Cross-module boundaries enforced by NestJS DI, not package manager

## Package Split

- `packages/auth` — Pure logic (no NestJS, no Prisma): hashing, tokens, types, delegate interfaces
- `packages/auth-nestjs` — NestJS integration: guards, decorators, controllers, DTOs, service, dynamic module

Controllers + DTOs live in `packages/auth-nestjs` because they're generic platform infrastructure parameterized by config. The consuming module (`apps/api/src/modules/users`) only calls `AuthNestjsModule.registerAsync()`.

---

## Tasks

Each task = branch → implement → commit → PR → merge → next task.

### Task 0: Monorepo Foundation (backend only)
**Branch:** `chore/monorepo-foundation`

**Files:**
```
package.json                            # root workspace
pnpm-workspace.yaml                     # apps/*, packages/*
turbo.json                              # db:generate, build, dev, lint, test
tsconfig.base.json                      # strict mode
.gitignore, .prettierrc, .eslintrc.cjs

packages/database/
  package.json                          # @packages/database
  tsconfig.json
  prisma/schema/base.prisma             # datasource postgres, generator client (prismaSchemaFolder preview)
  scripts/collect-schemas.js            # globs apps/api/src/modules/**/schema.prisma + packages/**/schema.prisma → prisma/schema/
  index.ts                              # PrismaService extends PrismaClient, OnModuleInit/Destroy

packages/common/
  package.json, tsconfig.json
  types.ts                              # PaginatedResponse<T>, ApiResponse<T>, BaseEntity, DEFAULT_PAGE_SIZE
  index.ts

packages/events/
  package.json, tsconfig.json
  types.ts                              # DomainEvent interface
  event-registry.service.ts             # stores event metadata for runtime discovery
  events.module.ts                      # imports EventEmitterModule.forRoot()
  index.ts

apps/api/
  package.json                          # @apps/api
  tsconfig.json                         # path aliases: @modules/* → src/modules/*
  src/
    modules/admin/admin.module.ts       # empty shell
    main.ts                             # NestJS bootstrap: /api/v1 prefix, ValidationPipe, helmet, cors, swagger, cookie-parser, health endpoint
    app.module.ts                       # imports DatabaseModule, EventsModule, ConfigModule, ThrottlerModule
    config/env.validation.ts            # validates DATABASE_URL, JWT_SECRET, NODE_ENV, ALLOWED_ORIGINS
  .env.example

docker-compose.yml                      # postgres:17 + redis:7-alpine
vitest.config.ts

test/
  utils/db.ts                           # cleanDatabase(prisma)
  utils/auth.ts                         # tokenFor(user), expiredTokenFor(user) — placeholder
  utils/app.ts                          # createTestApp() via @nestjs/testing
  setup/globalSetup.ts                  # runs prisma migrate deploy
  setup/globalTeardown.ts
```

**Verify:** `pnpm install` → `pnpm db:generate` → `pnpm build` → `apps/api` starts → `GET /health` returns 200.

---

### Task 1: `packages/auth` — Pure Logic + Unit Tests
**Branch:** `feat/auth-pure-logic`
**Depends on:** Task 0

Zero framework dependencies. Pure TypeScript.

**Files:**
```
packages/auth/
  package.json                  # deps: bcryptjs, jsonwebtoken, @types/bcryptjs, @types/jsonwebtoken
  tsconfig.json
  types.ts
  hashing.ts
  tokens.ts
  index.ts
  __tests__/
    hashing.unit.test.ts        # 5 tests
    tokens.unit.test.ts         # 8 tests
```

**types.ts:**
```ts
interface AuthenticableUser {
  id: string;
  email: string;
  passwordHash: string;
  refreshToken?: string | null;
  timezone?: string | null;
}

interface PasswordTokenRecord {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  usedAt: Date | null;
}

interface TokenPayload {
  sub: string;
  email: string;
  entityName: string;   // "user" | "admin" — context separation
}

interface AuthModuleConfig {
  entityName: string;
  routePrefix: string;
  accessTokenExpiresIn: string;
  refreshTokenExpiresIn: string;
  jwtSecret: string;
  getUserDelegate: () => AuthUserDelegate;
  getPasswordTokenDelegate: () => AuthPasswordTokenDelegate;
}

interface AuthUserDelegate {
  findUnique(args: { where: { id?: string; email?: string } }): Promise<AuthenticableUser | null>;
  update(args: { where: { id: string }; data: Partial<AuthenticableUser> }): Promise<AuthenticableUser>;
  create(args: { data: Omit<AuthenticableUser, 'id'> }): Promise<AuthenticableUser>;
}

interface AuthPasswordTokenDelegate {
  findUnique(args: { where: { token?: string; id?: string } }): Promise<PasswordTokenRecord | null>;
  create(args: { data: Omit<PasswordTokenRecord, 'id' | 'usedAt'> }): Promise<PasswordTokenRecord>;
  update(args: { where: { id: string }; data: Partial<PasswordTokenRecord> }): Promise<PasswordTokenRecord>;
}
```

**hashing.ts:** bcryptjs, 12 salt rounds. Both functions async.

**tokens.ts:**
- `generateAccessToken(payload, secret, expiresIn)` → jwt.sign()
- `generateRefreshToken(payload, secret, expiresIn)` → jwt.sign()
- `verifyToken(token, secret)` → jwt.verify(), catches TokenExpiredError/JsonWebTokenError
- `generateRandomToken()` → crypto.randomBytes(32).toString('hex')

**Unit tests (13):**
- hashing (5): bcrypt hash format, correct password verifies, wrong password rejects, unique salts, empty string
- tokens (8): JWT roundtrip, expired throws, wrong secret throws, malformed throws, entityName in payload, random token 64-char hex, random tokens unique, refresh includes all claims

**Verify:** `pnpm test --filter @packages/auth` passes.

---

### Task 2: `apps/api/src/modules/users` — Schema + Migration
**Branch:** `feat/auth-schema`
**Depends on:** Task 0 (parallelizable with Task 1)

**Files:**
```
apps/api/src/modules/users/
  schema.prisma
  users.module.ts               # placeholder, wired in Task 5

test/factories/
  userFactory.ts                # build() + create() using Faker + packages/auth hashPassword
  passwordTokenFactory.ts
```

**schema.prisma:**
```prisma
model User {
  id             String          @id @default(uuid())
  email          String          @unique
  passwordHash   String
  refreshToken   String?
  timezone       String?
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  deletedAt      DateTime?
  passwordTokens PasswordToken[]

  @@map("users")
}

model PasswordToken {
  id        String    @id @default(uuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  token     String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@map("password_tokens")
}
```

**Also update:** `test/utils/auth.ts` — use `packages/auth` functions for `tokenFor()` and `expiredTokenFor()`.

**Verify:** `pnpm db:generate` + `pnpm db:migrate` succeed, Prisma client has `prisma.user` and `prisma.passwordToken`.

---

### Task 3: `packages/auth-nestjs` — Guards + Decorators + Unit Tests
**Branch:** `feat/auth-nestjs-guards`
**Depends on:** Task 1

**Files:**
```
packages/auth-nestjs/
  package.json                          # deps: @packages/auth, @nestjs/common, @nestjs/core
  tsconfig.json
  guards/auth.guard.ts
  guards/__tests__/auth.guard.unit.test.ts
  decorators/public.decorator.ts        # @Public() — SetMetadata(IS_PUBLIC_KEY, true)
  decorators/current-user.decorator.ts  # @CurrentUser() — createParamDecorator
  constants.ts                          # IS_PUBLIC_KEY, AUTH_MODULE_CONFIG, AUTH_CONFIGS_MAP
  index.ts                              # guards + decorators only (no module yet)
```

**AuthGuard (CanActivate):**
1. Check `IS_PUBLIC_KEY` via Reflector → pass through if true
2. Extract `Authorization: Bearer <token>`
3. `verifyToken(token, secret)` from @packages/auth
4. Read `entityName` from payload
5. Look up config in `AUTH_CONFIGS_MAP` (global Map<string, AuthModuleConfig>)
6. Fetch user via `config.getUserDelegate().findUnique({ where: { id: payload.sub } })`
7. Reject: missing token, expired, wrong secret, unknown entityName, user not found, user soft-deleted
8. Attach user to `request.user`

**AUTH_CONFIGS_MAP:** Global Map populated by each `AuthNestjsModule.register()` call. Single AuthGuard validates tokens from all registered auth contexts.

**Unit tests (6):**
1. Passes @Public() routes
2. 401 missing Authorization header
3. 401 malformed Bearer token
4. 401 expired token
5. 401 unregistered entityName
6. Attaches user to request for valid token

**Verify:** `pnpm test --filter @packages/auth-nestjs` passes.

---

### Task 4: `packages/auth-nestjs` — Service + Controller + Dynamic Module
**Branch:** `feat/auth-nestjs-module`
**Depends on:** Task 3

**Files:**
```
packages/auth-nestjs/
  services/auth.service.ts
  controllers/auth.controller.ts
  dto/
    login.dto.ts                        # email (@IsEmail), password (@IsString @MinLength(8) @MaxLength(128))
    register.dto.ts                     # email, password
    forgot-password.dto.ts              # email
    reset-password.dto.ts               # token (@IsString), newPassword (@MinLength(8) @MaxLength(128))
  auth-nestjs.module.ts                 # register() + registerAsync()
  index.ts                              # updated: add AuthNestjsModule, re-export AuthModuleConfig
```

**Endpoints (all under dynamic `{routePrefix}`):**
```
POST /{prefix}/login              @Public()  @Throttle(5/60s)
POST /{prefix}/register           @Public()
POST /{prefix}/refresh            @Public()
POST /{prefix}/logout             (authenticated)
POST /{prefix}/forgot-password    @Public()  @Throttle(5/60s)
POST /{prefix}/reset-password     @Public()
GET  /{prefix}/me                 (authenticated)
```

**AuthService methods:**

| Method | Logic |
|---|---|
| `login(email, password)` | Find user → verify password → generate access+refresh tokens → hash & store refresh token on user → return accessToken in body + refresh cookie |
| `register(email, password)` | Check email unique (409) → hash password → create user → generate tokens → return like login |
| `refresh(refreshCookie)` | Verify refresh JWT → find user → compare stored refresh hash → generate new pair (rotation) → update stored hash |
| `logout(userId)` | Clear stored refresh token → clear cookie |
| `forgotPassword(email)` | Find user (return 200 even if not found) → generate random token → create PasswordToken (1h expiry) |
| `resetPassword(token, newPassword)` | Find PasswordToken → validate not expired/used → hash new password → update user → mark token usedAt → clear refresh tokens |
| `getMe(userId)` | Find user → return profile excluding passwordHash, refreshToken |

**Security rules:**
- "Invalid email or password" for both wrong email AND wrong password (no enumeration)
- Refresh token rotation: new token on every refresh, old invalidated
- Password reset tokens: single-use, 1h expiry, marked `usedAt`
- Refresh token from HTTP-only Secure SameSite cookie

**AuthNestjsModule:**
```ts
static register(config: AuthModuleConfig): DynamicModule { ... }
static registerAsync(options: { imports, useFactory, inject }): DynamicModule { ... }
```

Each call populates `AUTH_CONFIGS_MAP` for the global AuthGuard. Dynamic route prefix via `@nestjs/core` RouterModule.

**No tests** — fully tested in Task 5 via integration tests.

---

### Task 5: `apps/api/src/modules/users` — Wiring + Integration & Security Tests
**Branch:** `feat/auth-integration`
**Depends on:** Tasks 1, 2, 3, 4

**Files:**
```
apps/api/src/modules/users/
  users.module.ts                       # UsersModule: imports AuthNestjsModule.registerAsync()

apps/api/src/app.module.ts              # import UsersModule, apply AuthGuard globally via APP_GUARD
apps/api/src/main.ts                    # add cookie-parser middleware

apps/api/src/modules/users/controllers/__tests__/
  auth.integration.test.ts              # 17 tests
  auth.security.test.ts                 # 10 tests
```

**users.module.ts:**
```ts
@Module({
  imports: [
    AuthNestjsModule.registerAsync({
      imports: [DatabaseModule],
      useFactory: (prisma: PrismaService) => ({
        entityName: 'user',
        routePrefix: 'auth',
        accessTokenExpiresIn: '15m',
        refreshTokenExpiresIn: '7d',
        jwtSecret: process.env.JWT_SECRET!,
        getUserDelegate: () => prisma.user,
        getPasswordTokenDelegate: () => prisma.passwordToken,
      }),
      inject: [PrismaService],
    }),
  ],
})
export class UsersModule {}
```

**Integration tests (17):**
1. POST /auth/register — creates user, returns accessToken, sets refresh cookie
2. POST /auth/register — 409 duplicate email
3. POST /auth/register — 400 invalid email
4. POST /auth/register — 400 short password
5. POST /auth/register — 400 unknown properties rejected
6. POST /auth/login — returns tokens for valid credentials
7. POST /auth/login — 401 wrong password ("Invalid email or password")
8. POST /auth/login — 401 nonexistent email (same error message)
9. POST /auth/refresh — issues new tokens from valid refresh cookie
10. POST /auth/refresh — 401 expired refresh token
11. POST /auth/refresh — old refresh token invalidated after rotation
12. POST /auth/logout — clears refresh token
13. POST /auth/forgot-password — 200 even for nonexistent email
14. POST /auth/forgot-password — creates PasswordToken record in DB
15. POST /auth/reset-password — updates password with valid token
16. POST /auth/reset-password — 400 expired token
17. POST /auth/reset-password — 400 already-used token

**Security tests (10):**
1. GET /auth/me — 401 without token
2. GET /auth/me — 401 expired token
3. GET /auth/me — 401 wrong JWT secret
4. GET /auth/me — never contains passwordHash
5. GET /auth/me — never contains refreshToken
6. POST /auth/register — password stored as bcrypt hash in DB
7. POST /auth/login — consistent error message for wrong password vs nonexistent email
8. POST /auth/register — unknown fields rejected
9. POST /auth/login — unknown fields rejected
10. POST /auth/login — 429 after 5 requests in 60 seconds

**Verify:** `pnpm test` — all tests pass.

---

## Dependency Graph

```
Task 0 (monorepo foundation)
  ├──→ Task 1 (packages/auth pure logic) ──→ Task 3 (guards) ──→ Task 4 (service/controller/module)
  │                                                                          │
  ├──→ Task 2 (users schema) ──────────────────────────────────────────────┤
                                                                             ↓
                                                                       Task 5 (wiring + integration/security tests)
```

**Parallelizable:** Tasks 1 and 2 can proceed in parallel after Task 0.

---

## Environment Variables

**apps/api/.env.example:**
```
DATABASE_URL=postgresql://dev:dev@localhost:5432/starter
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-me-user-secret
ALLOWED_ORIGINS=http://localhost:5173
NODE_ENV=development
API_ENABLED=true
WORKER_ENABLED=true
```

---

## What This Enables

After all tasks merged:
- Global `AuthGuard` protects all routes (except `@Public()`)
- `@CurrentUser()` available in any controller
- `@Public()` marks routes that skip auth
- User auth at `/api/v1/auth/*`
- `test/utils/auth.ts` provides `tokenFor()` / `expiredTokenFor()` for all future tests

**Next:** RBAC package (`packages/rbac`) → then taxonomy package (`packages/taxonomy`)
