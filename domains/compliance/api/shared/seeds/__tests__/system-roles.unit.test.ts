import { describe, it, expect } from 'vitest';
import { COMPLIANCE_ROLES } from '../system-roles';

function grants(roleName: string) {
  const role = COMPLIANCE_ROLES.find((r) => r.name === roleName);
  if (!role) throw new Error(`Role ${roleName} not found in COMPLIANCE_ROLES`);
  return role.permissions;
}

function scopeTypesFor(roleName: string, permission: string): string[] | undefined {
  const g = grants(roleName).find((p) => p.name === permission);
  return g?.scopes.map((s) => s.type);
}

describe('COMPLIANCE_ROLES seed', () => {
  it('ships four roles: Preparer, Reviewer, Team Lead, Firm Admin', () => {
    expect(COMPLIANCE_ROLES.map((r) => r.name)).toEqual([
      'Preparer', 'Reviewer', 'Team Lead', 'Firm Admin',
    ]);
  });

  describe('Preparer', () => {
    it('sees filings at the unit level', () => {
      expect(scopeTypesFor('Preparer', 'compliance-filings.read')).toEqual(['unit']);
    });

    it('can only pickup from the unclaimed pool (unassigned_in_unit), never assigned work', () => {
      // This is the anti-steal-assigned-work check. If pickup widened to
      // `unit`, a preparer could reassign a teammate's in-progress work to
      // themselves by hitting the pickup transition — regression tripwire.
      expect(scopeTypesFor('Preparer', 'compliance-filings.pickup'))
        .toEqual(['unassigned_in_unit']);
    });

    it('can only update/submit filings actually assigned to them', () => {
      expect(scopeTypesFor('Preparer', 'compliance-filings.update')).toEqual(['assigned']);
      expect(scopeTypesFor('Preparer', 'compliance-filings.submit')).toEqual(['assigned']);
    });

    it('does not grant complete/reject/reopen/close/create/delete', () => {
      // Preparer lacks approval and lifecycle-admin verbs. Adding any of
      // these to the preparer seed would turn preparers into reviewers
      // or team leads — forbid via explicit assertion.
      const granted = grants('Preparer').map((p) => p.name);
      for (const action of ['complete', 'reject', 'reopen', 'close', 'create', 'delete'] as const) {
        expect(granted).not.toContain(`compliance-filings.${action}`);
      }
    });

    it('reads firm-wide reference data (clients, laws, rules) with any scope', () => {
      for (const perm of ['clients.read', 'laws.read', 'compliance-rules.read']) {
        expect(scopeTypesFor('Preparer', perm)).toEqual(['any']);
      }
    });
  });

  describe('Reviewer', () => {
    it('inherits every preparer grant with matching scope', () => {
      const preparerGrants = grants('Preparer');
      const reviewerGrants = grants('Reviewer');
      for (const pg of preparerGrants) {
        const rg = reviewerGrants.find((g) => g.name === pg.name);
        expect(rg?.scopes.map((s) => s.type)).toEqual(pg.scopes.map((s) => s.type));
      }
    });

    it('approves and rejects across the unit (not just filings they authored)', () => {
      // Reviewer's complete/reject widen to `unit` so they can supervise
      // anything the team produces, not only their own work. If scope
      // narrowed to `assigned` they'd only ever approve their own filings
      // — defeating the point of a review role.
      expect(scopeTypesFor('Reviewer', 'compliance-filings.complete')).toEqual(['unit']);
      expect(scopeTypesFor('Reviewer', 'compliance-filings.reject')).toEqual(['unit']);
    });

    it('does not grant reopen/close/create/delete (still a team member, not a lead)', () => {
      const granted = grants('Reviewer').map((p) => p.name);
      for (const action of ['reopen', 'close', 'create', 'delete'] as const) {
        expect(granted).not.toContain(`compliance-filings.${action}`);
      }
    });
  });

  describe('Team Lead', () => {
    it('holds every filing verb at unit scope', () => {
      for (const action of [
        'read', 'create', 'update', 'delete',
        'pickup', 'submit', 'complete', 'reject', 'reopen', 'close',
      ] as const) {
        expect(scopeTypesFor('Team Lead', `compliance-filings.${action}`))
          .toEqual(['unit']);
      }
    });

    it('manages clients/contacts/registrations/rules firm-wide (any)', () => {
      // Reference data CRUD is firm-wide at the data model level; carving
      // out "my unit's clients" would be a separate feature. Leads get the
      // read+write set; Firm Admin additionally gets delete.
      for (const perm of [
        'clients.read', 'clients.create', 'clients.update',
        'client-contacts.create', 'client-contacts.update', 'client-contacts.delete',
        'compliance-rules.create', 'compliance-rules.update',
      ]) {
        expect(scopeTypesFor('Team Lead', perm)).toEqual(['any']);
      }
    });

    it('does not grant client/registration/law delete (Firm Admin only)', () => {
      const granted = grants('Team Lead').map((p) => p.name);
      for (const perm of ['clients.delete', 'laws.delete', 'compliance-rules.delete']) {
        expect(granted).not.toContain(perm);
      }
    });
  });

  describe('Firm Admin', () => {
    it('grants every verb across every compliance entity with any scope', () => {
      const adminGrants = grants('Firm Admin');
      expect(adminGrants.length).toBeGreaterThan(0);
      // Every admin grant must be scoped `any` — any narrower grant would
      // make the firm admin role fail to live up to its name.
      for (const g of adminGrants) {
        expect(g.scopes).toEqual([{ type: 'any' }]);
      }
    });

    it('includes delete on every CRUD entity (the one thing a Team Lead cannot do)', () => {
      const granted = grants('Firm Admin').map((p) => p.name);
      for (const perm of [
        'compliance-filings.delete',
        'clients.delete',
        'client-contacts.delete',
        'client-registrations.delete',
        'laws.delete',
        'compliance-rules.delete',
        'law-handlers.delete',
      ]) {
        expect(granted).toContain(perm);
      }
    });
  });
});
