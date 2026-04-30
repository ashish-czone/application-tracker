import { describe, it, expect, vi } from 'vitest';
import type { DataAccessContext } from '@packages/rbac';
import { EntityService } from '../../entity.service';

/**
 * EntityService.getScopePredicate is a thin delegation to
 * DataAccessScopeService.buildPredicate. This test verifies that the
 * delegation passes the entity's anchors + inline scopes through correctly.
 * Behavioural coverage of the dispatcher itself lives in
 * @packages/rbac/api/__tests__/data-access-scope.service.unit.test.ts.
 */

type StubColumn = { __col: true; name: string };
function stubColumn(name: string): StubColumn {
  return { __col: true, name };
}

function buildSvc(opts: {
  tableColumns?: Record<string, unknown>;
  anchors?: Record<string, string>;
  inlineScopes?: Array<{ key: string; resolve: (userId: string) => unknown }>;
  buildPredicate: ReturnType<typeof vi.fn>;
}): EntityService {
  const config: any = {
    entityType: 'test',
    table: opts.tableColumns ?? {},
    dataAccess: { anchors: opts.anchors, scopes: opts.inlineScopes },
  };
  const svc = Object.create(EntityService.prototype) as EntityService;
  (svc as any).config = config;
  (svc as any).dataAccessScope = { buildPredicate: opts.buildPredicate };
  return svc;
}

describe('EntityService.getScopePredicate', () => {
  it('delegates to DataAccessScopeService with the entity anchors and inline scopes', async () => {
    const buildPredicate = vi.fn().mockResolvedValue({ __tag: 'sql' });
    const created = stubColumn('created_by');
    const svc = buildSvc({
      tableColumns: { createdBy: created, extra: stubColumn('extra') },
      anchors: { creator: 'createdBy' },
      inlineScopes: [{ key: 'inline-x', resolve: () => undefined }],
      buildPredicate,
    });
    const ctx: DataAccessContext = { userId: 'u1', scopes: [{ type: 'own' }] };

    const result = await svc.getScopePredicate(ctx);

    expect(buildPredicate).toHaveBeenCalledTimes(1);
    expect(buildPredicate).toHaveBeenCalledWith(ctx, {
      anchors: { creator: created },
      inlineResolvers: [{ key: 'inline-x', resolve: expect.any(Function) }],
    });
    expect(result).toEqual({ __tag: 'sql' });
  });

  it('drops anchor entries whose referenced column is missing on the table', async () => {
    const buildPredicate = vi.fn().mockResolvedValue(undefined);
    const created = stubColumn('created_by');
    const svc = buildSvc({
      tableColumns: { createdBy: created },
      anchors: { creator: 'createdBy', team: 'missing_column' },
      buildPredicate,
    });

    await svc.getScopePredicate({ userId: 'u1', scopes: [{ type: 'own' }] });

    expect(buildPredicate.mock.calls[0][1].anchors).toEqual({ creator: created });
  });

  it('returns whatever DataAccessScopeService returns (undefined or SQL)', async () => {
    const buildPredicate = vi.fn().mockResolvedValue(undefined);
    const svc = buildSvc({ buildPredicate });
    const result = await svc.getScopePredicate({ userId: 'u1', scopes: [{ type: 'any' }] });
    expect(result).toBeUndefined();
  });
});
