import { describe, it, expect, vi } from 'vitest';
import { RecipientResolver } from '../recipient-resolver';
import { EntityResolverRegistry } from '../entity-resolver-registry';
import type { DomainEvent } from '@packages/events';
import type { NotificationRule } from '../../types';

function buildEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    eventName: 'users.UserCreated',
    entityType: 'users',
    entityId: 'user-1',
    actorId: 'actor-1',
    correlationId: 'corr-1',
    occurredAt: '2026-01-01T00:00:00Z',
    payload: {},
    ...overrides,
  };
}

function buildRule(overrides: Partial<NotificationRule> = {}): NotificationRule {
  return {
    id: 'rule-1',
    name: 'Test Rule',
    triggerType: 'event',
    eventName: 'users.UserCreated',
    delayAmount: null,
    delayUnit: null,
    scheduleEntityType: null,
    scheduleDateField: null,
    scheduleDateOperator: null,
    scheduleDateAmounts: null,
    scheduleDateUnit: null,
    conditions: null,
    recipientStrategy: 'actor',
    recipientConfig: null,
    isActive: true,
    createdAt: new Date(),
    ...overrides,
  };
}

function createMockDb() {
  const mockChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  };
  return {
    select: vi.fn().mockReturnValue(mockChain),
    _chain: mockChain,
  };
}

describe('RecipientResolver', () => {
  it('should resolve actor from event', async () => {
    const mockDb = createMockDb();
    const registry = new EntityResolverRegistry();
    const resolver = new RecipientResolver({ db: mockDb } as any, registry);

    const result = await resolver.resolve(buildRule(), buildEvent());

    expect(result).toEqual(['actor-1']);
  });

  it('should return empty array when actor is null', async () => {
    const mockDb = createMockDb();
    const registry = new EntityResolverRegistry();
    const resolver = new RecipientResolver({ db: mockDb } as any, registry);

    const result = await resolver.resolve(buildRule(), buildEvent({ actorId: null }));

    expect(result).toEqual([]);
  });

  it('should resolve entity_owner from event payload using configured field', async () => {
    const mockDb = createMockDb();
    const registry = new EntityResolverRegistry();
    const resolver = new RecipientResolver({ db: mockDb } as any, registry);

    const result = await resolver.resolve(
      buildRule({
        recipientStrategy: 'entity_owner',
        recipientConfig: { field: 'assigneeId' },
      }),
      buildEvent({ payload: { assigneeId: 'user-42' } }),
    );

    expect(result).toEqual(['user-42']);
  });

  it('should return empty for entity_owner with no field in recipientConfig', async () => {
    const mockDb = createMockDb();
    const registry = new EntityResolverRegistry();
    const resolver = new RecipientResolver({ db: mockDb } as any, registry);

    const result = await resolver.resolve(
      buildRule({ recipientStrategy: 'entity_owner', recipientConfig: {} }),
      buildEvent(),
    );

    expect(result).toEqual([]);
  });

  it('should resolve by role from DB', async () => {
    const mockDb = createMockDb();
    mockDb._chain.where.mockResolvedValueOnce([
      { userId: 'user-1' },
      { userId: 'user-2' },
    ]);
    const registry = new EntityResolverRegistry();
    const resolver = new RecipientResolver({ db: mockDb } as any, registry);

    const result = await resolver.resolve(
      buildRule({ recipientStrategy: 'role', recipientConfig: { roleId: 'role-1' } }),
      buildEvent(),
    );

    expect(result).toEqual(['user-1', 'user-2']);
  });

  it('should return empty for role strategy with no roleId config', async () => {
    const mockDb = createMockDb();
    const registry = new EntityResolverRegistry();
    const resolver = new RecipientResolver({ db: mockDb } as any, registry);

    const result = await resolver.resolve(
      buildRule({ recipientStrategy: 'role', recipientConfig: {} }),
      buildEvent(),
    );

    expect(result).toEqual([]);
  });

  it('should return empty for unknown strategy', async () => {
    const mockDb = createMockDb();
    const registry = new EntityResolverRegistry();
    const resolver = new RecipientResolver({ db: mockDb } as any, registry);

    const result = await resolver.resolve(
      buildRule({ recipientStrategy: 'unknown' as any }),
      buildEvent(),
    );

    expect(result).toEqual([]);
  });
});
