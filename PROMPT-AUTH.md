# Authentication, Identity & Authorization

This document defines how authentication, identity, user types, and role-based access control (RBAC) work in the system. It covers database schema and key flows.

---

## Conceptual Overview

The system separates three concerns:

| Concern | Responsibility |
|---|---|
| **Authentication** | Verifies who the user is. Manages credentials, tokens, login/register flows. |
| **Identity** | Represents the canonical user. Owns user records and user type assignments. |
| **Authorization (RBAC)** | Determines what a user is allowed to do. Roles, permissions, guards. |

---

## 1. Identity — Users

The `users` table is the canonical identity record in the system.

### Schema

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP,
  deleted_by UUID REFERENCES users(id)
);
```

### Rules

- `email` is the **primary contact email** — not a login credential. Login identifiers live in `credentials`.
- No `status` column. A user is either active (`deleted_at IS NULL`) or deleted (`deleted_at IS NOT NULL`).
- **Soft delete only.** Never hard delete a user. Set `deleted_at` and `deleted_by`. All queries must filter `WHERE deleted_at IS NULL` by default.

---

## 2. User Types

User types classify users by portal access — admin, client, employee, etc. They are **not** permissions. They control which portal a user may access and which roles can be assigned to them.

### No database table

User types are defined as a **TypeScript enum only**. No `user_types` table exists. The enum is the single source of truth.

```ts
export enum UserTypeCode {
  ADMIN = 'admin',
  CLIENT = 'client',
  EMPLOYEE = 'employee',
}
```

### User type assignments

A join table tracks which types a user has. Stores the enum code as text.

```sql
CREATE TABLE user_user_types (
  user_id UUID NOT NULL REFERENCES users(id),
  user_type TEXT NOT NULL,
  PRIMARY KEY (user_id, user_type)
);
```

### Rules

- A user can have **multiple** user types (e.g., both `admin` and `client`).
- User type is specified at registration — the registration form defines which type the user gets.
- Additional user types are assigned **by admins only** — users cannot self-assign.
- No `ON DELETE CASCADE`. Soft delete on users means rows are never physically deleted.

---

## 3. Authentication — Credentials

Each credential represents a login method for a user.

### Schema

```sql
CREATE TABLE credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL,
  identifier TEXT NOT NULL,
  secret_hash TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),

  UNIQUE(provider, identifier),

  CHECK (
    (provider = 'password' AND secret_hash IS NOT NULL)
    OR
    (provider != 'password' AND secret_hash IS NULL)
  )
);
```

### Providers

| Provider | Identifier | `secret_hash` |
|---|---|---|
| `password` | Username or email | bcrypt hash (required) |
| `google` | OAuth subject ID | NULL |
| `otp` | Phone number | NULL |

### Rules

- A user can have **multiple** credentials (e.g., password + Google).
- `identifier` is the login handle — not necessarily the user's email.
- `secret_hash` is enforced by CHECK constraint: required for `password`, null for everything else.
- No `ON DELETE CASCADE`.

---

## 4. Authentication — Refresh Tokens

Access tokens are stateless JWTs (short-lived, not stored). Refresh tokens are stored in the database for validation, rotation, and revocation.

### Schema

```sql
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

### Rules

- Access tokens: stateless JWT, short-lived (e.g., 15 minutes). Not stored in DB.
- Refresh tokens: stored in DB, longer-lived (e.g., 7 days). Validated on each refresh request.
- **Logout** = revoke the refresh token (`SET revoked_at = now()`).
- **Logout all devices** = revoke all refresh tokens for the user.
- Token rotation: on refresh, the old token is revoked and a new one is issued.
- No `ON DELETE CASCADE`.

---

## 5. Authorization — RBAC

### Roles

Roles are collections of permissions, scoped to a user type.

```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  user_type TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),

  UNIQUE(name, user_type)
);
```

`user_type` stores the enum code as text (e.g., `'admin'`, `'client'`). This scopes roles to portals — admin roles are separate from client roles.

### Permissions

Permissions represent actions allowed in the system. Flat `name` column with convention-based grouping.

```sql
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL
);
```

Permission names follow `module.action` convention: `users.create`, `orders.read`, `rbac.roles.manage`. Grouping by module is done at runtime via the permission registry, not in the schema.

### Role–Permission mapping

```sql
CREATE TABLE role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id),
  permission_id UUID NOT NULL REFERENCES permissions(id),
  PRIMARY KEY (role_id, permission_id)
);
```

### User–Role mapping

```sql
CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES users(id),
  role_id UUID NOT NULL REFERENCES roles(id),
  PRIMARY KEY (user_id, role_id)
);
```

### Rules

- Roles are scoped to a `user_type`. Admin roles and client roles are completely separate.
- A user can have **multiple** roles.
- **Role/type mismatch guard:** The RBAC service validates that a user has the matching user type before assigning a role. If a role is scoped to `admin`, the user must have `admin` in their `user_user_types`. This is enforced at the **service layer**, not via DB constraint.
- Permission names are flat strings. Module grouping is convention-based (`module.action`).
- Modules register their permissions with the permission registry in `onModuleInit`.
- No `ON DELETE CASCADE` on `user_roles`. Other join tables (`role_permissions`) may use cascade since roles can be hard deleted.

---

## 6. Login Flow

Login is **portal-specific**. Each portal has its own login page. The backend validates that the user has the matching user type.

### Flow (email + password)

```
1. User submits credentials on portal login page (e.g., /admin/login)
   → { identifier, password, userType: 'admin' }

2. Look up credential:
   SELECT * FROM credentials
   WHERE provider = 'password' AND identifier = ?

3. Verify password hash

4. Load user:
   SELECT * FROM users WHERE id = credential.user_id AND deleted_at IS NULL

5. Validate user type:
   SELECT 1 FROM user_user_types
   WHERE user_id = ? AND user_type = 'admin'
   → If no match: reject with "Access denied" (do not reveal why)

6. Load permissions:
   SELECT permissions.name
   FROM user_roles
   JOIN roles ON roles.id = user_roles.role_id AND roles.user_type = 'admin'
   JOIN role_permissions ON role_permissions.role_id = roles.id
   JOIN permissions ON permissions.id = role_permissions.permission_id
   WHERE user_roles.user_id = ?

7. Issue tokens:
   → Access token (JWT): { userId, userType, permissions[] }
   → Refresh token: stored in DB, returned as httpOnly cookie or response body
```

### Key points

- The login form sends the `userType` — the backend does not guess which portal the user wants.
- Only roles matching the asserted `user_type` are loaded. A user with both `admin` and `client` types gets different permissions depending on which portal they log into.
- Failed login responses must not reveal whether the user exists, lacks the type, or has a wrong password. Always return a generic error.

---

## 7. Registration Flow

Registration is also **portal-specific**. The registration form defines the user type.

### Flow

```
Within a single transaction:

1. Create user
   INSERT INTO users (email, first_name, last_name)

2. Create credential
   INSERT INTO credentials (user_id, provider, identifier, secret_hash)

3. Assign user type
   INSERT INTO user_user_types (user_id, user_type)

4. Assign default role (if applicable)
   INSERT INTO user_roles (user_id, role_id)

COMMIT
```

### Key points

- The registration endpoint receives `userType` from the form — no default type.
- Each portal's registration flow may assign a different default role (e.g., public client registration assigns `client_user` role).
- All four inserts happen in a single transaction. If any step fails, everything rolls back.

---

## 8. Token Strategy

| Token | Storage | Lifetime | Contains |
|---|---|---|---|
| Access token | Client memory (not localStorage) | Short (e.g., 15 min) | `userId`, `userType`, `permissions[]` |
| Refresh token | DB + httpOnly cookie | Longer (e.g., 7 days) | Opaque — no payload, just a hashed reference |

### Refresh flow

```
1. Access token expires → API returns 401
2. Client sends refresh token to /auth/refresh
3. Backend validates refresh token against DB (not expired, not revoked)
4. Revoke old refresh token, issue new pair (access + refresh)
5. Client retries the original request with new access token
```

### Revocation

- **Logout:** Revoke the specific refresh token.
- **Logout all devices:** Revoke all refresh tokens for the user.
- **Compromised account:** Revoke all refresh tokens + force password reset.

---

## 9. Soft Delete Convention

All tables in this domain use soft delete:

- `deleted_at TIMESTAMP` — null means active, non-null means deleted
- `deleted_by UUID REFERENCES users(id)` — who deleted it
- **No `ON DELETE CASCADE`** on FKs pointing to `users` — since users are never hard deleted
- All queries filter `WHERE deleted_at IS NULL` by default
- Only `users` currently has `deleted_at` / `deleted_by`. Add to other tables when soft delete is needed for them.

---

## 10. Entity Relationship Summary

```
users
 ├── credentials          (login methods)
 ├── user_user_types      (portal access)
 ├── user_roles           (role assignments)
 │     └── roles
 │           ├── user_type (text — scoped to portal)
 │           └── role_permissions
 │                 └── permissions
 └── refresh_tokens       (session management)
```
