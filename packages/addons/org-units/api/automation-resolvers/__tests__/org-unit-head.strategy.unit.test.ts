import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrgUnitHeadStrategy } from '../org-unit-head.strategy';

function createMockDb(rowQueue: any[][]) {
  function makeChain() {
    const chain: any = {};
    chain.from = vi.fn().mockReturnValue(chain);
    chain.leftJoin = vi.fn().mockReturnValue(chain);
    chain.innerJoin = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockImplementation(() => Promise.resolve(rowQueue.shift() ?? []));
    chain.then = (resolve: any) => resolve(rowQueue.shift() ?? []);
    return chain;
  }
  return {
    db: { select: vi.fn(() => makeChain()) },
  } as any;
}

describe('OrgUnitHeadStrategy', () => {
  let rowQueue: any[][];
  let database: any;
  let getEntityResolver: ReturnType<typeof vi.fn>;
  let strategy: OrgUnitHeadStrategy;

  beforeEach(() => {
    rowQueue = [];
    database = { db: createMockDb(rowQueue).db };
    getEntityResolver = vi.fn();
    strategy = new OrgUnitHeadStrategy(database, getEntityResolver);
  });

  it('returns empty when unitField is not configured', async () => {
    const users = await strategy.resolve(
      { strategy: 'org_unit_head' },
      { entityData: { assigneeTeamId: 'u1' } },
    );
    expect(users).toEqual([]);
  });

  it('returns empty when the unit id cannot be resolved from context', async () => {
    const users = await strategy.resolve(
      { strategy: 'org_unit_head', config: { unitField: 'assigneeTeamId' } },
      {},
    );
    expect(users).toEqual([]);
  });

  it('reads unit id from entityData and returns the lowest-sortOrder member', async () => {
    rowQueue.push([
      { userId: 'u-member', sortOrder: 2 },
      { userId: 'u-head', sortOrder: 0 },
      { userId: 'u-lead', sortOrder: 1 },
    ]);

    const users = await strategy.resolve(
      { strategy: 'org_unit_head', config: { unitField: 'assigneeTeamId' } },
      { entityData: { assigneeTeamId: 'unit-1' } },
    );
    expect(users).toEqual(['u-head']);
  });

  it('returns all co-heads tied at the minimum sortOrder', async () => {
    rowQueue.push([
      { userId: 'u-a', sortOrder: 0 },
      { userId: 'u-b', sortOrder: 0 },
      { userId: 'u-c', sortOrder: 1 },
    ]);

    const users = await strategy.resolve(
      { strategy: 'org_unit_head', config: { unitField: 'assigneeTeamId' } },
      { entityData: { assigneeTeamId: 'unit-1' } },
    );
    expect(users.sort()).toEqual(['u-a', 'u-b']);
  });

  it('ignores positionless members when picking the head', async () => {
    rowQueue.push([
      { userId: 'u-positionless', sortOrder: null },
      { userId: 'u-head', sortOrder: 5 },
    ]);

    const users = await strategy.resolve(
      { strategy: 'org_unit_head', config: { unitField: 'assigneeTeamId' } },
      { entityData: { assigneeTeamId: 'unit-1' } },
    );
    expect(users).toEqual(['u-head']);
  });

  it('returns empty when every member is positionless — caller rolls up', async () => {
    rowQueue.push([
      { userId: 'u-a', sortOrder: null },
      { userId: 'u-b', sortOrder: null },
    ]);

    const users = await strategy.resolve(
      { strategy: 'org_unit_head', config: { unitField: 'assigneeTeamId' } },
      { entityData: { assigneeTeamId: 'unit-1' } },
    );
    expect(users).toEqual([]);
  });

  it('prefers unit id from event.payload over entityData', async () => {
    rowQueue.push([{ userId: 'u-from-payload', sortOrder: 0 }]);

    const users = await strategy.resolve(
      { strategy: 'org_unit_head', config: { unitField: 'assigneeTeamId' } },
      {
        event: {
          actorId: null,
          entityType: 'tasks',
          entityId: 't1',
          payload: { assigneeTeamId: 'unit-from-payload' },
        },
        entityData: { assigneeTeamId: 'unit-from-entity-data' },
      },
    );
    expect(users).toEqual(['u-from-payload']);
  });
});
