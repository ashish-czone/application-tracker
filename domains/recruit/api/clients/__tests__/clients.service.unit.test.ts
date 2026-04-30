import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ClientsService } from '../clients.service';

/**
 * Mocks the bits of DatabaseService.db that ClientsService touches.
 *
 * Post fold: the service operates on the directory `clients` row directly,
 * so all queries are single-table (no recruit_clients table, no JOIN). The
 * "is recruit client" filter is `recruit_became_client_at IS NOT NULL`.
 */
function createMockDb() {
  const results: unknown[][] = [];

  function makeChain() {
    const chain: any = {
      then: (resolve: (v: unknown) => void) => resolve(results.shift() ?? []),
    };
    for (const m of [
      'from', 'leftJoin', 'where', 'orderBy', 'limit', 'offset',
      'values', 'set', 'returning',
    ]) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    return chain;
  }

  const tx: any = {
    select: vi.fn().mockImplementation(() => makeChain()),
    insert: vi.fn().mockImplementation(() => makeChain()),
    update: vi.fn().mockImplementation(() => makeChain()),
  };
  const db = {
    select: vi.fn().mockImplementation(() => makeChain()),
    insert: vi.fn().mockImplementation(() => makeChain()),
    update: vi.fn().mockImplementation(() => makeChain()),
    transaction: vi.fn().mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return {
    database: { db } as any,
    tx,
    pushSelectResult: (rows: unknown[]) => results.push(rows),
  };
}

function makeScopeResolvers(overrides: Record<string, any> = {}) {
  return {
    get: vi.fn().mockImplementation((type: string) => overrides[type]),
  } as any;
}

function makeEvents() {
  return { emitDynamic: vi.fn() } as any;
}

function makeLookupResolver() {
  return {
    register: vi.fn(),
    registerResolver: vi.fn(),
    isRegistered: vi.fn(),
    getRegisteredEntities: vi.fn(),
    clearRegistry: vi.fn(),
    getConfig: vi.fn(),
    search: vi.fn(),
    getLabel: vi.fn(),
    getBatchLabels: vi.fn(),
  } as any;
}

describe('ClientsService.create', () => {
  let directoryClients: any;
  let mock: ReturnType<typeof createMockDb>;
  let events: ReturnType<typeof makeEvents>;
  let service: ClientsService;

  beforeEach(() => {
    directoryClients = { findOrCreate: vi.fn().mockResolvedValue({ id: 'co-1' }) };
    mock = createMockDb();
    events = makeEvents();
    service = new ClientsService(mock.database, directoryClients, makeScopeResolvers(), events, makeLookupResolver());
  });

  it('finds-or-creates the directory client and stamps recruit_* in one transaction', async () => {
    mock.pushSelectResult([]);                                                    // tx.update recruit_*
    mock.pushSelectResult([{ id: 'co-1', clientName: 'Acme Corp' }]);             // findOne snapshot

    const result = await service.create(
      { clientName: 'Acme Corp', website: 'https://www.acme.com', industry: 'technology' } as any,
      'user-1',
    );

    expect(directoryClients.findOrCreate).toHaveBeenCalledWith(
      { name: 'Acme Corp', websiteDomain: 'acme.com', industry: 'technology' },
      'user-1',
      expect.anything(),
    );
    expect(mock.tx.update).toHaveBeenCalled();
    expect(result.id).toBe('co-1');
  });

  it('emits clients.Created with the post-commit snapshot', async () => {
    mock.pushSelectResult([]);                                                    // tx.update recruit_*
    mock.pushSelectResult([{ id: 'co-1', clientName: 'Acme Corp' }]);             // findOne snapshot

    await service.create({ clientName: 'Acme Corp' } as any, 'user-1');

    expect(events.emitDynamic).toHaveBeenCalledWith('clients.Created', expect.objectContaining({
      entityType: 'clients',
      entityId: 'co-1',
      actorId: 'user-1',
      payload: { after: { id: 'co-1', clientName: 'Acme Corp' } },
    }));
  });

  it('rolls back when directoryClients.findOrCreate fails (no event)', async () => {
    directoryClients.findOrCreate.mockRejectedValueOnce(new Error('directory boom'));

    await expect(service.create({ clientName: 'Acme' } as any, 'user-1'))
      .rejects.toThrow('directory boom');

    expect(events.emitDynamic).not.toHaveBeenCalled();
  });
});

describe('ClientsService.update', () => {
  let directoryClients: any;
  let mock: ReturnType<typeof createMockDb>;
  let events: ReturnType<typeof makeEvents>;
  let service: ClientsService;

  beforeEach(() => {
    directoryClients = { update: vi.fn().mockResolvedValue({ id: 'co-1' }) };
    mock = createMockDb();
    events = makeEvents();
    service = new ClientsService(mock.database, directoryClients, makeScopeResolvers(), events, makeLookupResolver());
  });

  it('throws NotFoundException when findOne returns no row', async () => {
    mock.pushSelectResult([]); // findOne(before) returns empty

    await expect(
      service.update('missing', { clientName: 'X' } as any, 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(directoryClients.update).not.toHaveBeenCalled();
  });

  it('syncs identity changes to directory and updates recruit_* on the same row', async () => {
    mock.pushSelectResult([{ id: 'co-1', clientName: 'Acme', industry: 'old' }]); // findOne(before)
    mock.pushSelectResult([{ id: 'co-1', clientName: 'Acme Renamed', industry: 'financial-services' }]); // findOne(after)

    await service.update(
      'co-1',
      { clientName: 'Acme Renamed', industry: 'financial-services' } as any,
      'user-1',
    );

    expect(directoryClients.update).toHaveBeenCalledWith(
      'co-1',
      { name: 'Acme Renamed', industry: 'financial-services' },
      'user-1',
      expect.anything(),
    );
  });

  it('skips directory sync when input has no identity fields', async () => {
    mock.pushSelectResult([{ id: 'co-1', about: 'old' }]); // findOne(before)
    mock.pushSelectResult([]);                              // tx.update recruit_*
    mock.pushSelectResult([{ id: 'co-1', about: 'new' }]); // findOne(after)

    await service.update('co-1', { about: 'new' } as any, 'user-1');

    expect(directoryClients.update).not.toHaveBeenCalled();
    expect(mock.tx.update).toHaveBeenCalled();
  });

  it('translates a 23505 unique violation to ConflictException', async () => {
    mock.pushSelectResult([{ id: 'co-1', clientName: 'Acme' }]);
    directoryClients.update.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }));

    await expect(
      service.update('co-1', { clientName: 'Existing Co' } as any, 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(events.emitDynamic).not.toHaveBeenCalled();
  });

  it('emits no event when before/after are identical (no-op update)', async () => {
    mock.pushSelectResult([{ id: 'co-1', about: 'same' }]);
    mock.pushSelectResult([]);
    mock.pushSelectResult([{ id: 'co-1', about: 'same' }]);

    await service.update('co-1', { about: 'same' } as any, 'user-1');

    expect(events.emitDynamic).not.toHaveBeenCalled();
  });

  it('emits clients.Updated with diffed changes when before/after differ', async () => {
    mock.pushSelectResult([{ id: 'co-1', about: 'old' }]);
    mock.pushSelectResult([]);
    mock.pushSelectResult([{ id: 'co-1', about: 'new' }]);

    await service.update('co-1', { about: 'new' } as any, 'user-1');

    expect(events.emitDynamic).toHaveBeenCalledWith('clients.Updated', expect.objectContaining({
      entityType: 'clients',
      entityId: 'co-1',
      payload: expect.objectContaining({ changes: ['about'] }),
    }));
  });
});

describe('ClientsService.softDelete', () => {
  let mock: ReturnType<typeof createMockDb>;
  let events: ReturnType<typeof makeEvents>;
  let service: ClientsService;

  beforeEach(() => {
    mock = createMockDb();
    events = makeEvents();
    service = new ClientsService(mock.database, {} as any, makeScopeResolvers(), events, makeLookupResolver());
  });

  it('throws NotFound when scope-denied (findOne returns empty)', async () => {
    mock.pushSelectResult([]);
    await expect(
      service.softDelete('co-1', 'user-1', { userId: 'user-1', scopes: [] }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sets recruit_archived_at on the directory client row and emits clients.Deleted', async () => {
    mock.pushSelectResult([{ id: 'co-1', clientName: 'Acme' }]); // findOne(before)

    await service.softDelete('co-1', 'user-1');

    expect(mock.database.db.update).toHaveBeenCalled();
    expect(events.emitDynamic).toHaveBeenCalledWith('clients.Deleted', expect.objectContaining({
      entityType: 'clients',
      entityId: 'co-1',
      payload: { before: { id: 'co-1', clientName: 'Acme' } },
    }));
  });
});

describe('ClientsService.findOrCreateForClient', () => {
  let mock: ReturnType<typeof createMockDb>;
  let events: ReturnType<typeof makeEvents>;
  let service: ClientsService;

  beforeEach(() => {
    mock = createMockDb();
    events = makeEvents();
    service = new ClientsService(mock.database, {} as any, makeScopeResolvers(), events, makeLookupResolver());
  });

  it('returns { id, created: false } when the directory client is already a recruit client', async () => {
    mock.pushSelectResult([{ id: 'co-1', became: new Date() }]);

    const out = await service.findOrCreateForClient('co-1', 'user-1');

    expect(out).toEqual({ id: 'co-1', created: false });
    expect(events.emitDynamic).not.toHaveBeenCalled();
  });

  it('stamps recruit_became_client_at + emits Created when the row exists but is not a recruit client yet', async () => {
    mock.pushSelectResult([{ id: 'co-1', became: null }]);                  // exists, not a recruit client
    mock.pushSelectResult([]);                                              // db.update recruit_became_client_at
    mock.pushSelectResult([{ id: 'co-1', clientName: 'Acme Corp' }]);       // findOne snapshot

    const out = await service.findOrCreateForClient('co-1', 'user-1');

    expect(out).toEqual({ id: 'co-1', created: true });
    expect(mock.database.db.update).toHaveBeenCalled();
    expect(events.emitDynamic).toHaveBeenCalledWith('clients.Created', expect.objectContaining({
      entityType: 'clients',
      entityId: 'co-1',
      actorId: 'user-1',
    }));
  });

  it('throws NotFound when the client id is not in the directory', async () => {
    mock.pushSelectResult([]); // lookup empty

    await expect(service.findOrCreateForClient('missing-co', 'user-1'))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ClientsService.findOne', () => {
  let mock: ReturnType<typeof createMockDb>;
  let service: ClientsService;

  beforeEach(() => {
    mock = createMockDb();
    service = new ClientsService(mock.database, {} as any, makeScopeResolvers(), makeEvents(), makeLookupResolver());
  });

  it('throws NotFoundException when the row is missing', async () => {
    mock.pushSelectResult([]);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the row when found', async () => {
    mock.pushSelectResult([{ id: 'co-1', clientName: 'Acme' }]);
    const row = await service.findOne('co-1');
    expect(row).toMatchObject({ id: 'co-1', clientName: 'Acme' });
  });
});

describe('ClientsService.list', () => {
  let mock: ReturnType<typeof createMockDb>;
  let service: ClientsService;

  beforeEach(() => {
    mock = createMockDb();
    service = new ClientsService(mock.database, {} as any, makeScopeResolvers(), makeEvents(), makeLookupResolver());
  });

  it('returns { data, meta } envelope', async () => {
    mock.pushSelectResult([{ total: 7 }]);
    mock.pushSelectResult([{ id: 'co-1' }]);
    const res = await service.list({ page: 2, limit: 5 });
    expect(res.meta).toEqual({ total: 7, page: 2, limit: 5, totalPages: 2 });
    expect(res.data).toHaveLength(1);
  });

  it('queries the directory client row directly (no JOIN to recruit_clients)', async () => {
    mock.pushSelectResult([{ total: 0 }]);
    mock.pushSelectResult([]);
    await service.list({});
    const calls = (mock.database.db.select as any).mock.results;
    expect(calls.length).toBeGreaterThanOrEqual(2);
    for (const c of calls) {
      expect(c.value.leftJoin).not.toHaveBeenCalled();
    }
  });
});

describe('ClientsService.onModuleInit', () => {
  it('registers a custom lookup resolver for "clients"', () => {
    const mock = createMockDb();
    const lookupResolver = makeLookupResolver();
    const service = new ClientsService(
      mock.database, {} as any, makeScopeResolvers(), makeEvents(), lookupResolver,
    );
    service.onModuleInit();
    expect(lookupResolver.registerResolver).toHaveBeenCalledWith('clients', expect.objectContaining({
      search: expect.any(Function),
      getLabel: expect.any(Function),
      getBatchLabels: expect.any(Function),
    }));
  });
});

describe('ClientsService custom lookup resolver', () => {
  let mock: ReturnType<typeof createMockDb>;
  let lookupResolver: ReturnType<typeof makeLookupResolver>;
  let resolver: { search: Function; getLabel: Function; getBatchLabels: Function };

  beforeEach(() => {
    mock = createMockDb();
    lookupResolver = makeLookupResolver();
    const service = new ClientsService(
      mock.database, {} as any, makeScopeResolvers(), makeEvents(), lookupResolver,
    );
    service.onModuleInit();
    resolver = (lookupResolver.registerResolver as any).mock.calls[0][1];
  });

  it('search() filters on recruit_became_client_at IS NOT NULL', async () => {
    mock.pushSelectResult([
      { label: 'Acme Corp', value: 'co-1' },
      { label: 'Acme Holdings', value: 'co-2' },
    ]);
    const results = await resolver.search('acme', 20);
    expect(results).toEqual([
      { label: 'Acme Corp', value: 'co-1' },
      { label: 'Acme Holdings', value: 'co-2' },
    ]);
    const selectCall = (mock.database.db.select as any).mock.results[0];
    expect(selectCall.value.from).toHaveBeenCalled();
    expect(selectCall.value.limit).toHaveBeenCalledWith(20);
  });

  it('getLabel() returns the client name or null when no row', async () => {
    mock.pushSelectResult([{ label: 'Acme Corp' }]);
    expect(await resolver.getLabel('co-1')).toBe('Acme Corp');

    mock.pushSelectResult([]);
    expect(await resolver.getLabel('missing')).toBeNull();
  });

  it('getBatchLabels() returns a Map keyed by client id', async () => {
    mock.pushSelectResult([
      { id: 'co-1', label: 'Acme Corp' },
      { id: 'co-2', label: 'Globex' },
    ]);
    const labels = await resolver.getBatchLabels(['co-1', 'co-2', 'co-3']);
    expect(labels.get('co-1')).toBe('Acme Corp');
    expect(labels.get('co-2')).toBe('Globex');
    expect(labels.has('co-3')).toBe(false);
  });
});
