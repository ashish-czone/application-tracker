import type { INestApplicationContext } from '@nestjs/common';
import { DatabaseService, and, eq, isNull } from '@packages/database';
import { roles, RbacService } from '@packages/rbac';

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
 *      `compliance_rules`, `compliance_law_handlers`                   — underscore
 *    We seed against the slugs the engine actually registers.
 *
 * Roles are scoped to `userType: null` — they apply to any user type. Every
 * grant here defaults to `[{type:'any'}]` (unrestricted on rows) because no
 * scopes are passed. Narrowed scopes (`own`, `unit`, `descendants`, …) will
 * be configured on these same grants in the compliance-filings application
 * PR. Re-running the seed is a no-op: we skip creation when a role with the
 * same (name, userType=null) tuple already exists.
 */

interface RoleSpec {
  name: string;
  permissions: string[];
}

// Full filing-lifecycle action set. Preparers/reviewers get subsets; leads
// and admins get the full set. Ordering matches the workflow:
// pickup → submit → complete/reject → reopen/close.
const FILING_ACTIONS_FULL = [
  'compliance-filings.read',
  'compliance-filings.create',
  'compliance-filings.update',
  'compliance-filings.delete',
  'compliance-filings.pickup',
  'compliance-filings.submit',
  'compliance-filings.complete',
  'compliance-filings.reject',
  'compliance-filings.reopen',
  'compliance-filings.close',
];

// Preparers claim filings, work on them, submit for review — they do not
// approve or reject their own work.
const PREPARER_PERMISSIONS = [
  'compliance-filings.read',
  'compliance-filings.pickup',
  'compliance-filings.submit',
  'clients.read',
  'client-contacts.read',
  'client-registrations.read',
  'laws.read',
  'compliance_rules.read',
];

// Reviewers can do everything a preparer does, plus approve (`complete`)
// and send a filing back (`reject`) during the review state.
const REVIEWER_PERMISSIONS = [
  ...PREPARER_PERMISSIONS,
  'compliance-filings.complete',
  'compliance-filings.reject',
];

const TEAM_LEAD_PERMISSIONS = [
  ...FILING_ACTIONS_FULL,
  'clients.read',
  'clients.create',
  'clients.update',
  'client-contacts.read',
  'client-contacts.create',
  'client-contacts.update',
  'client-contacts.delete',
  'client-registrations.read',
  'client-registrations.create',
  'client-registrations.update',
  'laws.read',
  'compliance_rules.read',
  'compliance_rules.create',
  'compliance_rules.update',
];

const FIRM_ADMIN_PERMISSIONS = [
  ...FILING_ACTIONS_FULL,
  'clients.read',
  'clients.create',
  'clients.update',
  'clients.delete',
  'client-contacts.read',
  'client-contacts.create',
  'client-contacts.update',
  'client-contacts.delete',
  'client-registrations.read',
  'client-registrations.create',
  'client-registrations.update',
  'client-registrations.delete',
  'laws.read',
  'laws.create',
  'laws.update',
  'laws.delete',
  'compliance_rules.read',
  'compliance_rules.create',
  'compliance_rules.update',
  'compliance_rules.delete',
  'compliance_law_handlers.read',
  'compliance_law_handlers.create',
  'compliance_law_handlers.update',
  'compliance_law_handlers.delete',
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
