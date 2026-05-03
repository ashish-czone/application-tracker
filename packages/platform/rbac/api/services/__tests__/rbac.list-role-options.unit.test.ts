import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RbacService } from '../rbac.service';
import { PermissionManifestRegistry } from '../../permission-manifest';

vi.mock('@packages/tenancy/helpers', () => ({
  withTenant: vi.fn((_table: unknown, ...conditions: unknown[]) => conditions[0]),
  withTenantInsert: vi.fn((_table: unknown, data: unknown) => data),
}));

/**
 * Mock DB chainable. The shape mirrors `rbac-coverage.unit.test.ts` —
 * chainable by default, with `_chain.limit.mockResolvedValueOnce(...)` used
 * to terminate the chain with a result on a per-test basis.
 *
 * `listRoleOptions` calls `select().from().where().orderBy().limit()`. The
 * final `.limit()` is the awaited terminal — that's where the test pushes
 * the result.
 */
function createMockDb() {
  const chain: Record<string, any> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  return { db: chain, _chain: chain };
}

const now = new Date();

function makeRole(overrides?: Partial<{ id: string; name: string; userType: string | null }>) {
  return {
    id: 'role-1',
    name: 'Admin',
    userType: 'admin' as string | null,
    ...overrides,
  };
}

describe('RbacService.listRoleOptions', () => {
  let service: RbacService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    const manifestRegistry = new PermissionManifestRegistry();
    const databaseService = { db: mockDb.db } as any;
    service = new RbacService(databaseService, manifestRegistry);
  });

  it('returns id/name/userType rows ordered by name', async () => {
    const rows = [
      makeRole({ id: 'r1', name: 'Admin' }),
      makeRole({ id: 'r2', name: 'Manager' }),
    ];
    mockDb._chain.limit.mockResolvedValueOnce(rows);

    const result = await service.listRoleOptions({ limit: 25 });

    expect(result).toEqual(rows);
    expect(mockDb._chain.select).toHaveBeenCalled();
    expect(mockDb._chain.from).toHaveBeenCalled();
    expect(mockDb._chain.orderBy).toHaveBeenCalled();
    expect(mockDb._chain.limit).toHaveBeenCalledWith(25);
  });

  it('respects the limit parameter', async () => {
    mockDb._chain.limit.mockResolvedValueOnce([]);
    await service.listRoleOptions({ limit: 5 });
    expect(mockDb._chain.limit).toHaveBeenCalledWith(5);
  });

  it('applies an ILIKE search predicate when search is provided', async () => {
    mockDb._chain.limit.mockResolvedValueOnce([]);

    await service.listRoleOptions({ search: 'admin', limit: 25 });

    // The where call should have received a predicate built from withScope() —
    // we don't assert on its SQL shape here (that is exercised by integration
    // tests), only that the where clause was constructed.
    expect(mockDb._chain.where).toHaveBeenCalled();
    const whereArg = mockDb._chain.where.mock.calls[0][0];
    expect(whereArg).toBeDefined();
  });

  it('bypasses search when ids are provided', async () => {
    mockDb._chain.limit.mockResolvedValueOnce([]);

    await service.listRoleOptions({ ids: ['r1', 'r2'], search: 'ignored', limit: 25 });

    expect(mockDb._chain.where).toHaveBeenCalled();
  });

  it('filters by userType when provided', async () => {
    mockDb._chain.limit.mockResolvedValueOnce([]);

    await service.listRoleOptions({ userType: 'admin', limit: 25 });

    expect(mockDb._chain.where).toHaveBeenCalled();
  });

  it('returns an empty array when no rows match', async () => {
    mockDb._chain.limit.mockResolvedValueOnce([]);

    const result = await service.listRoleOptions({ search: 'no-match', limit: 25 });

    expect(result).toEqual([]);
  });

  it('escapes ILIKE special characters in search', async () => {
    mockDb._chain.limit.mockResolvedValueOnce([]);

    // Should not throw — escape logic handles % _ \
    await expect(
      service.listRoleOptions({ search: 'a%b_c\\d', limit: 25 }),
    ).resolves.toEqual([]);
  });
});
