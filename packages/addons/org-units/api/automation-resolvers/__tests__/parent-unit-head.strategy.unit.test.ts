import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ParentUnitHeadStrategy } from '../parent-unit-head.strategy';

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

describe('ParentUnitHeadStrategy', () => {
  let rowQueue: any[][];
  let database: any;
  let strategy: ParentUnitHeadStrategy;

  beforeEach(() => {
    rowQueue = [];
    database = { db: createMockDb(rowQueue).db };
    strategy = new ParentUnitHeadStrategy(database, vi.fn());
  });

  it('returns empty when the target unit has no parent', async () => {
    rowQueue.push([{ parentId: null }]);

    const users = await strategy.resolve(
      { strategy: 'parent_unit_head', config: { unitField: 'assigneeTeamId' } },
      { entityData: { assigneeTeamId: 'root-unit' } },
    );
    expect(users).toEqual([]);
  });

  it('returns empty when the target unit itself cannot be found', async () => {
    rowQueue.push([]);

    const users = await strategy.resolve(
      { strategy: 'parent_unit_head', config: { unitField: 'assigneeTeamId' } },
      { entityData: { assigneeTeamId: 'missing' } },
    );
    expect(users).toEqual([]);
  });

  it('walks to the parent and returns its head(s)', async () => {
    rowQueue.push([{ parentId: 'parent-unit' }]);
    rowQueue.push([
      { userId: 'u-parent-head', sortOrder: 0 },
      { userId: 'u-parent-member', sortOrder: 1 },
    ]);

    const users = await strategy.resolve(
      { strategy: 'parent_unit_head', config: { unitField: 'assigneeTeamId' } },
      { entityData: { assigneeTeamId: 'child-unit' } },
    );
    expect(users).toEqual(['u-parent-head']);
  });

  it('returns empty when the parent exists but has no positioned members', async () => {
    rowQueue.push([{ parentId: 'parent-unit' }]);
    rowQueue.push([{ userId: 'u-a', sortOrder: null }]);

    const users = await strategy.resolve(
      { strategy: 'parent_unit_head', config: { unitField: 'assigneeTeamId' } },
      { entityData: { assigneeTeamId: 'child-unit' } },
    );
    expect(users).toEqual([]);
  });
});
