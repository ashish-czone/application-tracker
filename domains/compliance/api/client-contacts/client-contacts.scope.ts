import type { ScopeAnchorMap } from '@packages/rbac';
import { clientContacts } from './client-contacts.schema';

/**
 * Anchor columns for client-contacts.
 *
 * Wired into `BaseCrudService` via `createCrudProvider({ scope: ... })`
 * in `client-contacts.module.ts`. Forward-compat: no current role grant
 * uses a non-`'any'` scope on `client-contacts.read`, so the predicate
 * path is dormant today. Declared so a future scoped grant lights up
 * without a code change.
 *
 * Only `creator` is available — the compliance-prefixed columns
 * (`complianceClientId`, `complianceDesignation`, `complianceIsPrimary`,
 * `complianceNotes`) describe the contact's relationship to a client,
 * not who's responsible for the contact row itself, so they don't fit
 * the `assignee` / `team` anchor roles. If product later wants
 * "contacts of clients I manage" semantics, that's better expressed via
 * a JOIN on `clients.complianceAccountManagerId` from a custom service
 * method — not a row anchor on this table.
 */
export const CLIENT_CONTACTS_ANCHORS: ScopeAnchorMap = {
  creator: clientContacts.createdBy,
};
