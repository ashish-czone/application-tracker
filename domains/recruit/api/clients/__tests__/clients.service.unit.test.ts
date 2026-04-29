import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ClientsService } from '../clients.service';

/**
 * Mocks the bits of DatabaseService.db that ClientsService touches.
 *
 * - `db.transaction(fn)` runs the callback with the same `tx` chain so
 *   nested writes execute and resolve as if a real tx were running.
 * - Each `db.select()` / `tx.select()` / `db.insert()` / `db.update()`
 *   call returns a fresh thenable chain. `.from/.leftJoin/.where/.orderBy/
 *   .limit/.offset/.returning/.values/.set` all chain back, and any await
 *   resolves to the next queued result row.
 *
 * Tests push results in the order the service consumes them.
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
  let companies: any;
  let mock: ReturnType<typeof createMockDb>;
  let events: ReturnType<typeof makeEvents>;
  let service: ClientsService;

  beforeEach(() => {
    companies = { findOrCreate: vi.fn().mockResolvedValue({ id: 'co-1' }) };
    mock = createMockDb();
    events = makeEvents();
    service = new ClientsService(mock.database, companies, makeScopeResolvers(), events, makeLookupResolver());
  });

  it('finds-or-creates the company and inserts the client in one transaction', async () => {
    mock.pushSelectResult([]);                                       // tx.update(companies) recruit_* canonical write
    mock.pushSelectResult([{ id: 'cl-1' }]);                         // tx.insert(recruit_clients).returning() shadow
    mock.pushSelectResult([{ id: 'cl-1', clientName: 'Acme Corp' }]); // findOne(snapshot) after commit

    await service.create(
      { clientName: 'Acme Corp', website: 'https://www.acme.com', industry: 'technology' } as any,
      'user-1',
    );

    expect(companies.findOrCreate).toHaveBeenCalledWith(
      { name: 'Acme Corp', websiteDomain: 'acme.com', industry: 'technology' },
      'user-1',
      expect.anything(),
    );
    expect(mock.tx.update).toHaveBeenCalled();
    expect(mock.tx.insert).toHaveBeenCalled();
    expect(mock.database.db.transaction).toHaveBeenCalledTimes(1);
  });

  it('emits clients.Created with the post-commit snapshot', async () => {
    mock.pushSelectResult([]);                                       // tx.update(companies) recruit_*
    mock.pushSelectResult([{ id: 'cl-1' }]);                         // tx.insert(recruit_clients).returning()
    mock.pushSelectResult([{ id: 'cl-1', clientName: 'Acme Corp' }]); // findOne snapshot

    await service.create({ clientName: 'Acme Corp' } as any, 'user-1');

    expect(events.emitDynamic).toHaveBeenCalledWith('clients.Created', expect.objectContaining({
      entityType: 'clients',
      entityId: 'cl-1',
      actorId: 'user-1',
      payload: { after: { id: 'cl-1', clientName: 'Acme Corp' } },
    }));
  });

  it('rolls back when companies.findOrCreate fails (no insert, no event)', async () => {
    companies.findOrCreate.mockRejectedValueOnce(new Error('directory boom'));

    await expect(service.create({ clientName: 'Acme' } as any, 'user-1'))
      .rejects.toThrow('directory boom');

    expect(mock.tx.insert).not.toHaveBeenCalled();
    expect(events.emitDynamic).not.toHaveBeenCalled();
  });
});

describe('ClientsService.update', () => {
  let companies: any;
  let mock: ReturnType<typeof createMockDb>;
  let events: ReturnType<typeof makeEvents>;
  let service: ClientsService;

  beforeEach(() => {
    companies = { update: vi.fn().mockResolvedValue({ id: 'co-1' }) };
    mock = createMockDb();
    events = makeEvents();
    service = new ClientsService(mock.database, companies, makeScopeResolvers(), events, makeLookupResolver());
  });

  it('throws NotFoundException when findOne returns no row', async () => {
    mock.pushSelectResult([]); // findOne(before) returns empty

    await expect(
      service.update('missing', { clientName: 'X' } as any, 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(companies.update).not.toHaveBeenCalled();
    expect(mock.tx.update).not.toHaveBeenCalled();
  });

  it('syncs identity changes to companies and updates recruit_clients in same tx', async () => {
    mock.pushSelectResult([{ id: 'cl-1', companyId: 'co-1', clientName: 'Acme', industry: 'old' }]); // before
    mock.pushSelectResult([{ id: 'cl-1' }]);                                                          // tx.update.returning
    mock.pushSelectResult([{ id: 'cl-1', companyId: 'co-1', clientName: 'Acme Renamed', industry: 'financial-services' }]); // after

    await service.update(
      'cl-1',
      { clientName: 'Acme Renamed', industry: 'financial-services' } as any,
      'user-1',
    );

    expect(companies.update).toHaveBeenCalledWith(
      'co-1',
      { name: 'Acme Renamed', industry: 'financial-services' },
      'user-1',
      expect.anything(),
    );
    expect(mock.tx.update).toHaveBeenCalled();
  });

  it('skips company sync when input has no identity fields', async () => {
    mock.pushSelectResult([{ id: 'cl-1', companyId: 'co-1', about: 'old' }]); // findOne(before)
    mock.pushSelectResult([]);                                                // tx.update(companies) recruit_*
    mock.pushSelectResult([{ id: 'cl-1' }]);                                  // tx.update(recruit_clients).returning
    mock.pushSelectResult([{ id: 'cl-1', companyId: 'co-1', about: 'new' }]); // findOne(after)

    await service.update('cl-1', { about: 'new' } as any, 'user-1');

    expect(companies.update).not.toHaveBeenCalled();
    expect(mock.tx.update).toHaveBeenCalled();
  });

  it('skips company sync when client has no companyId yet (legacy row)', async () => {
    mock.pushSelectResult([{ id: 'cl-1', companyId: null, clientName: 'Old' }]);
    mock.pushSelectResult([{ id: 'cl-1' }]);
    mock.pushSelectResult([{ id: 'cl-1', companyId: null, clientName: 'New' }]);

    await service.update('cl-1', { clientName: 'New' } as any, 'user-1');

    expect(companies.update).not.toHaveBeenCalled();
    expect(mock.tx.update).toHaveBeenCalled();
  });

  it('translates a 23505 unique violation to ConflictException', async () => {
    mock.pushSelectResult([{ id: 'cl-1', companyId: 'co-1', clientName: 'Acme' }]);
    companies.update.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }));

    await expect(
      service.update('cl-1', { clientName: 'Existing Co' } as any, 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(mock.tx.update).not.toHaveBeenCalled();
    expect(events.emitDynamic).not.toHaveBeenCalled();
  });

  it('emits no event when before/after are identical (no-op update)', async () => {
    mock.pushSelectResult([{ id: 'cl-1', companyId: 'co-1', about: 'same' }]); // findOne(before)
    mock.pushSelectResult([]);                                                 // tx.update(companies) recruit_*
    mock.pushSelectResult([{ id: 'cl-1' }]);                                   // tx.update(recruit_clients).returning
    mock.pushSelectResult([{ id: 'cl-1', companyId: 'co-1', about: 'same' }]); // findOne(after)

    await service.update('cl-1', { about: 'same' } as any, 'user-1');

    expect(events.emitDynamic).not.toHaveBeenCalled();
  });

  it('emits clients.Updated with diffed changes when before/after differ', async () => {
    mock.pushSelectResult([{ id: 'cl-1', companyId: 'co-1', about: 'old' }]); // findOne(before)
    mock.pushSelectResult([]);                                                // tx.update(companies) recruit_*
    mock.pushSelectResult([{ id: 'cl-1' }]);                                  // tx.update(recruit_clients).returning
    mock.pushSelectResult([{ id: 'cl-1', companyId: 'co-1', about: 'new' }]); // findOne(after)

    await service.update('cl-1', { about: 'new' } as any, 'user-1');

    expect(events.emitDynamic).toHaveBeenCalledWith('clients.Updated', expect.objectContaining({
      entityType: 'clients',
      entityId: 'cl-1',
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
      service.softDelete('cl-1', 'user-1', { userId: 'user-1', scopes: [] }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates recruit_archived_at + deletedAt and emits clients.Deleted with before snapshot', async () => {
    mock.pushSelectResult([{ id: 'cl-1', companyId: 'co-1', clientName: 'Acme' }]); // findOne(before)

    await service.softDelete('cl-1', 'user-1');

    // softDelete uses tx for both companies (recruit_archived_at) and recruit_clients (deletedAt).
    expect(mock.database.db.transaction).toHaveBeenCalledTimes(1);
    expect(mock.tx.update).toHaveBeenCalled();
    expect(events.emitDynamic).toHaveBeenCalledWith('clients.Deleted', expect.objectContaining({
      entityType: 'clients',
      entityId: 'cl-1',
      payload: { before: { id: 'cl-1', companyId: 'co-1', clientName: 'Acme' } },
    }));
  });
});

describe('ClientsService.findOrCreateForCompany', () => {
  let companies: any;
  let mock: ReturnType<typeof createMockDb>;
  let events: ReturnType<typeof makeEvents>;
  let service: ClientsService;

  beforeEach(() => {
    companies = {};
    mock = createMockDb();
    events = makeEvents();
    service = new ClientsService(mock.database, companies, makeScopeResolvers(), events, makeLookupResolver());
  });

  it('returns the existing recruit_client.id when one already exists for the company', async () => {
    mock.pushSelectResult([{ id: 'existing-client' }]);

    const out = await service.findOrCreateForCompany('co-1', 'user-1');

    expect(out).toEqual({ id: 'existing-client', created: false });
    expect(mock.database.db.insert).not.toHaveBeenCalled();
    expect(events.emitDynamic).not.toHaveBeenCalled();
  });

  it('creates a minimal recruit_client when none exists, emits Created event', async () => {
    mock.pushSelectResult([]);                                // existing lookup
    mock.pushSelectResult([{ name: 'Acme Corp' }]);           // company lookup

    const out = await service.findOrCreateForCompany('co-1', 'user-1');

    expect(out.created).toBe(true);
    expect(out.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(mock.database.db.insert).toHaveBeenCalled();
    expect(events.emitDynamic).toHaveBeenCalledWith('clients.Created', expect.objectContaining({
      entityType: 'clients',
      actorId: 'user-1',
    }));
  });

  it('throws NotFound when the company id is not in the directory', async () => {
    mock.pushSelectResult([]); // existing lookup
    mock.pushSelectResult([]); // company lookup

    await expect(service.findOrCreateForCompany('missing-co', 'user-1'))
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
    mock.pushSelectResult([{ id: 'cl-1', clientName: 'Acme (from directory)' }]);
    const row = await service.findOne('cl-1');
    expect(row).toMatchObject({ id: 'cl-1', clientName: 'Acme (from directory)' });
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
    mock.pushSelectResult([{ id: 'cl-1' }]);
    const res = await service.list({ page: 2, limit: 5 });
    expect(res.meta).toEqual({ total: 7, page: 2, limit: 5, totalPages: 2 });
    expect(res.data).toHaveLength(1);
  });

  it('JOINs directory.companies on every query', async () => {
    mock.pushSelectResult([{ total: 0 }]);
    mock.pushSelectResult([]);
    await service.list({});
    const calls = (mock.database.db.select as any).mock.results;
    expect(calls.length).toBeGreaterThanOrEqual(2);
    for (const c of calls) {
      expect(c.value.leftJoin).toHaveBeenCalled();
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

  it('search() JOINs companies, ilikes the coalesced label, returns {label,value}', async () => {
    mock.pushSelectResult([
      { label: 'Acme Corp', value: 'cl-1' },
      { label: 'Acme Holdings', value: 'cl-2' },
    ]);
    const results = await resolver.search('acme', 20);
    expect(results).toEqual([
      { label: 'Acme Corp', value: 'cl-1' },
      { label: 'Acme Holdings', value: 'cl-2' },
    ]);
    const selectCall = (mock.database.db.select as any).mock.results[0];
    expect(selectCall.value.leftJoin).toHaveBeenCalled();
    expect(selectCall.value.limit).toHaveBeenCalledWith(20);
  });

  it('getLabel() returns the coalesced label or null when no row', async () => {
    mock.pushSelectResult([{ label: 'Acme Corp' }]);
    expect(await resolver.getLabel('cl-1')).toBe('Acme Corp');

    mock.pushSelectResult([]);
    expect(await resolver.getLabel('missing')).toBeNull();
  });

  it('getBatchLabels() returns a Map keyed by client id', async () => {
    mock.pushSelectResult([
      { id: 'cl-1', label: 'Acme Corp' },
      { id: 'cl-2', label: 'Globex' },
    ]);
    const labels = await resolver.getBatchLabels(['cl-1', 'cl-2', 'cl-3']);
    expect(labels.get('cl-1')).toBe('Acme Corp');
    expect(labels.get('cl-2')).toBe('Globex');
    expect(labels.has('cl-3')).toBe(false);
  });
});
