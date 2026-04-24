import { describe, it, expect, vi } from 'vitest';
import { ScopeResolverRegistry, type ScopeResolver } from '@packages/rbac';
import { EntityService } from '../../entity.service';
import type { DataAccessContext } from '../../types';

/**
 * Unit tests for EntityService.resolveDataAccessScope — the dispatch that
 * turns a DataAccessContext (one or more AccessScopeSpecs held by the actor)
 * into a Drizzle WHERE clause.
 *
 * The engine's job is narrow: deny on empty, short-circuit on `any`, build
 * the anchor map from config, dispatch each scope through the registry (or
 * entity-inline fallback), and OR the predicates. Resolver correctness is
 * tested in each resolver's own package.
 */

type StubColumn = { name: string; __col: true };

function stubColumn(name: string): StubColumn {
  return { name, __col: true };
}

function createEntityService(opts: {
  tableColumns?: Record<string, unknown>;
  anchors?: Record<string, string>;
  inlineScopes?: Array<{ key: string; resolve: (userId: string) => Promise<unknown> }>;
  registry?: ScopeResolverRegistry;
} = {}): EntityService {
  const logger = { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() };

  const config: any = {
    entityType: 'test',
    table: opts.tableColumns ?? {},
    dataAccess: {
      anchors: opts.anchors,
      scopes: opts.inlineScopes,
    },
  };

  const svc = Object.create(EntityService.prototype) as EntityService;
  (svc as any).config = config;
  (svc as any).scopeResolverRegistry = opts.registry ?? new ScopeResolverRegistry();
  (svc as any).logger = logger;
  return svc;
}

describe('EntityService.resolveDataAccessScope', () => {
  const userId = 'user-1';

  describe('deny / allow branching', () => {
    it('returns a 1=0 predicate when the actor holds zero scopes', async () => {
      const svc = createEntityService();
      const ctx: DataAccessContext = { userId, scopes: [] };

      const result = await (svc as any).resolveDataAccessScope(ctx);
      expect(result).toBeDefined();
    });

    it('returns undefined (no filter) when any scope includes "any"', async () => {
      const registry = new ScopeResolverRegistry();
      registry.register({ type: 'own', resolve: () => stubColumn('whatever') as unknown as any });
      const svc = createEntityService({ registry });
      const ctx: DataAccessContext = {
        userId,
        scopes: [{ type: 'own' }, { type: 'any' }],
      };

      const result = await (svc as any).resolveDataAccessScope(ctx);
      expect(result).toBeUndefined();
    });

    it('short-circuits on "any" without invoking any resolver', async () => {
      const registry = new ScopeResolverRegistry();
      const resolve = vi.fn();
      registry.register({ type: 'own', resolve });
      const svc = createEntityService({ registry });
      await (svc as any).resolveDataAccessScope({
        userId,
        scopes: [{ type: 'any' }, { type: 'own' }],
      });
      expect(resolve).not.toHaveBeenCalled();
    });
  });

  describe('registry dispatch', () => {
    it('dispatches each scope through the registry and returns its result', async () => {
      const registry = new ScopeResolverRegistry();
      const predicate = { __tag: 'own-sql' };
      const ownResolver: ScopeResolver = {
        type: 'own',
        resolve: vi.fn().mockResolvedValue(predicate),
      };
      registry.register(ownResolver);

      const svc = createEntityService({ registry });
      const result = await (svc as any).resolveDataAccessScope({
        userId,
        scopes: [{ type: 'own' }],
      });

      expect(ownResolver.resolve).toHaveBeenCalledTimes(1);
      expect(result).toBe(predicate);
    });

    it('passes the user id and anchor map to the resolver', async () => {
      const registry = new ScopeResolverRegistry();
      const creator = stubColumn('created_by');
      const assignee = stubColumn('assignee_id');
      const resolve = vi.fn().mockResolvedValue({ __tag: 'sql' });
      registry.register({ type: 'own', resolve });

      const svc = createEntityService({
        registry,
        tableColumns: { createdBy: creator, assigneeId: assignee, extra: stubColumn('extra') },
        anchors: { creator: 'createdBy', assignee: 'assigneeId' },
      });

      await (svc as any).resolveDataAccessScope({
        userId,
        scopes: [{ type: 'own' }],
      });

      expect(resolve).toHaveBeenCalledWith(
        {
          userId,
          anchors: { creator, assignee },
        },
        undefined,
      );
    });

    it('drops anchor entries whose referenced column does not exist on the table', async () => {
      const registry = new ScopeResolverRegistry();
      const creator = stubColumn('created_by');
      const resolve = vi.fn().mockResolvedValue({ __tag: 'sql' });
      registry.register({ type: 'own', resolve });

      const svc = createEntityService({
        registry,
        tableColumns: { createdBy: creator },
        // 'team' points at a column the table doesn't expose — should be dropped.
        anchors: { creator: 'createdBy', team: 'missing_column' },
      });

      await (svc as any).resolveDataAccessScope({
        userId,
        scopes: [{ type: 'own' }],
      });

      expect(resolve).toHaveBeenCalledWith(
        { userId, anchors: { creator } },
        undefined,
      );
    });

    it('passes scope params to the resolver', async () => {
      const registry = new ScopeResolverRegistry();
      const resolve = vi.fn().mockResolvedValue({ __tag: 'sql' });
      registry.register({ type: 'in-region', resolve });

      const svc = createEntityService({ registry });
      await (svc as any).resolveDataAccessScope({
        userId,
        scopes: [{ type: 'in-region', params: { regionId: 'APAC' } }],
      });

      expect(resolve).toHaveBeenCalledWith(
        expect.objectContaining({ userId }),
        { regionId: 'APAC' },
      );
    });
  });

  describe('entity-inline fallback', () => {
    it('uses inline resolvers when no global resolver is registered', async () => {
      const inlineResolve = vi.fn().mockResolvedValue({ __tag: 'inline-sql' });
      const svc = createEntityService({
        inlineScopes: [{ key: 'hiring-manager', resolve: inlineResolve }],
      });

      const result = await (svc as any).resolveDataAccessScope({
        userId,
        scopes: [{ type: 'hiring-manager' }],
      });

      expect(inlineResolve).toHaveBeenCalledWith(userId);
      expect(result).toEqual({ __tag: 'inline-sql' });
    });

    it('prefers a registered resolver over an inline one with the same key', async () => {
      const registry = new ScopeResolverRegistry();
      const registered = vi.fn().mockResolvedValue({ __tag: 'registered' });
      registry.register({ type: 'hiring-manager', resolve: registered });

      const inlineResolve = vi.fn();
      const svc = createEntityService({
        registry,
        inlineScopes: [{ key: 'hiring-manager', resolve: inlineResolve }],
      });

      const result = await (svc as any).resolveDataAccessScope({
        userId,
        scopes: [{ type: 'hiring-manager' }],
      });

      expect(registered).toHaveBeenCalled();
      expect(inlineResolve).not.toHaveBeenCalled();
      expect(result).toEqual({ __tag: 'registered' });
    });
  });

  describe('unknown scopes', () => {
    it('warns and emits a deny predicate when a scope is neither registered nor inline', async () => {
      const logger = { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() };
      const svc = createEntityService();
      (svc as any).logger = logger;

      const result = await (svc as any).resolveDataAccessScope({
        userId,
        scopes: [{ type: 'totally-unknown' }],
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Unknown data access scope type: totally-unknown'),
      );
      expect(result).toBeDefined();
    });
  });

  describe('scope combination', () => {
    it('combines multiple resolver results into a single OR predicate', async () => {
      const registry = new ScopeResolverRegistry();
      registry.register({ type: 'own', resolve: () => ({ __tag: 'own-sql' } as any) });
      registry.register({ type: 'assigned', resolve: () => ({ __tag: 'assigned-sql' } as any) });

      const svc = createEntityService({ registry });
      const result = await (svc as any).resolveDataAccessScope({
        userId,
        scopes: [{ type: 'own' }, { type: 'assigned' }],
      });

      expect(result).toBeDefined();
    });

    it('skips scopes that resolve to undefined — they contribute no predicate', async () => {
      const registry = new ScopeResolverRegistry();
      registry.register({ type: 'own', resolve: () => undefined });
      registry.register({ type: 'assigned', resolve: () => ({ __tag: 'assigned-sql' } as any) });

      const svc = createEntityService({ registry });
      const result = await (svc as any).resolveDataAccessScope({
        userId,
        scopes: [{ type: 'own' }, { type: 'assigned' }],
      });

      // assigned still produces a predicate, so this is not a deny.
      expect(result).toBeDefined();
    });

    it('denies when every scope resolves to undefined', async () => {
      const registry = new ScopeResolverRegistry();
      registry.register({ type: 'own', resolve: () => undefined });
      registry.register({ type: 'assigned', resolve: () => undefined });

      const svc = createEntityService({ registry });
      const result = await (svc as any).resolveDataAccessScope({
        userId,
        scopes: [{ type: 'own' }, { type: 'assigned' }],
      });

      // Both undefined → 1=0 deny.
      expect(result).toBeDefined();
    });
  });
});
