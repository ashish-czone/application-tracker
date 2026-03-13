# Auth Package — Architecture & Implementation

This document defines the authentication and authorization package architecture. The auth system is split into reusable packages and consuming modules that provide app-specific configuration.

---

## Package Split

| Package | Purpose | Dependencies |
|---|---|---|
| `packages/auth` | Pure logic: password hashing, token generation/validation, types/interfaces. No NestJS, no Prisma. | None (pure TypeScript) |
| `packages/auth-nestjs` | NestJS integration: guards, decorators, controllers, config-driven module registration. | `packages/auth` |
| `packages/auth-ui` | React components: login form, register form, forgot password form, password strength meter, session expired modal. Props-driven, no API calls. | `packages/ui` |

---

## 1. `packages/auth` — Pure Logic

Zero framework dependencies. Fully testable without NestJS or Prisma.

### Exports

```ts
// Hashing
hashPassword(plain: string): Promise<string>
verifyPassword(plain: string, hash: string): Promise<boolean>

// Tokens
generateAccessToken(payload: TokenPayload, secret: string, expiresIn: string): string
generateRefreshToken(payload: TokenPayload, secret: string, expiresIn: string): string
verifyToken(token: string, secret: string): TokenPayload
generateRandomToken(): string  // for password reset tokens

// Types
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
  sub: string;          // user ID
  email: string;
  entityName: string;   // "user" | "admin" — identifies which auth context
}

interface AuthModuleConfig {
  entityName: string;              // "user" | "admin"
  routePrefix: string;             // "auth" | "admin/auth"
  accessTokenExpiresIn: string;    // "15m"
  refreshTokenExpiresIn: string;   // "7d"
  jwtSecret: string;
  getUserDelegate: () => AuthUserDelegate;
  getPasswordTokenDelegate: () => AuthPasswordTokenDelegate;
}
```

### Prisma Delegate Interfaces

The auth package defines the expected shape of Prisma delegates. Any Prisma model with the right fields satisfies these interfaces:

```ts
// packages/auth/types.ts
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

### Rules

1. **No NestJS imports.** This package is pure TypeScript.
2. **No Prisma imports.** It defines delegate interfaces — never touches the Prisma client directly.
3. **Uses bcrypt or argon2 for hashing.** Configurable, defaults to bcrypt.
4. **Uses constant-time comparison** for token verification to prevent timing attacks.

---

## 2. `packages/auth-nestjs` — NestJS Integration

Provides a configurable NestJS module that the consuming app registers with its own Prisma delegates and settings.

### Module Registration

```ts
// modules/auth/auth.module.ts — Customer auth
@Module({
  imports: [
    AuthNestjsModule.register({
      entityName: 'user',
      routePrefix: 'auth',
      accessTokenExpiresIn: '15m',
      refreshTokenExpiresIn: '7d',
      jwtSecret: process.env.JWT_SECRET,
      getUserDelegate: () => this.prisma.user,
      getPasswordTokenDelegate: () => this.prisma.passwordToken,
    }),
  ],
})
export class UserAuthModule {}

// modules/admin/admin-auth.module.ts — Admin auth
@Module({
  imports: [
    AuthNestjsModule.register({
      entityName: 'admin',
      routePrefix: 'admin/auth',
      accessTokenExpiresIn: '1h',
      refreshTokenExpiresIn: '30d',
      jwtSecret: process.env.ADMIN_JWT_SECRET,
      getUserDelegate: () => this.prisma.adminUser,
      getPasswordTokenDelegate: () => this.prisma.adminPasswordToken,
    }),
  ],
})
export class AdminAuthModule {}
```

### Controllers

`AuthNestjsModule` dynamically registers controllers under the configured `routePrefix`:

```
POST /{prefix}/login          — email + password → access token + refresh token cookie
POST /{prefix}/register       — create account (if registration is enabled)
POST /{prefix}/refresh        — refresh token cookie → new access + refresh tokens
POST /{prefix}/logout         — clear refresh token
POST /{prefix}/forgot-password — email → sends password reset token
POST /{prefix}/reset-password  — token + new password → updates password
GET  /{prefix}/me             — returns authenticated user profile + permissions
```

### Guards & Decorators

Exported for use across all modules:

```ts
// Global auth guard — validates access token on every request
@UseGuards(AuthGuard)

// Skip auth on specific routes
@Public()

// Extract authenticated user from request
@CurrentUser() user: AuthenticableUser

// Require specific permission (works with packages/rbac)
@RequirePermission('candidates.create')
```

The `AuthGuard` reads the `entityName` from the token payload to determine which auth context to validate against. A customer token cannot access admin routes and vice versa.

### Token Refresh Flow

1. Access token expires → API returns 401.
2. Frontend interceptor calls `POST /{prefix}/refresh` (refresh token sent via HTTP-only cookie).
3. Server validates refresh token against the configured delegate, issues new tokens.
4. Retry the original request with the new access token.

### Exports

```ts
// packages/auth-nestjs/index.ts
export { AuthNestjsModule } from './auth-nestjs.module';
export { AuthGuard } from './guards/auth.guard';
export { Public } from './decorators/public.decorator';
export { CurrentUser } from './decorators/current-user.decorator';
export type { AuthModuleConfig } from '@packages/auth';
```

---

## 3. Expected Prisma Schema Structure

The auth package defines the **expected fields** but does not own any `schema.prisma`. Each consuming module defines its own models with `@@map()` to set the table name.

### Reference structure for user model

```prisma
// modules/auth/schema.prisma
model User {
  id            String    @id @default(uuid())
  email         String    @unique
  passwordHash  String
  refreshToken  String?
  timezone      String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  deletedAt     DateTime?

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

### Reference structure for admin model

```prisma
// modules/admin/schema.prisma (auth-related models)
model AdminUser {
  id            String    @id @default(uuid())
  email         String    @unique
  passwordHash  String
  refreshToken  String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  passwordTokens AdminPasswordToken[]

  @@map("admin_users")
}

model AdminPasswordToken {
  id        String    @id @default(uuid())
  userId    String
  user      AdminUser @relation(fields: [userId], references: [id])
  token     String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@map("admin_password_tokens")
}
```

### Rules

1. **The consuming module owns the schema**, not the package.
2. **Field names must match** the delegate interfaces defined in `packages/auth` (`email`, `passwordHash`, `refreshToken`, `token`, `expiresAt`, `usedAt`).
3. **Additional fields are allowed.** The module can add fields beyond what the auth package expects (e.g., `name`, `avatar`, `phone` on User). The auth package only accesses fields it knows about.
4. **`@@map()` sets the table name.** This is how multiple auth contexts coexist in the same database.

---

## 4. `packages/auth-ui` — Frontend Components

Props-driven React components for auth screens. No API calls, no routing, no data-fetching hooks. The consuming feature wires data and handlers.

### Components

```
packages/auth-ui/
  LoginForm.tsx              — email + password fields, submit handler, error display
  RegisterForm.tsx           — registration fields, password strength meter
  ForgotPasswordForm.tsx     — email field, submit handler
  ResetPasswordForm.tsx      — new password + confirm, strength meter
  PasswordStrengthMeter.tsx  — real-time strength indicator with requirements checklist
  SessionExpiredModal.tsx    — "Session expired" message with login redirect
```

### Usage in features

```tsx
// features/auth/pages/LoginPage.tsx
import { LoginForm } from '@packages/auth-ui';
import { useLogin } from '../hooks/useLogin';

export function LoginPage() {
  const { mutate: login, isPending, error } = useLogin();

  return (
    <LoginForm
      onSubmit={(data) => login(data)}
      isLoading={isPending}
      error={error?.message}
    />
  );
}
```

```tsx
// features/admin/pages/AdminLoginPage.tsx
import { LoginForm } from '@packages/auth-ui';
import { useAdminLogin } from '../hooks/useAdminLogin';

export function AdminLoginPage() {
  const { mutate: login, isPending, error } = useAdminLogin();

  return (
    <LoginForm
      onSubmit={(data) => login(data)}
      isLoading={isPending}
      error={error?.message}
      title="Admin Login"
    />
  );
}
```

### Rules

1. **No API calls inside components.** The consuming feature provides `onSubmit`, `isLoading`, `error` via props.
2. **No routing.** The consuming feature handles redirects after login/logout.
3. **Uses `@packages/ui` components** (FormInput, Button, Modal) — not raw HTML elements.
4. **Password strength meter is mandatory** on registration and password reset forms (see PROMPT-UI.md section 17).

---

## 5. Auth Flow Summary

### Login

```
1. User submits email + password via LoginForm
2. features/auth calls POST /auth/login
3. packages/auth-nestjs controller → validates credentials via configured delegate
4. packages/auth → verifies password hash, generates tokens
5. Response: access token in body, refresh token in HTTP-only cookie
6. Frontend stores access token in memory (not localStorage)
```

### Token Refresh

```
1. API call returns 401 (access token expired)
2. packages/api-client interceptor calls POST /auth/refresh
3. packages/auth-nestjs → validates refresh token via configured delegate
4. packages/auth → generates new token pair
5. Interceptor retries original request with new access token
6. User never notices
```

### Session Expiry

```
1. Refresh token itself expires (user inactive for days)
2. POST /auth/refresh returns 401
3. Frontend shows SessionExpiredModal (from packages/auth-ui)
4. User is NOT redirected immediately — can copy unsaved work
5. After clicking "Log in", redirect to login page
6. After login, return to the page they were on
```

### Forgot Password

```
1. User submits email via ForgotPasswordForm
2. POST /auth/forgot-password → generates random token, saves via delegate
3. Enqueues email job via packages/queue (not sent inline)
4. Worker sends email with reset link
5. User clicks link → ResetPasswordForm
6. POST /auth/reset-password → validates token, updates password via delegate
7. Token marked as used — cannot be reused
```

---

## 6. Security Rules

1. **Access tokens are short-lived** (15m default). Stored in memory only — never localStorage.
2. **Refresh tokens are in HTTP-only, Secure, SameSite cookies.** Not accessible to JavaScript.
3. **Passwords are hashed with bcrypt/argon2.** Never stored plain. Never logged.
4. **Password reset tokens are single-use** with expiration. Marked as `usedAt` after use.
5. **Failed login attempts** — do not reveal whether the email exists. Always return the same error message: "Invalid email or password."
6. **Rate limit auth endpoints** (see PROMPT-API.md section 9): 5 requests/minute for login, forgot-password.
7. **Refresh token rotation** — on each refresh, issue a new refresh token and invalidate the old one. Detects token theft.
8. **Separate JWT secrets per auth context.** Customer and admin tokens use different secrets so a customer token cannot be used to access admin routes.
9. **`AuthGuard` checks `entityName` in token claims** to enforce context separation. A token with `entityName: "user"` cannot access routes registered under `entityName: "admin"`.
