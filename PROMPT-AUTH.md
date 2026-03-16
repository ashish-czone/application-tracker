# Authentication, Identity & Authorization

This document defines how authentication, identity, user types, and role-based access control (RBAC) work in the system. It covers database schema and key flows.

---

## Conceptual Overview

The system separates three concerns:

| Concern | Responsibility |
|---|---|
| **Authentication** | Verifies who the user is. Manages credentials, tokens, login/register flows. |
| **Identity** | Represents the canonical user. Owns user records and user type. |
| **Authorization (RBAC)** | Determines what a user is allowed to do. Roles, permissions, data scopes, guards. |

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
  user_type TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP,
  deleted_by UUID REFERENCES users(id)
);
```

### Rules

- `email` is the **primary contact email** — not a login credential. Login identifiers live in `credentials`.
- `user_type` classifies the user by portal — `'admin'`, `'client'`, etc. A user has exactly **one** type. If someone needs both admin and client access, they create separate accounts.
- No `status` column. A user is either active (`deleted_at IS NULL`) or deleted (`deleted_at IS NOT NULL`).
- **Soft delete only.** Never hard delete a user. Set `deleted_at` and `deleted_by`. All queries must filter `WHERE deleted_at IS NULL` by default.

---

## 2. User Types

User types classify users by portal access — admin, client, etc. They are **not** permissions. They control which portal a user may access and which roles can be assigned to them.

### Single type per user

A user has exactly one `user_type`, stored directly on the `users` table as a text column. There is no separate junction table. Valid values are validated at the DTO level (e.g., `@IsIn(['admin', 'client'])`).

### Rules

- A user has **one** user type, set at creation. It cannot be changed after creation.
- User type is specified at registration — the registration endpoint defines which type the user gets.
- Admin-created users also have a user type specified in the `CreateUserDto`.

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

Roles are collections of permissions, scoped to a user type. A role can be marked as the default for its user type.

```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  user_type TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),

  UNIQUE(name, user_type)
);

-- Enforce at most one default role per user_type
CREATE UNIQUE INDEX roles_user_type_is_default_key ON roles (user_type) WHERE is_default = true;
```

`user_type` scopes roles to portals — admin roles are separate from client roles. `is_default` marks the role that is auto-assigned on registration for that user type.

### Permissions

Permissions represent actions allowed in the system. Flat `name` column with convention-based grouping.

```sql
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL
);
```

Permission names follow `module.action` convention: `users.create`, `orders.read`, `rbac.roles.manage`. Grouping by module is done at runtime via the permission registry, not in the schema.

### Role–Permission mapping (with data scope)

Each role-permission assignment includes a **data scope** that controls row-level access — whether the user can act on their own records only, or all records.

```sql
CREATE TABLE role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id),
  permission_id UUID NOT NULL REFERENCES permissions(id),
  scope TEXT NOT NULL DEFAULT 'all',
  PRIMARY KEY (role_id, permission_id)
);
```

Scope values:
- `'own'` — user can only access records they own (filtered by `created_by = user_id`)
- `'all'` — user can access all records (no filter)

When a user has the same permission from multiple roles with different scopes, the **highest scope wins** (`all` > `own`).

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
- A user can have **multiple** roles (within the same user type — cross-type assignment is rejected).
- **Role/type mismatch guard:** The RBAC service validates that the user's `user_type` matches the role's `user_type` before assigning. This is enforced at the **service layer**, not via DB constraint.
- **Default roles** (`is_default = true`) cannot be deleted. One default role per user type is enforced by a unique partial index.
- **Deletion guard:** A role cannot be deleted if any users are assigned to it. Remove the role from all users first.
- Permission names are flat strings. Module grouping is convention-based (`module.action`).
- Modules register their permissions with the permission registry in `onModuleInit`.
- `role_permissions` uses `ON DELETE CASCADE` on both FKs. `user_roles` uses `ON DELETE CASCADE` on `role_id`.
- **Data scope enforcement** happens at the service layer, not in the guard. The guard checks permission existence; services use the `scopeFilter()` helper to add WHERE clauses based on scope.

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

4. Load user and validate user type:
   SELECT * FROM users WHERE id = credential.user_id AND deleted_at IS NULL
   → If user.user_type != 'admin': reject with "Invalid credentials" (do not reveal why)

5. Load permissions with scopes:
   SELECT permissions.name, role_permissions.scope
   FROM user_roles
   JOIN roles ON roles.id = user_roles.role_id AND roles.user_type = 'admin'
   JOIN role_permissions ON role_permissions.role_id = roles.id
   JOIN permissions ON permissions.id = role_permissions.permission_id
   WHERE user_roles.user_id = ?
   → Deduplicate: if same permission from multiple roles, highest scope wins (all > own)

6. Issue tokens:
   → Access token (JWT): { userId, userType, permissions: { "users.read": "all", "users.update": "own" } }
   → Refresh token: stored in DB, returned as httpOnly cookie or response body
```

### Key points

- The login form sends the `userType` — the backend does not guess which portal the user wants.
- Only roles matching the user's `user_type` are loaded.
- Failed login responses must not reveal whether the user exists, has the wrong type, or has a wrong password. Always return a generic error.

---

## 7. Registration Flow

Registration is also **portal-specific**. The registration endpoint defines the user type.

### Flow

```
1. Look up default role for the user type
   → If no default role exists: fail with 500

Within a single transaction:

2. Create user (with user_type set on the row)
   INSERT INTO users (email, first_name, last_name, user_type)

3. Create credential
   INSERT INTO credentials (user_id, provider, identifier, secret_hash)

COMMIT

4. Assign default role (outside transaction — idempotent)
   INSERT INTO user_roles (user_id, role_id)

5. Load permissions from default role and issue tokens
```

### Key points

- The registration endpoint receives `userType` from the form — no default type.
- Each portal's registration assigns the **default role** for that user type (the role with `is_default = true`). Registration fails if no default role is configured.
- Admin-created users (`POST /users`) require an explicit `roleId` — no auto-assignment.
- User creation and credential creation happen in a transaction. Role assignment is outside the transaction (idempotent via `ON CONFLICT DO NOTHING`).

---

## 8. Token Strategy

| Token | Storage | Lifetime | Contains |
|---|---|---|---|
| Access token | Client memory (not localStorage) | Short (e.g., 15 min) | `userId`, `userType`, `permissions` (scoped: `Record<string, PermissionScope>`) |
| Refresh token | DB + httpOnly cookie | Longer (e.g., 7 days) | Opaque — no payload, just a hashed reference |

### Refresh flow

```
1. Access token expires → API returns 401
2. Client sends refresh token to /auth/refresh
3. Backend validates refresh token against DB (not expired, not revoked)
4. Revoke old refresh token, issue new pair (access + refresh)
5. Reload permissions (may have changed since last token)
6. Client retries the original request with new access token
```

### Revocation

- **Logout:** Revoke the specific refresh token.
- **Logout all devices:** Revoke all refresh tokens for the user.
- **Compromised account:** Revoke all refresh tokens + force password reset.

---

## 9. Soft Delete Convention

- `deleted_at TIMESTAMP` — null means active, non-null means deleted
- `deleted_by UUID REFERENCES users(id)` — who deleted it
- **No `ON DELETE CASCADE`** on FKs pointing to `users` — since users are never hard deleted
- All queries filter `WHERE deleted_at IS NULL` by default
- Only `users` currently has `deleted_at` / `deleted_by`. Add to other tables when soft delete is needed for them.
- **Roles are NOT soft deleted.** They are hard deleted, with guards preventing deletion of default roles or roles with assigned users.

---

## 10. Entity Relationship Summary

```
users
 ├── user_type              (portal access — single column on users)
 ├── credentials            (login methods)
 ├── user_roles             (role assignments)
 │     └── roles
 │           ├── user_type  (text — scoped to portal)
 │           ├── is_default (one default per user_type)
 │           └── role_permissions
 │                 ├── permissions
 │                 └── scope (data access: 'own' | 'all')
 └── refresh_tokens         (session management)
```
