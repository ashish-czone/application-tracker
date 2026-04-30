import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq, sql, type SQL } from 'drizzle-orm';
import { PgDialect, pgTable, text } from 'drizzle-orm/pg-core';
import { DataAccessScopeService } from '../data-access-scope.service';
import { ScopeResolverRegistry, type ScopeResolver } from '../scope-resolver';
import type { DataAccessContext } from '../scope-context';

const dialect = new PgDialect();

const widgets = pgTable('widgets', {
  id: text('id').primaryKey(),
  createdBy: text('created_by'),
  assigneeId: text('assignee_id'),
  teamId: text('team_id'),
});

function makeService(): {
  service: DataAccessScopeService;
  registry: ScopeResolverRegistry;
} {
  const registry = new ScopeResolverRegistry();
  const logger = {
    forContext: () => ({
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      verbose: vi.fn(),
    }),
  } as never;
  return { service: new DataAccessScopeService(registry, logger), registry };
}

const ownResolver: ScopeResolver = {
  type: 'own',
  requiredAnchors: ['creator'],
  resolve(ctx) {
    const col = ctx.anchors.creator;
    if (!col) return undefined;
    return eq(col, ctx.userId);
  },
};

const assignedResolver: ScopeResolver = {
  type: 'assigned',
  requiredAnchors: ['assignee'],
  resolve(ctx) {
    const col = ctx.anchors.assignee;
    if (!col) return undefined;
    return eq(col, ctx.userId);
  },
};

function serialize(s: SQL): string {
  const { sql: text, params } = dialect.sqlToQuery(s);
  return `${text} :: ${JSON.stringify(params)}`;
}

describe('DataAccessScopeService.buildPredicate', () => {
  let service: DataAccessScopeService;
  let registry: ScopeResolverRegistry;

  beforeEach(() => {
    ({ service, registry } = makeService());
    registry.register(ownResolver);
    registry.register(assignedResolver);
  });

  it('returns 1=0 when the context holds no scopes', async () => {
    const ctx: DataAccessContext = { userId: 'u1', scopes: [] };
    const result = await service.buildPredicate(ctx, { anchors: {} });
    expect(result).toBeDefined();
    expect(serialize(result!)).toContain('1=0');
  });

  it('returns undefined when the context contains an `any` scope (most permissive wins)', async () => {
    const ctx: DataAccessContext = {
      userId: 'u1',
      scopes: [{ type: 'own' }, { type: 'any' }],
    };
    const result = await service.buildPredicate(ctx, {
      anchors: { creator: widgets.createdBy },
    });
    expect(result).toBeUndefined();
  });

  it('walks the registry for known scope types and returns their predicate', async () => {
    const ctx: DataAccessContext = {
      userId: 'u1',
      scopes: [{ type: 'own' }],
    };
    const result = await service.buildPredicate(ctx, {
      anchors: { creator: widgets.createdBy },
    });
    expect(result).toBeDefined();
    expect(serialize(result!)).toMatch(/created_by/);
  });

  it('ORs predicates from multiple registered scopes', async () => {
    const ctx: DataAccessContext = {
      userId: 'u1',
      scopes: [{ type: 'own' }, { type: 'assigned' }],
    };
    const result = await service.buildPredicate(ctx, {
      anchors: {
        creator: widgets.createdBy,
        assignee: widgets.assigneeId,
      },
    });
    expect(result).toBeDefined();
    const s = serialize(result!);
    expect(s.toLowerCase()).toContain(' or ');
    expect(s).toMatch(/created_by/);
    expect(s).toMatch(/assignee_id/);
  });

  it('drops resolvers that return undefined (anchor missing on this entity)', async () => {
    const ctx: DataAccessContext = {
      userId: 'u1',
      scopes: [{ type: 'own' }, { type: 'assigned' }],
    };
    // Only creator anchor declared — assigned resolver returns undefined
    const result = await service.buildPredicate(ctx, {
      anchors: { creator: widgets.createdBy },
    });
    expect(result).toBeDefined();
    const s = serialize(result!);
    expect(s).toMatch(/created_by/);
    expect(s.toLowerCase()).not.toContain(' or ');
  });

  it('returns 1=0 when every scope drops to undefined (no resolver contributed)', async () => {
    const ctx: DataAccessContext = {
      userId: 'u1',
      scopes: [{ type: 'assigned' }],
    };
    // No anchors declared — assigned resolver bails
    const result = await service.buildPredicate(ctx, { anchors: {} });
    expect(result).toBeDefined();
    expect(serialize(result!)).toContain('1=0');
  });

  it('falls back to caller-supplied inline resolvers when the type is not registered', async () => {
    const ctx: DataAccessContext = {
      userId: 'u1',
      scopes: [{ type: 'team-lead-of' }],
    };
    const result = await service.buildPredicate(ctx, {
      anchors: { team: widgets.teamId },
      inlineResolvers: [
        {
          key: 'team-lead-of',
          resolve(userId) {
            return sql`team_id IN (SELECT team_id FROM team_leads WHERE user_id = ${userId})`;
          },
        },
      ],
    });
    expect(result).toBeDefined();
    const s = serialize(result!);
    expect(s).toMatch(/team_lead/i);
  });

  it('logs a warning and drops unknown scope types', async () => {
    const warn = vi.fn();
    const localLogger = {
      forContext: () => ({
        log: vi.fn(),
        warn,
        error: vi.fn(),
        debug: vi.fn(),
        verbose: vi.fn(),
      }),
    } as never;
    const localService = new DataAccessScopeService(registry, localLogger);
    const ctx: DataAccessContext = {
      userId: 'u1',
      scopes: [{ type: 'unknown-scope' }],
    };
    const result = await localService.buildPredicate(ctx, { anchors: {} });
    expect(result).toBeDefined();
    expect(serialize(result!)).toContain('1=0');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Unknown data access scope type: unknown-scope'),
    );
  });

  it('passes resolver params through from the scope spec', async () => {
    const captured: Array<unknown> = [];
    registry.register({
      type: 'within-radius',
      resolve(ctx, params) {
        captured.push(params);
        const _ = ctx; // silence unused
        return sql`1=1`;
      },
    });
    const ctx: DataAccessContext = {
      userId: 'u1',
      scopes: [{ type: 'within-radius', params: { km: 50 } }],
    };
    await service.buildPredicate(ctx, { anchors: {} });
    expect(captured).toEqual([{ km: 50 }]);
  });
});
