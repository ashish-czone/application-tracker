import type { INestApplicationContext } from '@nestjs/common';
import { DatabaseService, and, eq, isNull } from '@packages/database';
import { roles, RbacService, type ScopeSpec } from '@packages/rbac';

/**
 * System seed for the four default compliance roles. Maps the Q15 permission
 * composition (see domains/compliance/todos.md §1 Q15) to the slugs
 * entity-engine actually auto-registers at boot — `<config.slug>.<action>`
 * with CRUD actions `{create, read, update, delete}` plus any
 * `extraPermissions` declared on the entity config.
 *
 * Slug alignment notes (diverges from Q15's doc wording):
 *  - Q15 uses `view` everywhere; the engine registers `read`.
 *  - Q15 uses a `compliance.` prefix; the engine does not.
 *  - Entity slug casing is mixed (hyphen for some, underscore for others):
 *      `client-contacts`, `client-registrations`, `compliance-filings` — hyphen
 *      `compliance_rules`, `law-handlers`                   — underscore
 *    We seed against the slugs the engine actually registers.
 *
 * Roles are scoped to `userType: null` — they apply to any user type.
 *
 * Scope model (see compliance-filings.config.ts `dataAccess`):
 *   - any                 unrestricted (firm-wide)
 *   - unit                rows whose assigneeTeamId is in actor's org units
 *   - assigned            rows where assigneeId = actor
 *   - own                 rows where createdBy = actor
 *   - unassigned_in_unit  unclaimed rows (assigneeId IS NULL) in actor's units
 *
 * Team members (Preparer, Reviewer) see the team's filings (`unit`), but
 * writes are narrower:
 *   - pickup restricts to unclaimed filings in the team pool so one
 *     preparer can't steal an assigned filing from a teammate.
 *   - update/submit restricts to rows actually assigned to them (`assigned`).
 *
 * Reviewers additionally approve/reject across the unit (`unit` on
 * complete/reject) so they can act on anything they supervise, not just
 * filings they personally filed.
 *
 * Team Leads get `unit` on every filing verb — they're the unit's authority.
 * Firm Admin grants are all `any` — they're the firm-wide authority.
 *
 * Platform note: the `/transition` endpoint builds its row-level accessCtx
 * from the generic `update` permission, not from the transition-specific
 * verb (pickup/submit/complete/reject/reopen/close). The scopes declared on
 * those verbs are therefore recorded-but-inert today — they gate the *name*
 * of the permission (workflow engine checks required-permission presence
 * against DB RbacService) but do not further narrow which rows the actor
 * can transition beyond what `update` already permits. Dispatch (self-claim
 * from the pickup pool) is therefore done by Team Leads under their
 * `update: unit` scope; preparers work on filings already assigned to them.
 *
 * Re-running the seed is a no-op: we skip creation when a role with the
 * same (name, userType=null) tuple already exists.
 */

interface GrantSpec {
  name: string;
  scopes: ScopeSpec[];
}

interface RoleSpec {
  name: string;
  permissions: GrantSpec[];
}

// ── Convenience scope constants ────────────────────────────────────────────

const ANY: ScopeSpec[] = [{ type: 'any' }];
const UNIT: ScopeSpec[] = [{ type: 'unit' }];
const ASSIGNED: ScopeSpec[] = [{ type: 'assigned' }];
const UNASSIGNED_IN_UNIT: ScopeSpec[] = [{ type: 'unassigned_in_unit' }];

// ── Reference-data reads (shared by every role) ────────────────────────────
//
// Clients / contacts / registrations / laws / rules are firm-wide reference
// data — there's no "my clients" model at the row level. Every role reads
// them unrestricted; only CRUD differs.
const REFERENCE_READS: GrantSpec[] = [
  { name: 'clients.read',              scopes: ANY },
  { name: 'client-contacts.read',      scopes: ANY },
  { name: 'client-registrations.read', scopes: ANY },
  { name: 'laws.read',                 scopes: ANY },
  { name: 'compliance_rules.read',     scopes: ANY },
];

// ── Preparer ───────────────────────────────────────────────────────────────
//
// Sees the team's filings (unit), claims only from the unclaimed pool
// (unassigned_in_unit), and updates/submits only filings actually assigned
// to them (assigned). Cannot approve or reject their own work.
const PREPARER_PERMISSIONS: GrantSpec[] = [
  { name: 'compliance-filings.read',   scopes: UNIT },
  { name: 'compliance-filings.pickup', scopes: UNASSIGNED_IN_UNIT },
  { name: 'compliance-filings.update', scopes: ASSIGNED },
  { name: 'compliance-filings.submit', scopes: ASSIGNED },
  ...REFERENCE_READS,
];

// ── Reviewer ───────────────────────────────────────────────────────────────
//
// Same as a preparer for the preparation flow, plus `complete`/`reject`
// across the unit — reviewers supervise everything the team produces, not
// just filings they personally prepared.
const REVIEWER_PERMISSIONS: GrantSpec[] = [
  ...PREPARER_PERMISSIONS,
  { name: 'compliance-filings.complete', scopes: UNIT },
  { name: 'compliance-filings.reject',   scopes: UNIT },
];

// ── Team Lead ──────────────────────────────────────────────────────────────
//
// Full filing lifecycle inside their unit(s): read/create/update/delete and
// every workflow transition. Outside filings, they manage the firm-wide
// reference data used by their team (clients + contacts + registrations and
// compliance_rules). They don't cross legal-entity boundaries — but at the
// data model level that's still `any`; unit-scoped reference data would be
// a separate feature.
const TEAM_LEAD_PERMISSIONS: GrantSpec[] = [
  { name: 'compliance-filings.read',     scopes: UNIT },
  { name: 'compliance-filings.create',   scopes: UNIT },
  { name: 'compliance-filings.update',   scopes: UNIT },
  { name: 'compliance-filings.delete',   scopes: UNIT },
  { name: 'compliance-filings.pickup',   scopes: UNIT },
  { name: 'compliance-filings.submit',   scopes: UNIT },
  { name: 'compliance-filings.complete', scopes: UNIT },
  { name: 'compliance-filings.reject',   scopes: UNIT },
  { name: 'compliance-filings.reopen',   scopes: UNIT },
  { name: 'compliance-filings.close',    scopes: UNIT },
  { name: 'clients.read',                scopes: ANY },
  { name: 'clients.create',              scopes: ANY },
  { name: 'clients.update',              scopes: ANY },
  { name: 'client-contacts.read',        scopes: ANY },
  { name: 'client-contacts.create',      scopes: ANY },
  { name: 'client-contacts.update',      scopes: ANY },
  { name: 'client-contacts.delete',      scopes: ANY },
  { name: 'client-registrations.read',   scopes: ANY },
  { name: 'client-registrations.create', scopes: ANY },
  { name: 'client-registrations.update', scopes: ANY },
  { name: 'laws.read',                   scopes: ANY },
  { name: 'compliance_rules.read',       scopes: ANY },
  { name: 'compliance_rules.create',     scopes: ANY },
  { name: 'compliance_rules.update',     scopes: ANY },
];

// ── Firm Admin ─────────────────────────────────────────────────────────────
//
// Firm-wide CRUD across every compliance entity. Everything `any`.
const FIRM_ADMIN_PERMISSIONS: GrantSpec[] = [
  { name: 'compliance-filings.read',       scopes: ANY },
  { name: 'compliance-filings.create',     scopes: ANY },
  { name: 'compliance-filings.update',     scopes: ANY },
  { name: 'compliance-filings.delete',     scopes: ANY },
  { name: 'compliance-filings.pickup',     scopes: ANY },
  { name: 'compliance-filings.submit',     scopes: ANY },
  { name: 'compliance-filings.complete',   scopes: ANY },
  { name: 'compliance-filings.reject',     scopes: ANY },
  { name: 'compliance-filings.reopen',     scopes: ANY },
  { name: 'compliance-filings.close',      scopes: ANY },
  { name: 'clients.read',                  scopes: ANY },
  { name: 'clients.create',                scopes: ANY },
  { name: 'clients.update',                scopes: ANY },
  { name: 'clients.delete',                scopes: ANY },
  { name: 'client-contacts.read',          scopes: ANY },
  { name: 'client-contacts.create',        scopes: ANY },
  { name: 'client-contacts.update',        scopes: ANY },
  { name: 'client-contacts.delete',        scopes: ANY },
  { name: 'client-registrations.read',     scopes: ANY },
  { name: 'client-registrations.create',   scopes: ANY },
  { name: 'client-registrations.update',   scopes: ANY },
  { name: 'client-registrations.delete',   scopes: ANY },
  { name: 'laws.read',                     scopes: ANY },
  { name: 'laws.create',                   scopes: ANY },
  { name: 'laws.update',                   scopes: ANY },
  { name: 'laws.delete',                   scopes: ANY },
  { name: 'compliance_rules.read',         scopes: ANY },
  { name: 'compliance_rules.create',       scopes: ANY },
  { name: 'compliance_rules.update',       scopes: ANY },
  { name: 'compliance_rules.delete',       scopes: ANY },
  { name: 'law-handlers.read',   scopes: ANY },
  { name: 'law-handlers.create', scopes: ANY },
  { name: 'law-handlers.update', scopes: ANY },
  { name: 'law-handlers.delete', scopes: ANY },
];

export const COMPLIANCE_ROLES: RoleSpec[] = [
  { name: 'Preparer',   permissions: PREPARER_PERMISSIONS },
  { name: 'Reviewer',   permissions: REVIEWER_PERMISSIONS },
  { name: 'Team Lead',  permissions: TEAM_LEAD_PERMISSIONS },
  { name: 'Firm Admin', permissions: FIRM_ADMIN_PERMISSIONS },
];

export const seedSystemRoles = async (ctx: INestApplicationContext): Promise<void> => {
  const database = ctx.get(DatabaseService);
  const rbac = ctx.get(RbacService);

  for (const spec of COMPLIANCE_ROLES) {
    const [existing] = await database.db
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.name, spec.name), isNull(roles.userType)))
      .limit(1);
    if (existing) continue;

    const role = await rbac.createRole({ name: spec.name, userType: null });
    await rbac.setRolePermissions(role.id, spec.permissions);
  }
};
