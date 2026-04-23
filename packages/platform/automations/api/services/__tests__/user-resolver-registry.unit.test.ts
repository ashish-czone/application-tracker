import { describe, it, expect, vi } from 'vitest';
import { UserResolverRegistry, type UserResolutionContext } from '../user-resolver-registry';
import { ActorStrategy } from '../strategies/actor.strategy';
import { EntityFieldStrategy } from '../strategies/entity-field.strategy';
import { RoleStrategy } from '../strategies/role.strategy';
import { RelatedEntityFieldStrategy } from '../strategies/related-entity-field.strategy';
import type { AppLoggerService } from '@packages/logger';

function createMockAppLogger(): AppLoggerService {
  const ctx = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { forContext: vi.fn().mockReturnValue(ctx), log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any;
}

function createMockDb() {
  const mockChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  };
  return {
    db: { select: vi.fn().mockReturnValue(mockChain) },
    _chain: mockChain,
  };
}

function eventContext(overrides: Partial<UserResolutionContext['event']> = {}): UserResolutionContext {
  return {
    event: {
      actorId: 'actor-1',
      entityType: 'tasks',
      entityId: 'task-1',
      payload: {},
      ...overrides,
    },
  };
}

describe('UserResolverRegistry', () => {
  it('should register and retrieve strategies', () => {
    const registry = new UserResolverRegistry(createMockAppLogger());
    const actor = new ActorStrategy();
    registry.registerStrategy(actor);

    expect(registry.getStrategy('actor')).toBe(actor);
    expect(registry.getStrategy('unknown')).toBeUndefined();
  });

  it('should list all registered strategies', () => {
    const registry = new UserResolverRegistry(createMockAppLogger());
    registry.registerStrategy(new ActorStrategy());

    const all = registry.getAllStrategies();
    expect(all).toHaveLength(1);
    expect(all[0].type).toBe('actor');
  });

  it('should return empty array for unknown strategy', async () => {
    const registry = new UserResolverRegistry(createMockAppLogger());

    const result = await registry.resolve(
      { strategy: 'unknown' as any },
      eventContext(),
    );

    expect(result).toEqual([]);
  });

  it('should catch strategy errors and return empty array', async () => {
    const registry = new UserResolverRegistry(createMockAppLogger());
    registry.registerStrategy({
      type: 'broken',
      label: 'Broken',
      configSchema: {},
      resolve: () => { throw new Error('boom'); },
    });

    const result = await registry.resolve(
      { strategy: 'broken' as any },
      eventContext(),
    );

    expect(result).toEqual([]);
  });

  it('should resolve all user slots', async () => {
    const registry = new UserResolverRegistry(createMockAppLogger());
    registry.registerStrategy(new ActorStrategy());

    const result = await registry.resolveAll(
      {
        recipient: { strategy: 'actor' },
        watcher: { strategy: 'actor' },
      },
      eventContext(),
    );

    expect(result).toEqual({
      recipient: ['actor-1'],
      watcher: ['actor-1'],
    });
  });
});

describe('ActorStrategy', () => {
  it('should return actorId from event', async () => {
    const strategy = new ActorStrategy();
    const result = await strategy.resolve({ strategy: 'actor' }, eventContext());
    expect(result).toEqual(['actor-1']);
  });

  it('should return empty when actorId is null', async () => {
    const strategy = new ActorStrategy();
    const result = await strategy.resolve(
      { strategy: 'actor' },
      eventContext({ actorId: null }),
    );
    expect(result).toEqual([]);
  });

  it('should return empty when no event in context', async () => {
    const strategy = new ActorStrategy();
    const result = await strategy.resolve({ strategy: 'actor' }, {});
    expect(result).toEqual([]);
  });
});

describe('EntityFieldStrategy', () => {
  it('should resolve from event payload', async () => {
    const mockDb = createMockDb();
    const strategy = new EntityFieldStrategy(mockDb as any, () => undefined);

    const result = await strategy.resolve(
      { strategy: 'entity_field', config: { field: 'assigneeId' } },
      eventContext({ payload: { assigneeId: 'user-42' } }),
    );

    expect(result).toEqual(['user-42']);
  });

  it('should resolve from entity data when not in payload', async () => {
    const mockDb = createMockDb();
    const strategy = new EntityFieldStrategy(mockDb as any, () => undefined);

    const result = await strategy.resolve(
      { strategy: 'entity_field', config: { field: 'assigneeId' } },
      {
        event: { actorId: 'a', entityType: 'tasks', entityId: 't-1', payload: {} },
        entityData: { assigneeId: 'user-99' },
      },
    );

    expect(result).toEqual(['user-99']);
  });

  it('should fall back to DB query when not in payload or entity data', async () => {
    const mockDb = createMockDb();
    const fakeTable = { id: 'id-col', assigneeId: 'assignee-col' };
    mockDb._chain.limit.mockResolvedValueOnce([{ value: 'user-from-db' }]);

    const strategy = new EntityFieldStrategy(
      mockDb as any,
      () => ({ table: fakeTable, fields: {}, userFields: {} }),
    );

    const result = await strategy.resolve(
      { strategy: 'entity_field', config: { field: 'assigneeId' } },
      eventContext({ payload: {} }),
    );

    expect(result).toEqual(['user-from-db']);
  });

  it('should resolve an array-valued payload field (e.g. mentionedUserIds)', async () => {
    const mockDb = createMockDb();
    const strategy = new EntityFieldStrategy(mockDb as any, () => undefined);

    const result = await strategy.resolve(
      { strategy: 'entity_field', config: { field: 'newMentionedUserIds' } },
      eventContext({ payload: { newMentionedUserIds: ['u-1', 'u-2', 'u-3'] } }),
    );

    expect(result).toEqual(['u-1', 'u-2', 'u-3']);
  });

  it('should skip non-string entries in array payload fields', async () => {
    const mockDb = createMockDb();
    const strategy = new EntityFieldStrategy(mockDb as any, () => undefined);

    const result = await strategy.resolve(
      { strategy: 'entity_field', config: { field: 'ids' } },
      eventContext({ payload: { ids: ['u-1', null, undefined, '', 42, 'u-2'] as never } }),
    );

    expect(result).toEqual(['u-1', 'u-2']);
  });

  it('should return empty when field not configured', async () => {
    const mockDb = createMockDb();
    const strategy = new EntityFieldStrategy(mockDb as any, () => undefined);

    const result = await strategy.resolve(
      { strategy: 'entity_field', config: {} },
      eventContext(),
    );

    expect(result).toEqual([]);
  });

  it('should return empty when no field config at all', async () => {
    const mockDb = createMockDb();
    const strategy = new EntityFieldStrategy(mockDb as any, () => undefined);

    const result = await strategy.resolve(
      { strategy: 'entity_field' },
      eventContext(),
    );

    expect(result).toEqual([]);
  });

  it('should return empty when entity resolver not found for DB fallback', async () => {
    const mockDb = createMockDb();
    const strategy = new EntityFieldStrategy(mockDb as any, () => undefined);

    const result = await strategy.resolve(
      { strategy: 'entity_field', config: { field: 'assigneeId' } },
      eventContext({ payload: {} }),
    );

    expect(result).toEqual([]);
  });
});

describe('RoleStrategy', () => {
  it('should resolve users by role from DB', async () => {
    const mockDb = createMockDb();
    mockDb._chain.where.mockResolvedValueOnce([
      { userId: 'user-1' },
      { userId: 'user-2' },
    ]);

    const strategy = new RoleStrategy(mockDb as any);

    const result = await strategy.resolve(
      { strategy: 'role', config: { roleId: 'role-1' } },
      eventContext(),
    );

    expect(result).toEqual(['user-1', 'user-2']);
  });

  it('should return empty when no roleId config', async () => {
    const mockDb = createMockDb();
    const strategy = new RoleStrategy(mockDb as any);

    const result = await strategy.resolve(
      { strategy: 'role', config: {} },
      eventContext(),
    );

    expect(result).toEqual([]);
  });

  it('should return empty when no config at all', async () => {
    const mockDb = createMockDb();
    const strategy = new RoleStrategy(mockDb as any);

    const result = await strategy.resolve(
      { strategy: 'role' },
      eventContext(),
    );

    expect(result).toEqual([]);
  });
});

describe('RelatedEntityFieldStrategy', () => {
  const resolution = (config: Record<string, unknown>) => ({
    strategy: 'related_entity_field' as const,
    config,
  });

  it('should resolve user from related entity via payload.after', async () => {
    const mockDb = createMockDb();
    const relatedTable = { id: 'id-col', hiringManager: 'hm-col' };
    mockDb._chain.limit.mockResolvedValueOnce([{ value: 'manager-1' }]);

    const strategy = new RelatedEntityFieldStrategy(
      mockDb as any,
      (entityType) => entityType === 'job_openings'
        ? { table: relatedTable, fields: {}, userFields: {} }
        : undefined,
    );

    const result = await strategy.resolve(
      resolution({ throughField: 'jobOpeningId', throughEntityType: 'job_openings', targetField: 'hiringManager' }),
      eventContext({ payload: { after: { jobOpeningId: 'jo-1' } } }),
    );

    expect(result).toEqual(['manager-1']);
  });

  it('should resolve user from related entity via top-level payload', async () => {
    const mockDb = createMockDb();
    const relatedTable = { id: 'id-col', hiringManager: 'hm-col' };
    mockDb._chain.limit.mockResolvedValueOnce([{ value: 'manager-2' }]);

    const strategy = new RelatedEntityFieldStrategy(
      mockDb as any,
      (entityType) => entityType === 'job_openings'
        ? { table: relatedTable, fields: {}, userFields: {} }
        : undefined,
    );

    const result = await strategy.resolve(
      resolution({ throughField: 'jobOpeningId', throughEntityType: 'job_openings', targetField: 'hiringManager' }),
      eventContext({ payload: { jobOpeningId: 'jo-2' } }),
    );

    expect(result).toEqual(['manager-2']);
  });

  it('should resolve user from related entity via entityData fallback', async () => {
    const mockDb = createMockDb();
    const relatedTable = { id: 'id-col', hiringManager: 'hm-col' };
    mockDb._chain.limit.mockResolvedValueOnce([{ value: 'manager-3' }]);

    const strategy = new RelatedEntityFieldStrategy(
      mockDb as any,
      (entityType) => entityType === 'job_openings'
        ? { table: relatedTable, fields: {}, userFields: {} }
        : undefined,
    );

    const result = await strategy.resolve(
      resolution({ throughField: 'jobOpeningId', throughEntityType: 'job_openings', targetField: 'hiringManager' }),
      {
        event: { actorId: 'a', entityType: 'applications', entityId: 'app-1', payload: {} },
        entityData: { jobOpeningId: 'jo-3' },
      },
    );

    expect(result).toEqual(['manager-3']);
  });

  it('should fall back to DB for throughField when not in payload or entityData', async () => {
    const mockDb = createMockDb();
    const sourceTable = { id: 'id-col', jobOpeningId: 'jo-col' };
    const relatedTable = { id: 'id-col', hiringManager: 'hm-col' };

    // First DB call: resolve throughField from source entity
    mockDb._chain.limit.mockResolvedValueOnce([{ value: 'jo-from-db' }]);
    // Second DB call: resolve targetField from related entity
    mockDb._chain.limit.mockResolvedValueOnce([{ value: 'manager-db' }]);

    const strategy = new RelatedEntityFieldStrategy(
      mockDb as any,
      (entityType) => {
        if (entityType === 'applications') return { table: sourceTable, fields: {}, userFields: {} };
        if (entityType === 'job_openings') return { table: relatedTable, fields: {}, userFields: {} };
        return undefined;
      },
    );

    const result = await strategy.resolve(
      resolution({ throughField: 'jobOpeningId', throughEntityType: 'job_openings', targetField: 'hiringManager' }),
      eventContext({ entityType: 'applications', entityId: 'app-1', payload: {} }),
    );

    expect(result).toEqual(['manager-db']);
  });

  it('should handle multi-user array fields on related entity', async () => {
    const mockDb = createMockDb();
    const relatedTable = { id: 'id-col', interviewers: 'int-col' };
    mockDb._chain.limit.mockResolvedValueOnce([{ value: ['user-1', 'user-2', 'user-3'] }]);

    const strategy = new RelatedEntityFieldStrategy(
      mockDb as any,
      (entityType) => entityType === 'interviews'
        ? { table: relatedTable, fields: {}, userFields: {} }
        : undefined,
    );

    const result = await strategy.resolve(
      resolution({ throughField: 'interviewId', throughEntityType: 'interviews', targetField: 'interviewers' }),
      eventContext({ payload: { interviewId: 'int-1' } }),
    );

    expect(result).toEqual(['user-1', 'user-2', 'user-3']);
  });

  it('should return empty when config is incomplete', async () => {
    const mockDb = createMockDb();
    const strategy = new RelatedEntityFieldStrategy(mockDb as any, () => undefined);

    expect(await strategy.resolve(resolution({}), eventContext())).toEqual([]);
    expect(await strategy.resolve(resolution({ throughField: 'x' }), eventContext())).toEqual([]);
    expect(await strategy.resolve(resolution({ throughField: 'x', throughEntityType: 'y' }), eventContext())).toEqual([]);
  });

  it('should return empty when related entity resolver not found', async () => {
    const mockDb = createMockDb();
    const strategy = new RelatedEntityFieldStrategy(mockDb as any, () => undefined);

    const result = await strategy.resolve(
      resolution({ throughField: 'jobOpeningId', throughEntityType: 'job_openings', targetField: 'hiringManager' }),
      eventContext({ payload: { after: { jobOpeningId: 'jo-1' } } }),
    );

    expect(result).toEqual([]);
  });

  it('should return empty when targetField column not found on related table', async () => {
    const mockDb = createMockDb();
    const relatedTable = { id: 'id-col' }; // no hiringManager column
    const strategy = new RelatedEntityFieldStrategy(
      mockDb as any,
      () => ({ table: relatedTable, fields: {}, userFields: {} }),
    );

    const result = await strategy.resolve(
      resolution({ throughField: 'jobOpeningId', throughEntityType: 'job_openings', targetField: 'hiringManager' }),
      eventContext({ payload: { after: { jobOpeningId: 'jo-1' } } }),
    );

    expect(result).toEqual([]);
  });

  it('should return empty when related entity user field is null', async () => {
    const mockDb = createMockDb();
    const relatedTable = { id: 'id-col', hiringManager: 'hm-col' };
    mockDb._chain.limit.mockResolvedValueOnce([{ value: null }]);

    const strategy = new RelatedEntityFieldStrategy(
      mockDb as any,
      () => ({ table: relatedTable, fields: {}, userFields: {} }),
    );

    const result = await strategy.resolve(
      resolution({ throughField: 'jobOpeningId', throughEntityType: 'job_openings', targetField: 'hiringManager' }),
      eventContext({ payload: { after: { jobOpeningId: 'jo-1' } } }),
    );

    expect(result).toEqual([]);
  });
});
