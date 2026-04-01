# API Rules & Conventions

Backend API conventions, error handling, validation, response formats, and security.

---

## 1. URL & Naming Conventions

- Global prefix: `/api/v1`
- Plural nouns, kebab-case: `/automation-rules`
- Nested resources max 2 levels: `/orders/:orderId/candidates`
- HTTP methods: GET (200), POST (201), PATCH (200), DELETE (204)

---

## 2. Controller Conventions

Controllers handle HTTP concerns only — parse request, call service, format response.

1. One controller per resource.
2. Inject only the module's own services — cross-module calls belong in the service layer.
3. Use `ParseUUIDPipe`, `ParseIntPipe` for path params.
4. Use `@HttpCode()` for non-default status codes.
5. Extract auth via `@CurrentIdentity()`, never from raw request.

---

## 3. DTOs — Request Validation

DTOs validate incoming data with `class-validator`. Internal to the module — never exported.

**Naming:** `CreateCandidateDto`, `UpdateCandidateDto` (`PartialType`), `ListCandidatesQueryDto`

**Rules:**
- Every string: `@MinLength` + `@MaxLength`. No unbounded strings.
- Every field: at least one validation decorator.
- UUIDs: `@IsUUID()`. Enums: `@IsEnum()`. Nested: `@ValidateNested()` + `@Type()`.

**Global validation pipe** in `main.ts`: `whitelist: true, forbidNonWhitelisted: true, transform: true`

---

## 4. Response Format

**Single resource:** Return directly, no envelope.

**Paginated list:**
```json
{ "data": [...], "meta": { "total": 150, "page": 2, "limit": 25, "totalPages": 6 } }
```

**Rules:**
- Null vs absent: include field with `null` if it exists but has no value.
- Enums as string values.
- Never expose passwords, hashes, internal flags.
- Data formatting (timestamps, currency, phone, etc.): see `.claude/rules/data-formatting.md`.

---

## 5. Pagination, Filtering & Sorting

**Pagination:** `?page=1&limit=25` — max limit 100 (clamped, not rejected).

**Filtering:** Query params matching field names. Date ranges: `?createdAfter=2026-01-01&createdBefore=2026-03-01`. Search: `?search=john`.

**Timezone-aware date filtering on timestamptz:** Frontend sends plain calendar dates. Server interprets in `APP_TIMEZONE` and converts to UTC range using `startOfDayInTimezone()` / `endOfDayInTimezone()`. Does NOT apply to `DATE` columns.

**Sorting:** `?sort=createdAt&order=desc` — default `createdAt desc`. Only indexed columns.

Every list endpoint has a query DTO with defaults and validation.

---

## 6. Error Handling

**Standard error shape:**
```json
{ "statusCode": 400, "error": "BAD_REQUEST", "message": "...", "details": [...] }
```

| Code | When |
|---|---|
| 400 | Validation / malformed request |
| 401 | Not authenticated |
| 403 | Not authorized |
| 404 | Not found |
| 409 | Conflict (duplicate, state) |
| 422 | Business logic rejection |
| 429 | Rate limited |
| 500 | Unhandled error |

Use NestJS exception classes (`ConflictException`, `NotFoundException`, etc.). Global filter normalizes all.

**Service patterns:** `findOneOrFail` throws 404. Validate business rules in service, not controller. Never swallow errors.

---

## 7. Authentication & Authorization

See PROMPT-AUTH.md for full auth architecture (credentials, tokens, RBAC, login/registration flows).

Key points:
- JWT access token (short-lived) in `Authorization: Bearer` header.
- Refresh token in HTTP-only cookie.
- `@Public()` decorator for unauthenticated routes.
- `@RequirePermission('module.action')` for RBAC.
- Resource-level auth (ownership) checked in service layer.

---

## 8. Rate Limiting

Global: `@nestjs/throttler` — 100 req / 60s. Sensitive endpoints (login, forgot-password): 5 req / 60s via `@Throttle()`.

---

## 9. Logging & Observability

Structured JSON logs via pino. Never `console.log`.

- Every request gets a `correlationId` — in logs, response header, event payloads, queue jobs.
- Levels: `error` (5xx, external failures), `warn` (rate limits, auth failures), `log` (key actions), `debug` (dev only).
- Never log passwords, tokens, secrets, full request bodies.
- App writes to **stdout only** — no file management.

---

## 10. Health Checks

```
GET /health       — liveness (process running)
GET /health/ready — readiness (DB, Redis reachable)
```

At root, not under `/api/v1`. Public, no auth. Excluded from logging and rate limiting.

---

## 11. Security

- Helmet + CORS (with credentials for cookies) in `main.ts`.
- HTTPS in production via reverse proxy.
- No sensitive data in URLs.
- Sanitize string inputs (strip HTML/script tags).
- Parameterized queries only (Drizzle handles this).
- Validate file uploads: MIME type, extension, size.
- Env vars for all secrets, validated at startup via `@nestjs/config`.

---

## 12. API Documentation (Swagger)

Via `@nestjs/swagger`. Every endpoint: `@ApiOperation`, `@ApiResponse`. Every DTO property: `@ApiProperty`. Group by `@ApiTags`. Dev/staging only.

---

## 13. Soft Deletes

- `deletedAt` timestamp on entity tables. All queries filter `isNull(deletedAt)` by default.
- DELETE endpoints set `deletedAt = now()`, return 204.
- Hard deletes are admin-only for GDPR/compliance.

---

## 14. Bulk Operations

`POST/PATCH/DELETE /candidates/bulk` — max batch 100, per-item results with `summary.succeeded/failed`. Not all-or-nothing by default.
