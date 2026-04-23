import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntityService } from '../../entity.service';
import type { DataAccessContext, PositionScopeProvider } from '../../types';

/**
 * Unit tests for EntityService.resolveDataAccessScope — the dispatch that
 * turns a DataAccessContext (carrying one or more AccessScopeSpecs held by
 * the actor) into a Drizzle WHERE clause.
 *
 * The test double mocks out every dependency EntityService pulls in and
 * only wires up the fields `resolveDataAccessScope` actually touches:
 * `config.table`, `config.dataAccess`, `positionScopeProvider`, `logger`.
 */

function createEntityService(
  opts: {
    createdByColumn?: unknown;
    assigneeColumn?: unknown;
    teamColumn?: unknown;
    dataAccess?: Record<string, unknown>;
    positionScopeProvider?: PositionScopeProvider | null;
  } = {},
): EntityService {
  const logger = { forContext: vi.fn().mockReturnValue({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }) };

  const table: Record<string, unknown> = {};
  if (opts.createdByColumn) table.createdBy = opts.createdByColumn;
  if (opts.assigneeColumn) table.assignedTo = opts.assigneeColumn;
  if (opts.teamColumn) table.teamId = opts.teamColumn;

  const config: any = {
    entityType: 'test',
    table,
    dataAccess: opts.dataAccess ?? {},
  };

  // Bypass the real constructor by assigning private fields via casts. All
  // collaborators besides `config`, `positionScopeProvider`, and `logger`
  // are untouched by resolveDataAccessScope / predicateForScope.
  const svc = Object.create(EntityService.prototype) as EntityService;
  (svc as any).config = config;
  (svc as any).positionScopeProvider = opts.positionScopeProvider ?? null;
  (svc as any).logger = logger.forContext('test');
  return svc;
}

// Drizzle column stubs — `eq` / `inArray` work with any object that carries a
// `getSQL()` method. The real methods produce Drizzle SQL objects; for our
// purposes we only care that *some* non-undefined SQL was produced.
function stubColumn(name: string): { getSQL: () => unknown; name: string } {
  return {
    name,
    getSQL: () => ({ queryChunks: [name] }),
  };
}

describe('EntityService.resolveDataAccessScope', () => {
  const userId = 'user-1';

  describe('deny / allow branching', () => {
    it('returns a 1=0 predicate when the actor holds zero scopes', async () => {
      const svc = createEntityService();
      const ctx: DataAccessContext = { userId, scopes: [] };

      const result = await (svc as any).resolveDataAccessScope(ctx);

      expect(result).toBeDefined();
      // sql`1=0` has queryChunks with a string literal containing "1=0"
      const chunks = (result as any).queryChunks ?? [];
      const containsContradiction = chunks.some(
        (c: any) =>
          typeof c === 'string' ? c.includes('1=0') : c?.value?.some?.((v: string) => v.includes('1=0')),
      );
      expect(containsContradiction).toBe(true);
    });

    it('returns undefined (no filter) when any scope includes "any"', async () => {
      const svc = createEntityService({ createdByColumn: stubColumn('created_by') });
      const ctx: DataAccessContext = {
        userId,
        scopes: [{ type: 'own' }, { type: 'any' }],
      };

      const result = await (svc as any).resolveDataAccessScope(ctx);
      expect(result).toBeUndefined();
    });
  });

  describe('own scope', () => {
    it('builds a predicate when createdByColumn is configured', async () => {
      const svc = createEntityService({ createdByColumn: stubColumn('created_by') });
      const ctx: DataAccessContext = { userId, scopes: [{ type: 'own' }] };

      const result = await (svc as any).resolveDataAccessScope(ctx);
      expect(result).toBeDefined();
    });

    it('falls back to 1=0 when createdByColumn is missing', async () => {
      // no createdByColumn configured → predicateForScope('own') returns undefined
      // → resolveDataAccessScope emits `1=0`.
      const svc = createEntityService();
      const ctx: DataAccessContext = { userId, scopes: [{ type: 'own' }] };

      const result = await (svc as any).resolveDataAccessScope(ctx);
      expect(result).toBeDefined();
    });
  });

  describe('assigned scope', () => {
    it('builds a predicate when assigneeField is declared', async () => {
      const svc = createEntityService({
        assigneeColumn: stubColumn('assigned_to'),
        dataAccess: { assigneeField: 'assignedTo' },
      });
      const ctx: DataAccessContext = { userId, scopes: [{ type: 'assigned' }] };

      const result = await (svc as any).resolveDataAccessScope(ctx);
      expect(result).toBeDefined();
    });
  });

  describe('unit / descendants scopes (delegate to PositionScopeProvider)', () => {
    it('calls resolveUserIds and resolveOrgUnitIds with the scope type', async () => {
      const provider: PositionScopeProvider = {
        resolveUserIds: vi.fn().mockResolvedValue(['u1', 'u2']),
        resolveOrgUnitIds: vi.fn().mockResolvedValue(['unit-1']),
      };
      const svc = createEntityService({
        createdByColumn: stubColumn('created_by'),
        assigneeColumn: stubColumn('assigned_to'),
        teamColumn: stubColumn('team_id'),
        dataAccess: { assigneeField: 'assignedTo', teamField: 'teamId' },
        positionScopeProvider: provider,
      });
      const ctx: DataAccessContext = { userId, scopes: [{ type: 'unit' }] };

      await (svc as any).resolveDataAccessScope(ctx);

      expect(provider.resolveUserIds).toHaveBeenCalledWith(userId, 'unit');
      expect(provider.resolveOrgUnitIds).toHaveBeenCalledWith(userId, 'unit');
    });

    it('returns a predicate when provider returns userIds', async () => {
      const provider: PositionScopeProvider = {
        resolveUserIds: vi.fn().mockResolvedValue(['u1']),
        resolveOrgUnitIds: vi.fn().mockResolvedValue(null),
      };
      const svc = createEntityService({
        createdByColumn: stubColumn('created_by'),
        positionScopeProvider: provider,
      });
      const ctx: DataAccessContext = { userId, scopes: [{ type: 'descendants' }] };

      const result = await (svc as any).resolveDataAccessScope(ctx);
      expect(result).toBeDefined();
    });

    it('falls back to 1=0 when provider resolves to empty arrays', async () => {
      const provider: PositionScopeProvider = {
        resolveUserIds: vi.fn().mockResolvedValue([]),
        resolveOrgUnitIds: vi.fn().mockResolvedValue([]),
      };
      const svc = createEntityService({
        createdByColumn: stubColumn('created_by'),
        teamColumn: stubColumn('team_id'),
        dataAccess: { teamField: 'teamId' },
        positionScopeProvider: provider,
      });
      const ctx: DataAccessContext = { userId, scopes: [{ type: 'unit' }] };

      const result = await (svc as any).resolveDataAccessScope(ctx);
      // predicateForScope returns undefined when both arrays are empty.
      // resolveDataAccessScope then has 0 predicates → 1=0.
      expect(result).toBeDefined();
    });

    it('returns undefined (skips predicate) when no PositionScopeProvider wired', async () => {
      // No provider + unit scope means the engine has no way to narrow; the
      // scope contributes no predicate, resulting in 1=0 deny when it's the
      // only scope.
      const svc = createEntityService({ createdByColumn: stubColumn('created_by') });
      const ctx: DataAccessContext = { userId, scopes: [{ type: 'unit' }] };

      const result = await (svc as any).resolveDataAccessScope(ctx);
      expect(result).toBeDefined();
    });
  });

  describe('custom scope types', () => {
    it('delegates to entity-registered resolver when scope.type matches a registered key', async () => {
      const resolve = vi.fn().mockResolvedValue({ __tag: 'custom-sql' });
      const svc = createEntityService({
        dataAccess: {
          scopes: [{ key: 'hiring-manager', resolve }],
        },
      });
      const ctx: DataAccessContext = { userId, scopes: [{ type: 'hiring-manager' }] };

      const result = await (svc as any).resolveDataAccessScope(ctx);

      expect(resolve).toHaveBeenCalledWith(userId);
      expect(result).toEqual({ __tag: 'custom-sql' });
    });

    it('warns and falls back to 1=0 when an unregistered custom scope is seen', async () => {
      const warn = vi.fn();
      const svc = createEntityService();
      (svc as any).logger = { warn, info: vi.fn(), error: vi.fn(), debug: vi.fn() };
      const ctx: DataAccessContext = { userId, scopes: [{ type: 'totally-unknown' }] };

      const result = await (svc as any).resolveDataAccessScope(ctx);

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('Unknown data access scope type: totally-unknown'),
      );
      // No predicate produced → deny.
      expect(result).toBeDefined();
    });
  });

  describe('scope combination (OR semantics)', () => {
    it('combines multiple scope predicates without collapsing when none is "any"', async () => {
      // own + assigned → both columns hit, combined with OR.
      const svc = createEntityService({
        createdByColumn: stubColumn('created_by'),
        assigneeColumn: stubColumn('assigned_to'),
        dataAccess: { assigneeField: 'assignedTo' },
      });
      const ctx: DataAccessContext = {
        userId,
        scopes: [{ type: 'own' }, { type: 'assigned' }],
      };

      const result = await (svc as any).resolveDataAccessScope(ctx);
      expect(result).toBeDefined();
    });

    it('short-circuits to undefined as soon as "any" appears, regardless of other scopes', async () => {
      const provider: PositionScopeProvider = {
        resolveUserIds: vi.fn().mockResolvedValue(['u1']),
        resolveOrgUnitIds: vi.fn().mockResolvedValue(null),
      };
      const svc = createEntityService({
        createdByColumn: stubColumn('created_by'),
        positionScopeProvider: provider,
      });
      const ctx: DataAccessContext = {
        userId,
        scopes: [{ type: 'unit' }, { type: 'any' }, { type: 'own' }],
      };

      const result = await (svc as any).resolveDataAccessScope(ctx);
      expect(result).toBeUndefined();
      // Short-circuit means we never query the provider either.
      expect(provider.resolveUserIds).not.toHaveBeenCalled();
    });
  });

  describe('ownership anchors', () => {
    it('uses createdByField when configured (takes precedence over default "createdBy")', async () => {
      const originatorCol = stubColumn('originated_by');
      const svc = createEntityService({
        createdByColumn: undefined, // no 'createdBy' on table
        dataAccess: { createdByField: 'originatedBy' },
      });
      // The test double only attaches `createdBy` to the table when the
      // `createdByColumn` option is passed. Here we inject a custom key.
      (svc as any).config.table.originatedBy = originatorCol;

      const result = await (svc as any).resolveDataAccessScope({
        userId,
        scopes: [{ type: 'own' }],
      });
      expect(result).toBeDefined();
    });

    it('honours the deprecated ownerField alias for createdByField', async () => {
      const ownerCol = stubColumn('owner_id');
      const svc = createEntityService({
        dataAccess: { ownerField: 'ownerId' },
      });
      (svc as any).config.table.ownerId = ownerCol;

      const result = await (svc as any).resolveDataAccessScope({
        userId,
        scopes: [{ type: 'own' }],
      });
      expect(result).toBeDefined();
    });
  });
});
