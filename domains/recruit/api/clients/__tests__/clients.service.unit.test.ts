import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ClientsService } from '../clients.service';

/**
 * Mocks the bits of DatabaseService.db that ClientsService touches:
 *   - `db.transaction(fn)` runs the callback with the same `tx` object so
 *     queries executed via `tx.select()...` resolve through the same chain
 *   - `tx.select({...}).from(...).where(...).limit(N)` resolves to the next
 *     queued result row
 */
function createMockDb() {
  const results: unknown[][] = [];
  const chain: any = {
    from: vi.fn().mockImplementation(() => chain),
    where: vi.fn().mockImplementation(() => chain),
    limit: vi.fn().mockImplementation(() => Promise.resolve(results.shift() ?? [])),
  };
  const tx = { select: vi.fn().mockReturnValue(chain) };
  const db = {
    transaction: vi.fn().mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return {
    database: { db } as any,
    pushSelectResult: (rows: unknown[]) => results.push(rows),
  };
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
    service = new ClientsService(entityService, mock.database, companies);
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
    service = new ClientsService(entityService, mock.database, companies);
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
