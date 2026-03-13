# API Rules & Conventions

This document defines the backend API conventions, error handling, validation, response formats, and security practices. Follow every instruction exactly.

---

## Tech Stack

- **Framework:** NestJS
- **Validation:** class-validator + class-transformer
- **Documentation:** Swagger/OpenAPI via @nestjs/swagger
- **Rate limiting:** @nestjs/throttler
- **Security:** helmet, CORS
- **Logging:** structured JSON (pino recommended for performance)
- **Health checks:** @nestjs/terminus
- **No Express-specific APIs. Always use NestJS abstractions.**

---

## 1. URL & Naming Conventions

### URL structure

- RESTful resource-based URLs: `/candidates`, `/candidates/:id`
- Plural nouns for collections: `/candidates`, not `/candidate`
- Kebab-case for multi-word resources: `/notification-rules`, not `/notificationRules`
- Nested resources for strong parent-child relationships: `/orders/:orderId/candidates`
- Maximum nesting depth: 2 levels. Beyond that, use top-level resources with query filters.

### Global prefix

All API routes are prefixed with `/api/v1`:

```ts
// apps/api/src/main.ts
app.setGlobalPrefix('api/v1');
```

### HTTP methods

| Method | Purpose | Response |
|---|---|---|
| GET | Fetch resource(s) | 200 with data |
| POST | Create a resource | 201 with created resource |
| PATCH | Partial update | 200 with updated resource |
| PUT | Full replacement (rare) | 200 with updated resource |
| DELETE | Remove a resource | 204 no content |

Never use GET for mutations. Never use POST for fetching.

---

## 2. Controller Conventions

Controllers handle HTTP concerns only — parse the request, call the service, format the response. No business logic.

```ts
@Controller('candidates')
@ApiTags('candidates')
@UseGuards(RbacGuard)
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Post()
  @RequirePermission(CANDIDATES_PERMISSIONS.CREATE)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateCandidateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.candidatesService.create(dto, user.id);
  }

  @Get(':id')
  @RequirePermission(CANDIDATES_PERMISSIONS.READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.candidatesService.findOneOrFail(id);
  }
}
```

### Rules

1. **One controller per resource.** No God controllers.
2. **Inject only the module's own services.** Controllers never import services from other modules — that cross-module call belongs in the service layer.
3. **Use parameter pipes** for path params: `ParseUUIDPipe`, `ParseIntPipe`, etc.
4. **Use `@HttpCode()`** to set correct status codes when they differ from NestJS defaults (e.g., `POST` defaults to 201, which is correct; `DELETE` should return 204).
5. **Extract the authenticated user** via a `@CurrentUser()` decorator, never from the raw request object.

---

## 3. DTOs — Request Validation

DTOs define and validate incoming request data using `class-validator`. They are internal to the module's controller layer and are never exported.

### Naming

- `CreateCandidateDto` — for POST
- `UpdateCandidateDto` — for PATCH (all fields optional via `PartialType`)
- `ListCandidatesQueryDto` — for GET list query params (pagination, filters, sorting)

### Validation rules

```ts
export class CreateCandidateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsUUID()
  orderId: string;
}
```

### Rules

1. **Every string field has `@MinLength` and `@MaxLength`.** No unbounded strings.
2. **Every DTO field has at least one validation decorator.** No unvalidated fields.
3. **Use `PartialType(CreateDto)` for update DTOs** — avoids duplicating validation rules.
4. **UUIDs are validated with `@IsUUID()`.** Never accept unvalidated IDs.
5. **Enums are validated with `@IsEnum(MyEnum)`.** Never accept arbitrary strings for enum fields.
6. **Nested objects use `@ValidateNested()` and `@Type()`.** Always validate nested structures.

### Global validation pipe

Configured once in `main.ts`. All endpoints validate automatically — no per-controller setup.

```ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,            // strip unknown properties
  forbidNonWhitelisted: true, // throw on unknown properties
  transform: true,            // auto-transform payloads to DTO instances
}));
```

`whitelist: true` prevents mass-assignment attacks. `forbidNonWhitelisted: true` makes unknown properties an explicit error rather than silent stripping.

---

## 4. Response Format

### Single resource

Return the resource directly — no envelope:

```json
{
  "id": "uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "status": "active",
  "createdAt": "2026-03-12T00:00:00.000Z"
}
```

### Paginated list

Use a standard paginated wrapper:

```json
{
  "data": [...],
  "meta": {
    "total": 150,
    "page": 2,
    "limit": 25,
    "totalPages": 6
  }
}
```

### Rules

1. **Timestamps are ISO 8601 UTC strings** (`2026-03-12T14:30:00.000Z`). Stored as `timestamptz` in Postgres, `DateTime` in Prisma. Used for: `createdAt`, `updatedAt`, `deletedAt`, event times, login times — anything that represents a moment in time. **Calendar dates** (date of birth, start date, anniversary) are plain `DATE` in Postgres, `String` in Prisma (`@db.Date`), transmitted as `YYYY-MM-DD` strings (`"2026-03-12"`). No timezone conversion — a DOB of March 12 is March 12 everywhere. Never store calendar dates as `timestamptz`.
2. **All IDs are UUIDs.** Never expose auto-increment IDs.
3. **Never expose internal fields** — passwords, hashes, internal flags, soft-delete timestamps (unless the consumer needs them).
4. **Null vs absent:** Include the field with `null` if the field exists but has no value. Omit the field only if it genuinely doesn't apply to this resource type.
5. **Enums are returned as string values**, not numbers.
6. **Currency amounts are returned as integers (cents)** with a currency code: `{ "amount": 12550, "currency": "USD" }`.
7. **Phone numbers are stored in E.164 format** (`+15551234567`). Validate and parse with a phone number library (e.g., `libphonenumber-js`), never with regex. Store the normalized E.164 string. Return E.164 in API responses — the frontend formats for display.
8. **Email addresses are lowercased before storage.** Uniqueness checks compare lowercased values. Validate format loosely — check for `@` and a domain, don't over-regex. Never reject valid emails with `+` aliases, long TLDs, or international characters.
9. **Passwords are never stored as plain text.** Hash with bcrypt or argon2. Never log passwords — not even partially, not even in debug mode. Never include in API responses. Use constant-time comparison (`timingSafeEqual`) to prevent timing attacks. See PROMPT-TESTING.md section 6 (password handling tests) for required test coverage.
10. **Percentages are stored as basis points (integer).** `15.5%` = `1550`. Same principle as currency — avoid floating-point arithmetic. API transmits as integer: `{ "rate": 1550 }`. Frontend converts for display and input.
11. **User timezone is stored as an IANA timezone string** (`America/New_York`) on the user profile. Nullable — defaults to browser timezone if not set. Returned in `/auth/me` response so the frontend can use it for all timestamp display conversions.

---

## 5. Pagination, Filtering & Sorting

### Pagination

Offset-based pagination by default. Query params:

```
GET /candidates?page=1&limit=25
```

- `page` defaults to 1. `limit` defaults to 25.
- Maximum `limit` is 100. Requests above this are clamped, not rejected.

### Filtering

Filters are query params matching field names:

```
GET /candidates?status=active&orderId=uuid
```

- Boolean filters: `?isActive=true`
- Date range filters: `?createdAfter=2026-01-01&createdBefore=2026-03-01`
- Search (text match): `?search=john` — always server-side, always debounced on the frontend.

### Sorting

```
GET /candidates?sort=createdAt&order=desc
```

- `sort` is the field name. `order` is `asc` or `desc`.
- Default sort: `createdAt` descending (newest first) unless the domain requires otherwise.
- Only allow sorting on indexed columns. Reject unknown sort fields.

### Query DTO

Every list endpoint has a query DTO that validates and applies defaults:

```ts
export class ListCandidatesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;

  @IsOptional()
  @IsEnum(CandidateStatus)
  status?: CandidateStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(['name', 'createdAt', 'status'])
  sort?: string = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';
}
```

---

## 6. Error Handling

### Standard error response

All errors follow the same shape:

```json
{
  "statusCode": 400,
  "error": "BAD_REQUEST",
  "message": "Validation failed",
  "details": [
    { "field": "email", "message": "Invalid email format" }
  ]
}
```

- `statusCode` — HTTP status code
- `error` — machine-readable error code (UPPER_SNAKE_CASE)
- `message` — human-readable summary
- `details` — optional array of field-level errors or additional context

### Status code usage

| Code | When |
|---|---|
| 400 | Validation error, malformed request |
| 401 | Not authenticated (missing/expired token) |
| 403 | Authenticated but not authorized |
| 404 | Resource not found |
| 409 | Conflict (duplicate email, state conflict) |
| 422 | Business logic rejection (valid request but cannot be processed) |
| 429 | Rate limited |
| 500 | Unhandled server error |

### Throwing errors in services

Use NestJS's built-in exception classes (`ConflictException`, `BadRequestException`, `NotFoundException`, `UnprocessableEntityException`, etc.). No custom exception base class needed — the global exception filter normalizes all exceptions into the standard error shape.

```ts
// Usage in a service
throw new ConflictException('This candidate has already been submitted to this order');
throw new NotFoundException('Order not found');
throw new UnprocessableEntityException('Cannot submit candidate without a resume');
```

### Global exception filter

Catches all unhandled errors and normalizes them into the standard error shape. Configured once in `main.ts`.

- Known exceptions (`HttpException` subclasses) → return their status and message.
- Unknown exceptions → return 500 with generic message. Never expose stack traces or internal details in production.
- Log the full error (with stack trace) server-side for every 5xx.

### Service-level error handling

- **Use `findOneOrFail` pattern:** Services that fetch a resource by ID should throw `NotFoundException` if it doesn't exist. The controller never checks for null.
- **Validate business rules in the service**, not the controller. The controller validates request shape (DTO). The service validates business logic (can this candidate be submitted?).
- **Never swallow errors silently.** If you catch an error, either handle it meaningfully or re-throw it.

---

## 7. Authentication

### Token strategy

- JWT access token (short-lived, ~15 minutes) in the `Authorization: Bearer <token>` header.
- Refresh token (long-lived) in an HTTP-only, secure, SameSite cookie.
- Never store tokens in localStorage. Never send refresh tokens in the Authorization header.

### Auth guard

A global `AuthGuard` validates the access token on every request except explicitly public routes:

```ts
@Public()  // custom decorator to skip auth
@Post('login')
async login(@Body() dto: LoginDto) { ... }
```

### `@CurrentUser()` decorator

Extracts the authenticated user from the request. Every authenticated endpoint receives the user without manual request parsing:

```ts
@Get('me')
async getProfile(@CurrentUser() user: AuthUser) {
  return user;
}
```

### Token refresh flow

1. Access token expires → API returns 401.
2. Frontend interceptor calls `POST /auth/refresh` (refresh token sent via cookie).
3. Server validates refresh token, issues new access + refresh tokens.
4. Retry the original request with the new access token.

See PROMPT-AUTH.md for the full auth package architecture, config interface, and security rules.

---

## 8. Authorization (RBAC)

Handled by `packages/rbac`. See main PROMPT.md for the full pattern.

- `RbacGuard` checks permissions after authentication.
- `@RequirePermission('module.action')` decorator on controller methods.
- Permissions are namespaced by module: `candidates.create`, `orders.read`.
- The guard returns 403 if the user lacks the required permission.
- For resource-level authorization (user can only edit their own records), the service layer checks ownership — not the guard.

---

## 9. Rate Limiting

Global rate limiter via `@nestjs/throttler`:

```ts
// apps/api/src/app.module.ts
ThrottlerModule.forRoot({
  ttl: 60,      // time window in seconds
  limit: 100,   // max requests per window
}),
```

### Per-endpoint overrides

Sensitive endpoints get stricter limits:

```ts
@Throttle({ default: { ttl: 60, limit: 5 } })
@Post('login')
async login() { ... }

@Throttle({ default: { ttl: 60, limit: 5 } })
@Post('forgot-password')
async forgotPassword() { ... }
```

Throttle responses return `429 Too Many Requests` with a `Retry-After` header.

---

## 10. Logging & Observability

### Structured logging

Use structured JSON logs via pino. Never use `console.log` in production code.

```ts
this.logger.log({
  orderId,
  candidateId,
  action: 'submitted',
}, 'Candidate submitted to order');
```

### Correlation IDs

Every request gets a unique `correlationId` (generated in middleware). It is:

- Attached to all log entries for that request.
- Returned in the response header `X-Correlation-Id`.
- Passed to event payloads and queue jobs for end-to-end tracing.

### What to log

| Level | When |
|---|---|
| `error` | Unhandled exceptions, 5xx responses, external service failures |
| `warn` | Rate limiting triggered, auth failures, deprecated endpoint usage |
| `log` | Request start/end, key business actions (create, delete, state change) |
| `debug` | Query details, cache hits/misses, event emissions (disabled in production) |

### What never to log

- Passwords, tokens, secrets, API keys.
- Full request/response bodies (log summaries or specific fields instead).
- PII beyond what's necessary for debugging (redact email, phone in logs).

### Queue job logging

The worker process logs job lifecycle events using the same structured JSON format as the API. Every job log entry includes the `correlationId` from the originating event for end-to-end tracing.

| Event | Level | Fields |
|---|---|---|
| Job started | `log` | `jobName`, `jobId`, `correlationId`, `attempt` |
| Job completed | `log` | `jobName`, `jobId`, `correlationId`, `duration` |
| Job failed (will retry) | `warn` | `jobName`, `jobId`, `correlationId`, `attempt`, `maxAttempts`, `error`, `nextRetryAt` |
| Job failed (exhausted retries) | `error` | `jobName`, `jobId`, `correlationId`, `attempt`, `error`, `stackTrace` |

```ts
// packages/queue — job processor wrapper
this.logger.log({
  jobName: job.name,
  jobId: job.id,
  correlationId: job.data.correlationId,
  attempt: job.attemptsMade + 1,
}, 'Job started');
```

Failed jobs with exhausted retries are moved to the dead-letter state in BullMQ. They remain inspectable via Bull Board (see PROMPT-INFRA.md section 6).

### Log output

The application writes structured JSON logs to **stdout only**. It does not manage log files, rotation, or aggregation — that is an infrastructure concern (see PROMPT-INFRA.md). This keeps the app stateless and portable across deployment environments.

---

## 11. Health Checks

Every deployable app exposes health check endpoints via `@nestjs/terminus`:

```
GET /health       — basic liveness (returns 200 if the process is running)
GET /health/ready — readiness (checks DB connection, Redis, external dependencies)

Health endpoints are registered outside the global `/api/v1` prefix — they live at the root (`/health`, not `/api/v1/health`).
```

- **Liveness:** returns 200 if the app is running. Used by orchestrators to detect crashed processes.
- **Readiness:** returns 200 only if all dependencies are reachable. Used by load balancers to route traffic.
- Health endpoints are **public** — no authentication required.
- Health endpoints are excluded from logging and rate limiting.

---

## 12. Security

### Middleware

Applied globally in `main.ts`:

```ts
app.use(helmet());
app.enableCors({
  origin: process.env.ALLOWED_ORIGINS?.split(','),
  credentials: true,  // needed for refresh token cookies
});
```

### Rules

1. **HTTPS only in production.** Enforce via reverse proxy or `hsts` header.
2. **Never put sensitive data in URLs** — no tokens, passwords, or PII in query params. They appear in logs, browser history, and referrer headers.
3. **Sanitize all string inputs.** Strip HTML/script tags to prevent stored XSS. Use a sanitization pipe or interceptor.
4. **Parameterized queries only.** Prisma handles this by default — never concatenate user input into raw SQL.
5. **Validate file uploads:** check MIME type, file extension, and file size at the controller level before passing to `packages/files`.
6. **Environment variables** for all secrets. Never hardcode credentials, API keys, or connection strings.

### Environment config

Validate all environment variables at startup using `@nestjs/config` with a validation schema. Fail fast if required variables are missing — never fall back to defaults for secrets.

```ts
// apps/api/src/config/env.validation.ts
export class EnvironmentVariables {
  @IsString()
  DATABASE_URL: string;

  @IsString()
  JWT_SECRET: string;

  @IsString()
  ALLOWED_ORIGINS: string;

  @IsIn(['development', 'staging', 'production'])
  NODE_ENV: string;
}
```

---

## 13. API Documentation (Swagger)

Auto-generated from decorators via `@nestjs/swagger`.

### Setup

```ts
// apps/api/src/main.ts
const config = new DocumentBuilder()
  .setTitle('API')
  .setVersion('1.0')
  .addBearerAuth()
  .build();
const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('docs', app, document);
```

### Rules

1. **Every endpoint has `@ApiOperation({ summary: '...' })`.** One line describing what it does.
2. **Every DTO property has `@ApiProperty()`.** Include `example` values for non-obvious fields.
3. **Every endpoint documents its error responses** with `@ApiResponse({ status: 404, description: '...' })`.
4. **Group endpoints by tag:** `@ApiTags('candidates')` on the controller.
5. **Swagger UI is available in development and staging only.** Disabled in production.

---

## 14. Soft Deletes

Never hard-delete user-facing data. Use a `deletedAt` timestamp:

```prisma
model Candidate {
  id        String    @id @default(uuid())
  name      String
  deletedAt DateTime?
}
```

### Rules

1. **All queries filter out soft-deleted records by default.** Use Prisma middleware or a base query helper that adds `where: { deletedAt: null }`.
2. **DELETE endpoints set `deletedAt = now()`.** They return 204.
3. **Soft-deleted records are excluded from unique constraints** in application logic (DB-level unique indexes may need partial indexes).
4. **Hard deletes are admin-only** — used only for GDPR/compliance data erasure requests, via a dedicated admin endpoint.

---

## 15. Bulk Operations

For endpoints that operate on multiple resources:

```
POST   /candidates/bulk       — create multiple
PATCH  /candidates/bulk       — update multiple
DELETE /candidates/bulk       — delete multiple
```

### Rules

1. **Accept an array of items** in the request body: `{ "items": [...] }`.
2. **Maximum batch size: 100.** Reject requests above this.
3. **Return per-item results** so the client knows which succeeded and which failed:

```json
{
  "results": [
    { "id": "uuid-1", "status": "success" },
    { "id": "uuid-2", "status": "error", "message": "Duplicate email" }
  ],
  "summary": { "succeeded": 1, "failed": 1 }
}
```

4. **Bulk operations are not all-or-nothing by default.** Each item is processed independently. If the client needs atomicity, use a transaction and fail the entire batch on any error.
