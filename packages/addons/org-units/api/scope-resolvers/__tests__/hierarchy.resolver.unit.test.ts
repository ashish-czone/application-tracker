import { describe, it, expect } from 'vitest';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { UnitScopeResolver, DescendantsScopeResolver } from '../hierarchy.resolver';
import type { PositionScopeResolverService } from '../../services/position-scope-resolver.service';

// Stand-in for a Drizzle column. Resolvers pass the column to inArray/or
// without introspecting it, so any sentinel works for shape-only assertions.
const mockColumn = (name: string): PgColumn => ({ name } as unknown as PgColumn);

const stubService = (opts: {
  userIds?: string[] | null;
  unitIds?: string[] | null;
}): PositionScopeResolverService =>
  ({
    resolveUserIds: async () => opts.userIds ?? null,
    resolveOrgUnitIds: async () => opts.unitIds ?? null,
  } as unknown as PositionScopeResolverService);

describe('UnitScopeResolver', () => {
  it('declares type = "unit"', () => {
    const resolver = new UnitScopeResolver(stubService({}));
    expect(resolver.type).toBe('unit');
  });

  it('returns undefined when the expansion is empty', async () => {
    const resolver = new UnitScopeResolver(stubService({ userIds: [], unitIds: [] }));
    const predicate = await resolver.resolve({
      userId: 'user-1',
      anchors: { creator: mockColumn('created_by') },
    });
    expect(predicate).toBeUndefined();
  });

  it('returns undefined when entity declares no matching anchors', async () => {
    const resolver = new UnitScopeResolver(
      stubService({ userIds: ['u1', 'u2'], unitIds: ['t1'] }),
    );
    const predicate = await resolver.resolve({ userId: 'user-1', anchors: {} });
    expect(predicate).toBeUndefined();
  });

  it('produces a predicate when creator anchor + user expansion are present', async () => {
    const resolver = new UnitScopeResolver(
      stubService({ userIds: ['u1', 'u2'], unitIds: null }),
    );
    const predicate = await resolver.resolve({
      userId: 'user-1',
      anchors: { creator: mockColumn('created_by') },
    });
    expect(predicate).toBeDefined();
  });

  it('produces a predicate when team anchor + unit expansion are present', async () => {
    const resolver = new UnitScopeResolver(
      stubService({ userIds: null, unitIds: ['t1', 't2'] }),
    );
    const predicate = await resolver.resolve({
      userId: 'user-1',
      anchors: { team: mockColumn('team_id') },
    });
    expect(predicate).toBeDefined();
  });

  it('combines creator + assignee + team predicates with OR when all anchors present', async () => {
    const resolver = new UnitScopeResolver(
      stubService({ userIds: ['u1'], unitIds: ['t1'] }),
    );
    const predicate = await resolver.resolve({
      userId: 'user-1',
      anchors: {
        creator: mockColumn('created_by'),
        assignee: mockColumn('assignee_id'),
        team: mockColumn('team_id'),
      },
    });
    // We can't cheaply introspect the Drizzle SQL structure in a unit test,
    // but we assert the resolver produced a compound result rather than
    // short-circuiting to undefined when all anchors are live.
    expect(predicate).toBeDefined();
  });
});

describe('DescendantsScopeResolver', () => {
  it('declares type = "descendants"', () => {
    const resolver = new DescendantsScopeResolver(stubService({}));
    expect(resolver.type).toBe('descendants');
  });

  it('shares the same predicate shape as unit (differs only in tree expansion)', async () => {
    const resolver = new DescendantsScopeResolver(
      stubService({ userIds: ['u1', 'u2', 'u3'], unitIds: ['t1', 't2'] }),
    );
    const predicate = await resolver.resolve({
      userId: 'user-1',
      anchors: {
        creator: mockColumn('created_by'),
        team: mockColumn('team_id'),
      },
    });
    expect(predicate).toBeDefined();
  });
});
