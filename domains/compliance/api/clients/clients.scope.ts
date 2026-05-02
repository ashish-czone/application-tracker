import type { ScopeAnchorMap } from '@packages/rbac';
import { clients } from './clients.schema';

/**
 * Anchor columns for clients — the `(role → column)` map the
 * `DataAccessScopeService` consults when resolving generic scope kinds
 * (`own` / `assigned` / `unit` / `descendants`).
 *
 * Wired into `BaseCrudService` via `createCrudProvider({ scope: ... })`
 * in `clients.module.ts`. Forward-compat: no current role grant uses a
 * non-`'any'` scope on `clients.read`, so the predicate path is dormant
 * today. Adding such a grant later (e.g. an account manager who only sees
 * their own clients) automatically Just Works because the anchors are
 * already declared.
 *
 * Roles:
 *  - `creator` → `createdBy` — the user who originally created the row
 *    (set on directory's `clients` insert path; flows through compliance
 *    creates because compliance writes go through the shared identity
 *    service for base columns).
 *  - `assignee` → `complianceAccountManagerId` — the user explicitly
 *    assigned as the firm's point person for this client. Treated as an
 *    `assignee`-kind anchor (single user the row is "assigned to") even
 *    though the column name reads more like an attribute, because that's
 *    how the registered `assigned` scope resolver consumes it.
 */
export const CLIENTS_ANCHORS: ScopeAnchorMap = {
  creator: clients.createdBy,
  assignee: clients.complianceAccountManagerId,
};
