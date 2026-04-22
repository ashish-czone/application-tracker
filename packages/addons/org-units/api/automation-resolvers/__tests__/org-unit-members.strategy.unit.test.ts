import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrgUnitMembersStrategy } from '../org-unit-members.strategy';

function createMockDb(rowQueue: any[][]) {
  function makeChain() {
    const chain: any = {};
    chain.from = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockImplementation(() => Promise.resolve(rowQueue.shift() ?? []));
    chain.then = (resolve: any) => resolve(rowQueue.shift() ?? []);
    return chain;
  }
  return {
    db: { select: vi.fn(() => makeChain()) },
  } as any;
}

describe('OrgUnitMembersStrategy', () => {
  let rowQueue: any[][];
  let database: any;
  let strategy: OrgUnitMembersStrategy;

  beforeEach(() => {
    rowQueue = [];
    database = { db: createMockDb(rowQueue).db };
    strategy = new OrgUnitMembersStrategy(database, vi.fn());
  });

  it('returns empty when unitField is missing from config', async () => {
    const users = await strategy.resolve(
      { strategy: 'org_unit_members' },
      { entityData: { assigneeTeamId: 'unit-1' } },
    );
    expect(users).toEqual([]);
  });

  it('returns every member regardless of position', async () => {
    rowQueue.push([
      { userId: 'u-head' },
      { userId: 'u-member-a' },
      { userId: 'u-member-b' },
    ]);

    const users = await strategy.resolve(
      { strategy: 'org_unit_members', config: { unitField: 'assigneeTeamId' } },
      { entityData: { assigneeTeamId: 'unit-1' } },
    );
    expect(users.sort()).toEqual(['u-head', 'u-member-a', 'u-member-b']);
  });

  it('returns empty array when the unit has no members', async () => {
    rowQueue.push([]);

    const users = await strategy.resolve(
      { strategy: 'org_unit_members', config: { unitField: 'assigneeTeamId' } },
      { entityData: { assigneeTeamId: 'unit-1' } },
    );
    expect(users).toEqual([]);
  });
});
