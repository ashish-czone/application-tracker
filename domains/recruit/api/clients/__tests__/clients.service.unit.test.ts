import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ClientsService } from '../clients.service';

/**
 * Mocks the bits of DatabaseService.db that ClientsService touches:
 *   - `db.transaction(fn)` runs the callback with the same `tx` object so
 *     queries executed via `tx.select()...` resolve through the same chain
 *   - `tx.select({...}).from(...).where(...).limit(N)` resolves to the next
 *     queued result row (also handles .leftJoin and .orderBy/.offset chains)
 */
function createMockDb() {
  const results: unknown[][] = [];

  // Each call to db.select() returns a fresh thenable chain. Any chain method
  // (.from/.leftJoin/.where/.orderBy/.limit/.offset) returns the same chain,
  // and any await on it (regardless of where it's terminated) resolves to the
  // next queued result row. This mirrors Drizzle: queries auto-execute on
  // first await, no matter how many builder calls are chained beforehand.
  function makeChain() {
    const chain: any = {
      then: (resolve: (v: unknown) => void) => resolve(results.shift() ?? []),
    };
    for (const m of ['from', 'leftJoin', 'where', 'orderBy', 'limit', 'offset']) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    return chain;
  }

  const tx = { select: vi.fn().mockImplementation(() => makeChain()) };
  const db = {
    select: vi.fn().mockImplementation(() => makeChain()),
    transaction: vi.fn().mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return {
    database: { db } as any,
    pushSelectResult: (rows: unknown[]) => results.push(rows),
  };
}

function makeScopeResolvers(overrides: Record<string, any> = {}) {
  return {
    get: vi.fn().mockImplementation((type: string) => overrides[type]),
  } as any;
}

describe('ClientsService.create', () => {
  let entityService: any;
  let companies: any;
  let mock: ReturnType<typeof createMockDb>;
  let service: ClientsService;

  beforeEach(() => {
    entityService = { create: vi.fn().mockResolvedValue({ id: 'cl-1' }) };
    companies = { findOrCreate: vi.fn().mockResolvedValue({ id: 'co-1' }) };
    mock = createMockDb();
    service = new ClientsService(entityService, mock.database, companies, makeScopeResolvers());
  });

  it('finds-or-creates the company before delegating to entity-engine', async () => {
    await service.create(
      {
        clientName: 'Acme Corp',
        website: 'https://www.acme.com/about',
        industry: 'technology',
      } as any,
      'user-1',
    );

    expect(companies.findOrCreate).toHaveBeenCalledWith(
      {
        name: 'Acme Corp',
        websiteDomain: 'acme.com',
        industry: 'technology',
      },
      'user-1',
      expect.anything(),
    );
    expect(entityService.create).toHaveBeenCalledWith(
      expect.objectContaining({ clientName: 'Acme Corp', companyId: 'co-1' }),
      'user-1',
      expect.anything(),
    );
  });

  it('passes null website when input has no website', async () => {
    await service.create({ clientName: 'Acme Corp' } as any, 'user-1');

    expect(companies.findOrCreate).toHaveBeenCalledWith(
      { name: 'Acme Corp', websiteDomain: null, industry: null },
      'user-1',
      expect.anything(),
    );
  });

  it('runs in a transaction so directory write rolls back on entity-engine failure', async () => {
    entityService.create.mockRejectedValueOnce(new Error('entity-engine boom'));
    await expect(service.create({ clientName: 'Acme' } as any, 'user-1')).rejects.toThrow(
      'entity-engine boom',
    );
    expect(mock.database.db.transaction).toHaveBeenCalledTimes(1);
  });
});

describe('ClientsService.update', () => {
  let entityService: any;
  let companies: any;
  let mock: ReturnType<typeof createMockDb>;
  let service: ClientsService;

  beforeEach(() => {
    entityService = { update: vi.fn().mockResolvedValue({ id: 'cl-1' }) };
    companies = { update: vi.fn().mockResolvedValue({ id: 'co-1' }) };
    mock = createMockDb();
    service = new ClientsService(entityService, mock.database, companies, makeScopeResolvers());
  });

  it('throws NotFoundException when the recruit_client does not exist', async () => {
    mock.pushSelectResult([]); // current lookup returns nothing
    await expect(
      service.update('missing', { clientName: 'X' } as any, 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(companies.update).not.toHaveBeenCalled();
    expect(entityService.update).not.toHaveBeenCalled();
  });

  it('syncs identity changes to companies and propagates to entity-engine', async () => {
    mock.pushSelectResult([{ companyId: 'co-1' }]);
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
    expect(entityService.update).toHaveBeenCalled();
  });

  it('skips company write when input has no identity fields', async () => {
    mock.pushSelectResult([{ companyId: 'co-1' }]);
    await service.update('cl-1', { about: 'updated copy' } as any, 'user-1');

    expect(companies.update).not.toHaveBeenCalled();
    expect(entityService.update).toHaveBeenCalled();
  });

  it('skips company write when recruit_client has no companyId yet (legacy row)', async () => {
    mock.pushSelectResult([{ companyId: null }]);
    await service.update('cl-1', { clientName: 'X' } as any, 'user-1');

    expect(companies.update).not.toHaveBeenCalled();
    expect(entityService.update).toHaveBeenCalled();
  });

  it('translates a 23505 unique violation from companies.update to ConflictException', async () => {
    mock.pushSelectResult([{ companyId: 'co-1' }]);
    companies.update.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }));

    await expect(
      service.update('cl-1', { clientName: 'Existing Co' } as any, 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(entityService.update).not.toHaveBeenCalled();
  });
});

describe('ClientsService.findOne', () => {
  let mock: ReturnType<typeof createMockDb>;
  let service: ClientsService;

  beforeEach(() => {
    mock = createMockDb();
    service = new ClientsService({} as any, mock.database, {} as any, makeScopeResolvers());
  });

  it('throws NotFoundException when the row is missing', async () => {
    mock.pushSelectResult([]);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the row when found, with the JOIN-projected select map', async () => {
    mock.pushSelectResult([
      { id: 'cl-1', clientName: 'Acme (from directory)', industry: 'technology' },
    ]);
    const row = await service.findOne('cl-1');
    expect(row).toMatchObject({ id: 'cl-1', clientName: 'Acme (from directory)' });
  });

  it('builds a select that JOINs directory.companies and filters by id', async () => {
    mock.pushSelectResult([{ id: 'cl-1' }]);
    await service.findOne('cl-1');
    // The chain is from(clients).leftJoin(companies, ...).where(...).limit(1)
    const sel = (mock.database.db.select as any).mock.results[0].value;
    expect(sel.from).toHaveBeenCalled();
    expect(sel.leftJoin).toHaveBeenCalled();
    expect(sel.where).toHaveBeenCalled();
    expect(sel.limit).toHaveBeenCalledWith(1);
  });
});

describe('ClientsService.list', () => {
  let mock: ReturnType<typeof createMockDb>;
  let service: ClientsService;

  beforeEach(() => {
    mock = createMockDb();
    service = new ClientsService({} as any, mock.database, {} as any, makeScopeResolvers());
  });

  it('returns { data, meta } envelope with pagination', async () => {
    mock.pushSelectResult([{ total: 7 }]); // count query
    mock.pushSelectResult([{ id: 'cl-1', clientName: 'Acme' }]); // rows query
    const res = await service.list({ page: 2, limit: 5 });
    expect(res.meta).toEqual({ total: 7, page: 2, limit: 5, totalPages: 2 });
    expect(res.data).toHaveLength(1);
  });

  it('defaults to page 1 limit 25 when query is empty', async () => {
    mock.pushSelectResult([{ total: 0 }]);
    mock.pushSelectResult([]);
    const res = await service.list({});
    expect(res.meta).toMatchObject({ page: 1, limit: 25, total: 0 });
  });

  it('JOINs directory.companies on every query', async () => {
    mock.pushSelectResult([{ total: 0 }]);
    mock.pushSelectResult([]);
    await service.list({});
    // Two select() calls: one for count, one for rows. Both should LEFT JOIN.
    const calls = (mock.database.db.select as any).mock.results;
    expect(calls.length).toBeGreaterThanOrEqual(2);
    for (const c of calls) {
      expect(c.value.leftJoin).toHaveBeenCalled();
    }
  });

  it('denies all rows when accessCtx has no scopes (1=0)', async () => {
    mock.pushSelectResult([{ total: 0 }]);
    mock.pushSelectResult([]);
    await service.list({}, { userId: 'u-1', scopes: [] });
    expect(mock.database.db.select).toHaveBeenCalled();
  });

  it('skips scope filter when accessCtx contains type=any', async () => {
    mock.pushSelectResult([{ total: 0 }]);
    mock.pushSelectResult([]);
    await service.list({}, { userId: 'u-1', scopes: [{ type: 'any' }] });
    expect(mock.database.db.select).toHaveBeenCalled();
  });

  it('applies a scope predicate via the registered resolver', async () => {
    const ownResolver = {
      type: 'own',
      resolve: vi.fn().mockReturnValue({ /* fake SQL */ } as any),
    };
    service = new ClientsService(
      {} as any,
      mock.database,
      {} as any,
      makeScopeResolvers({ own: ownResolver }),
    );
    mock.pushSelectResult([{ total: 0 }]);
    mock.pushSelectResult([]);
    await service.list({}, { userId: 'u-1', scopes: [{ type: 'own' }] });
    expect(ownResolver.resolve).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u-1', anchors: expect.any(Object) }),
      undefined,
    );
  });
});
