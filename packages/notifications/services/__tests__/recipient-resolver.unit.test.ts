import { describe, it, expect, vi } from 'vitest';
import { RecipientResolver } from '../recipient-resolver';
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
    eventName: 'users.UserCreated',
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
    where: vi.fn().mockResolvedValue([]),
  };
  return {
    select: vi.fn().mockReturnValue(mockChain),
    _chain: mockChain,
  };
}

describe('RecipientResolver', () => {
  it('should resolve actor from event', async () => {
    const mockDb = createMockDb();
    const resolver = new RecipientResolver({ db: mockDb } as any);

    const result = await resolver.resolve(buildRule(), buildEvent());

    expect(result).toEqual(['actor-1']);
  });

  it('should return empty array when actor is null', async () => {
    const mockDb = createMockDb();
    const resolver = new RecipientResolver({ db: mockDb } as any);

    const result = await resolver.resolve(buildRule(), buildEvent({ actorId: null }));

    expect(result).toEqual([]);
  });

  it('should resolve entity_owner from payload', async () => {
    const mockDb = createMockDb();
    const resolver = new RecipientResolver({ db: mockDb } as any);

    const result = await resolver.resolve(
      buildRule({ recipientStrategy: 'entity_owner' }),
      buildEvent({ payload: { ownerId: 'owner-1' } }),
    );

    expect(result).toEqual(['owner-1']);
  });

  it('should return empty for entity_owner with no ownerId in payload', async () => {
    const mockDb = createMockDb();
    const resolver = new RecipientResolver({ db: mockDb } as any);

    const result = await resolver.resolve(
      buildRule({ recipientStrategy: 'entity_owner' }),
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
    const resolver = new RecipientResolver({ db: mockDb } as any);

    const result = await resolver.resolve(
      buildRule({ recipientStrategy: 'role', recipientConfig: { roleId: 'role-1' } }),
      buildEvent(),
    );

    expect(result).toEqual(['user-1', 'user-2']);
  });

  it('should return empty for role strategy with no roleId config', async () => {
    const mockDb = createMockDb();
    const resolver = new RecipientResolver({ db: mockDb } as any);

    const result = await resolver.resolve(
      buildRule({ recipientStrategy: 'role', recipientConfig: {} }),
      buildEvent(),
    );

    expect(result).toEqual([]);
  });

  it('should return empty for unknown strategy', async () => {
    const mockDb = createMockDb();
    const resolver = new RecipientResolver({ db: mockDb } as any);

    const result = await resolver.resolve(
      buildRule({ recipientStrategy: 'unknown' as any }),
      buildEvent(),
    );

    expect(result).toEqual([]);
  });
});
