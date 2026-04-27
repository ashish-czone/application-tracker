import { test, expect } from './fixtures/auth';
import { resetState } from './helpers';
import {
  addUserToOrgUnit,
  createOrgPosition,
  createOrgUnit,
  getOrgPosition,
  listOrgUnitMembers,
  updateOrgPosition,
  type OrgUnit,
} from './fixtures/org-units';
import { createUser, type CreatedUser } from './fixtures/users';

/**
 * §4 org structure — named coverage:
 *
 *   US-4.3 Add a member with a position — position id round-trips
 *          through the membership API and the listing surfaces it.
 *   US-4.4 Customise positions — admin can add a new position and
 *          rename an existing one.
 *
 * §4.1 (create unit) and §4.2 (nest under parent) are covered by
 * `org-hierarchy.spec.ts`.
 */
test.describe('Flow: org membership (US-4.x)', () => {
  let team: OrgUnit;

  test.beforeAll(async () => {
    await resetState();
    team = await createOrgUnit({ level: 'Team' });
  });

  test('US-4.3 adding a member with a position persists the position', async () => {
    const head = await getOrgPosition('Head');
    const lead = await getOrgPosition('Lead');

    const alice = await createUser({ firstName: 'Alice', lastName: 'Head' });
    const bob = await createUser({ firstName: 'Bob', lastName: 'Lead' });

    await addUserToOrgUnit(team.id, alice.id, { positionId: head.id });
    await addUserToOrgUnit(team.id, bob.id, { positionId: lead.id });

    const members = await listOrgUnitMembers(team.id);
    const aliceRow = members.find((m) => m.userId === alice.id);
    const bobRow = members.find((m) => m.userId === bob.id);

    expect(aliceRow, 'Alice should be in the member list').toBeTruthy();
    expect(aliceRow!.positionId).toBe(head.id);
    expect(aliceRow!.positionName).toBe('Head');

    expect(bobRow, 'Bob should be in the member list').toBeTruthy();
    expect(bobRow!.positionId).toBe(lead.id);
    expect(bobRow!.positionName).toBe('Lead');
  });

  test('US-4.4 admin can add a new position', async () => {
    const created = await createOrgPosition('E2E Senior Partner', 5);
    expect(created.name).toBe('E2E Senior Partner');
    expect(created.sortOrder).toBe(5);

    // The new position is now resolvable by name like the seeded ones.
    const fetched = await getOrgPosition('E2E Senior Partner');
    expect(fetched.id).toBe(created.id);
  });

  test('US-4.4 admin can rename an existing position', async () => {
    // Use a freshly-created one so the canonical seeds remain unchanged
    // for other tests in the describe block.
    const created = await createOrgPosition('E2E Junior', 9);
    const renamed = await updateOrgPosition(created.id, { name: 'E2E Junior Associate' });
    expect(renamed.name).toBe('E2E Junior Associate');

    const refetched = await getOrgPosition('E2E Junior Associate');
    expect(refetched.id).toBe(created.id);
  });
});
