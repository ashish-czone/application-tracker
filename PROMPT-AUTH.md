# Authentication, Identity & Authorization

How auth, identity, and RBAC work in the system.

---

## Conceptual Overview

| Concern | Responsibility |
|---|---|
| **Authentication** | Verifies who. Credentials, tokens, login/register. |
| **Identity** | Canonical user record. Owns users + user type. |
| **Authorization (RBAC)** | What a user can do. Roles, permissions, data scopes, guards. |

---

## 1. Identity — Users

`users` table: `id`, `email` (contact, not login), `first_name`, `last_name`, `user_type` (admin/client — one per user, immutable), `created_at`, `updated_at`, `deleted_at`, `deleted_by`.

**Rules:** Soft delete only. All queries filter `deleted_at IS NULL`. No status column — active or deleted.

---

## 2. User Types

Classify by portal access. Single `user_type` column on `users`, set at creation, immutable. Not permissions — controls portal access and which roles can be assigned.

---

## 3. Credentials

Each credential = a login method. Table: `id`, `user_id`, `provider` (password/google/otp), `identifier` (login handle), `secret_hash` (required for password, null otherwise).

`UNIQUE(provider, identifier)`. CHECK constraint enforces `secret_hash` rules. A user can have multiple credentials.

---

## 4. Refresh Tokens

Access tokens: stateless JWT, short-lived (~15 min), not stored.
Refresh tokens: stored in DB, longer-lived (~7 days).

Table: `id`, `user_id`, `token_hash`, `expires_at`, `revoked_at`, `created_at`.

- Logout = revoke refresh token.
- Logout all = revoke all for user.
- Token rotation: old revoked, new issued on refresh.

---

## 5. RBAC

### Roles
Scoped to `user_type`. `UNIQUE(name, user_type)`. One `is_default` per user_type (partial unique index). Default roles cannot be deleted. Roles with assigned users cannot be deleted.

### Permissions
Flat `name` column: `module.action` convention. Grouping at runtime via registry.

### Role-Permissions (with data scope)
`role_permissions`: `role_id`, `permission_id`, `scope` (`'own'` or `'all'`).
- `own` = `created_by = user_id` filter
- `all` = no filter
- Same permission from multiple roles → highest scope wins (`all` > `own`)

### User-Roles
`user_roles`: `user_id`, `role_id`. Multiple roles allowed (same user_type only — service-layer validation).

### Enforcement
- Guard checks permission existence.
- Service layer enforces data scope via `scopeFilter()` helper.

---

## 6. Login Flow

Portal-specific. Frontend sends `userType`.

1. Look up credential by `provider=password, identifier=?`
2. Verify password hash
3. Load user, validate `user_type` matches
4. Load permissions with scopes (deduplicate — highest scope wins)
5. Issue access token (JWT with `userId, userType, permissions`) + refresh token

**Security:** Failed login never reveals whether user exists, wrong type, or wrong password.

---

## 7. Registration Flow

Portal-specific. Registration defines user type.

1. Look up default role for user type (fail 500 if none)
2. Transaction: create user + create credential
3. Assign default role (outside transaction, idempotent)
4. Issue tokens

Admin-created users (`POST /users`) require explicit `roleId`.

---

## 7a. Admin Invite & Direct-Create Endpoints

Two admin paths exist for adding users; pick by what the inviter needs:

### `POST /users/invite`

Creates a deferred account and mints an invitation token (the user finishes
sign-up via email link). Permission: `users.create`.

Request body:

```json
{
  "email": "alice@example.com",
  "firstName": "Alice",
  "lastName": "Doe",
  "userType": "client",
  "phone": "+15551234567",
  "roleIds": ["..."]
}
```

| Field | Required | Notes |
|---|---|---|
| `email` | yes | Lowercased before storage; conflicts with active users → 409. |
| `firstName` / `lastName` | yes | 1–100 chars each. |
| `userType` | yes | One of `'admin'` or `'client'`. Determines default-role lookup and login portal. |
| `phone` | no | Free-form string (validated downstream); nullable. |
| `roleIds` | no | Array of role ids to assign on accept. Empty = default role for `userType`. |

There is no `sendInvite` flag — the endpoint always mints a token.

### `POST /users`

Creates an active user immediately. Use this when the admin wants to set the
password directly (e.g. RBAC integration tests, importing users from another
system) instead of going through the email invite handshake. Permission:
`users.create`.

```json
{
  "firstName": "Alice",
  "lastName": "Doe",
  "email": "alice@example.com",
  "userType": "client",
  "credentials": { "password": "Secret123!" }
}
```

The `credentials.password` field is the discriminator: with it, the user can
log in immediately; without it, the account is deferred just like
`/users/invite`.

---

## 8. Token Strategy

| Token | Storage | Lifetime | Contains |
|---|---|---|---|
| Access | Client memory | ~15 min | userId, userType, permissions (scoped) |
| Refresh | DB + httpOnly cookie | ~7 days | Opaque reference |

Refresh flow: 401 → client sends refresh token → validate against DB → revoke old, issue new pair → reload permissions → retry.

---

## 9. Entity Relationships

```
users
 ├── credentials           (login methods)
 ├── user_roles → roles
 │     ├── user_type, is_default
 │     └── role_permissions → permissions + scope
 └── refresh_tokens        (sessions)
```
