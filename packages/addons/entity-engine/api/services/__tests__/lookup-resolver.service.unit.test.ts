import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LookupResolverService } from '../lookup-resolver.service';

function makeLogger() {
  const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return {
    appLogger: { forContext: () => logger } as any,
    logger,
  };
}

function makeDb(rowsByCall: unknown[][]) {
  let i = 0;
  function makeChain(): any {
    const chain: any = {
      then: (resolve: (v: unknown) => void) => resolve(rowsByCall[i++] ?? []),
    };
    for (const m of ['from', 'leftJoin', 'where', 'limit', 'orderBy']) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    return chain;
  }
  return {
    db: {
      select: vi.fn().mockImplementation(() => makeChain()),
    },
  } as any;
}

describe('LookupResolverService — dispatcher', () => {
  let service: LookupResolverService;

  beforeEach(() => {
    const { appLogger } = makeLogger();
    service = new LookupResolverService(makeDb([]), appLogger);
    service.clearRegistry();
  });

  it('register() builds and stores a default table-based resolver', async () => {
    const db = makeDb([[{ label: 'Alice', value: 'u-1' }]]);
    service = new LookupResolverService(db, makeLogger().appLogger);
    service.register({
      entity: 'users',
      table: { firstName: { _: 'col' }, id: { _: 'col' } } as any,
      labelField: 'firstName',
      valueField: 'id',
      searchFields: ['firstName'],
    });
    expect(service.isRegistered('users')).toBe(true);
    expect(service.getRegisteredEntities()).toContain('users');
    expect(service.getConfig('users')).toBeDefined();
  });

  it('registerResolver() stores a custom resolver and search() dispatches to it', async () => {
    const customSearch = vi.fn().mockResolvedValue([{ label: 'Acme', value: 'cl-1' }]);
    service.registerResolver('clients', {
      search: customSearch,
      getLabel: vi.fn(),
      getBatchLabels: vi.fn(),
    });

    const result = await service.search('clients', 'acm', 10);

    expect(customSearch).toHaveBeenCalledWith('acm', 10);
    expect(result).toEqual([{ label: 'Acme', value: 'cl-1' }]);
  });

  it('getBatchLabels() dispatches to the custom resolver', async () => {
    const labels = new Map([['cl-1', 'Acme']]);
    const getBatchLabels = vi.fn().mockResolvedValue(labels);
    service.registerResolver('clients', {
      search: vi.fn(),
      getLabel: vi.fn(),
      getBatchLabels,
    });

    const result = await service.getBatchLabels('clients', ['cl-1']);

    expect(getBatchLabels).toHaveBeenCalledWith(['cl-1']);
    expect(result).toBe(labels);
  });

  it('getLabel() dispatches to the custom resolver', async () => {
    const getLabel = vi.fn().mockResolvedValue('Acme');
    service.registerResolver('clients', {
      search: vi.fn(),
      getLabel,
      getBatchLabels: vi.fn(),
    });

    expect(await service.getLabel('clients', 'cl-1')).toBe('Acme');
    expect(getLabel).toHaveBeenCalledWith('cl-1');
  });

  it('registerResolver() overrides a prior register() for the same entity', async () => {
    const db = makeDb([]);
    service = new LookupResolverService(db, makeLogger().appLogger);
    service.register({
      entity: 'clients',
      table: { clientName: {}, id: {} } as any,
      labelField: 'clientName',
      valueField: 'id',
      searchFields: ['clientName'],
    });
    const customSearch = vi.fn().mockResolvedValue([]);
    service.registerResolver('clients', {
      search: customSearch,
      getLabel: vi.fn(),
      getBatchLabels: vi.fn(),
    });

    await service.search('clients', 'q', 5);
    expect(customSearch).toHaveBeenCalled();
    // The default table-based resolver should not have hit the db
    expect((db.db.select as any)).not.toHaveBeenCalled();
  });

  it('search() returns [] and getBatchLabels() returns empty Map for unregistered entities', async () => {
    expect(await service.search('nope', 'q', 10)).toEqual([]);
    expect(await service.getBatchLabels('nope', ['x'])).toEqual(new Map());
    expect(await service.getLabel('nope', 'x')).toBeNull();
  });

  it('getBatchLabels() short-circuits to empty Map on empty input even when registered', async () => {
    const getBatchLabels = vi.fn();
    service.registerResolver('clients', {
      search: vi.fn(),
      getLabel: vi.fn(),
      getBatchLabels,
    });
    expect(await service.getBatchLabels('clients', [])).toEqual(new Map());
    expect(getBatchLabels).not.toHaveBeenCalled();
  });
});
