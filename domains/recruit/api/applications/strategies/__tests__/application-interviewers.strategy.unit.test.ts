import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApplicationInterviewersStrategy } from '../application-interviewers.strategy';
import type { UserResolutionContext } from '@packages/automations';

/**
 * Creates a mock DatabaseService with a query builder that supports
 * both terminal `.where()` and chained `.where().limit()` patterns.
 *
 * Use `pushResult(rows)` to queue results in call order.
 */
function createMockDb() {
  const results: unknown[][] = [];
  let callIndex = 0;

  const getResult = () => results[callIndex++] ?? [];

  // Each "terminal" call (.where() or .limit()) resolves to the next queued result
  const mockChain: any = {
    from: vi.fn().mockImplementation(() => mockChain),
    where: vi.fn().mockImplementation(() => mockChain),
    limit: vi.fn().mockImplementation(() => Promise.resolve(getResult())),
    orderBy: vi.fn().mockImplementation(() => mockChain),
    // Make the chain thenable so await on .where() works for queries without .limit()
    then: vi.fn().mockImplementation((resolve: (v: unknown) => void) => resolve(getResult())),
  };

  return {
    db: { select: vi.fn().mockReturnValue(mockChain) },
    pushResult: (rows: unknown[]) => results.push(rows),
  };
}

describe('ApplicationInterviewersStrategy', () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let strategy: ApplicationInterviewersStrategy;

  beforeEach(() => {
    mockDb = createMockDb();
    strategy = new ApplicationInterviewersStrategy(mockDb as any);
  });

  it('should have correct type and label', () => {
    expect(strategy.type).toBe('application_interviewers');
    expect(strategy.label).toBe('Application Interviewers');
    expect(strategy.configSchema).toEqual({});
  });

  it('should return empty when no entityId in context', async () => {
    const result = await strategy.resolve({ strategy: 'application_interviewers' }, {});
    expect(result).toEqual([]);
  });

  it('should resolve interviewers from payload + multi-values', async () => {
    // Query 1: find interviews by candidateId + jobOpeningId (terminal .where())
    mockDb.pushResult([{ id: 'interview-1' }, { id: 'interview-2' }]);
    // Query 2: get interviewers for interview-1 (terminal .where())
    mockDb.pushResult([{ targetId: 'user-a' }, { targetId: 'user-b' }]);
    // Query 3: get interviewers for interview-2 (terminal .where())
    mockDb.pushResult([{ targetId: 'user-b' }, { targetId: 'user-c' }]);

    const context: UserResolutionContext = {
      event: {
        actorId: 'actor-1',
        entityType: 'applications',
        entityId: 'app-1',
        payload: {
          after: { candidateId: 'cand-1', jobOpeningId: 'jo-1' },
        },
      },
    };

    const result = await strategy.resolve({ strategy: 'application_interviewers' }, context);

    expect(result).toHaveLength(3);
    expect(new Set(result)).toEqual(new Set(['user-a', 'user-b', 'user-c']));
  });

  it('should return empty when application has no interviews', async () => {
    // Query 1: no interviews found
    mockDb.pushResult([]);

    const context: UserResolutionContext = {
      event: {
        actorId: 'actor-1',
        entityType: 'applications',
        entityId: 'app-1',
        payload: {
          after: { candidateId: 'cand-1', jobOpeningId: 'jo-1' },
        },
      },
    };

    const result = await strategy.resolve({ strategy: 'application_interviewers' }, context);
    expect(result).toEqual([]);
  });

  it('should fall back to DB when payload has no application data', async () => {
    // Query 1: get application data via DB (.limit(1))
    mockDb.pushResult([{ candidateId: 'cand-db', jobOpeningId: 'jo-db' }]);
    // Query 2: find interviews (terminal .where())
    mockDb.pushResult([{ id: 'int-1' }]);
    // Query 3: get interviewers (terminal .where())
    mockDb.pushResult([{ targetId: 'user-x' }]);

    const context: UserResolutionContext = {
      event: {
        actorId: 'actor-1',
        entityType: 'applications',
        entityId: 'app-1',
        payload: {},
      },
    };

    const result = await strategy.resolve({ strategy: 'application_interviewers' }, context);
    expect(result).toEqual(['user-x']);
  });

  it('should return empty when application not found in DB', async () => {
    // Query 1: application not found
    mockDb.pushResult([]);

    const context: UserResolutionContext = {
      event: {
        actorId: 'actor-1',
        entityType: 'applications',
        entityId: 'app-missing',
        payload: {},
      },
    };

    const result = await strategy.resolve({ strategy: 'application_interviewers' }, context);
    expect(result).toEqual([]);
  });

  it('should resolve from entityData when no payload', async () => {
    // Query 1: find interviews
    mockDb.pushResult([{ id: 'int-1' }]);
    // Query 2: get interviewers
    mockDb.pushResult([{ targetId: 'user-y' }]);

    const context: UserResolutionContext = {
      entityId: 'app-1',
      entityData: { candidateId: 'cand-ctx', jobOpeningId: 'jo-ctx' },
    };

    const result = await strategy.resolve({ strategy: 'application_interviewers' }, context);
    expect(result).toEqual(['user-y']);
  });
});
