import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ContactsService } from '../contacts.service';

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

describe('ContactsService.create', () => {
  let entityService: any;
  let people: any;
  let mock: ReturnType<typeof createMockDb>;
  let service: ContactsService;

  beforeEach(() => {
    entityService = { create: vi.fn().mockResolvedValue({ id: 'ct-1' }) };
    people = { findOrCreate: vi.fn().mockResolvedValue({ id: 'p-1' }) };
    mock = createMockDb();
    service = new ContactsService(entityService, mock.database, people);
  });

  it('passes companyId straight through to findOrCreate', async () => {
    await service.create(
      {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'JANE@Example.com  ',
        mobile: '+15551234',
        jobTitle: 'PM',
        companyId: 'co-1',
      } as any,
      'user-1',
    );

    expect(people.findOrCreate).toHaveBeenCalledWith(
      {
        fullName: 'Jane Doe',
        primaryEmail: 'jane@example.com',
        primaryPhone: '+15551234',
        linkedinUrl: null,
        jobTitle: 'PM',
        companyId: 'co-1',
      },
      'user-1',
      expect.anything(),
    );
    expect(entityService.create).toHaveBeenCalledWith(
      expect.objectContaining({ personId: 'p-1' }),
      'user-1',
      expect.anything(),
    );
  });

  it('falls back to workPhone when mobile is absent', async () => {
    await service.create(
      {
        firstName: 'Jane',
        lastName: 'Doe',
        workPhone: '+15559999',
        companyId: 'co-1',
      } as any,
      'user-1',
    );

    expect(people.findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({ primaryPhone: '+15559999' }),
      'user-1',
      expect.anything(),
    );
  });

  it('passes null companyId when companyId is omitted', async () => {
    await service.create({ firstName: 'X', lastName: 'Y' } as any, 'user-1');
    expect(people.findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: null }),
      'user-1',
      expect.anything(),
    );
  });
});

describe('ContactsService.update', () => {
  let entityService: any;
  let people: any;
  let mock: ReturnType<typeof createMockDb>;
  let service: ContactsService;

  beforeEach(() => {
    entityService = { update: vi.fn().mockResolvedValue({ id: 'ct-1' }) };
    people = { update: vi.fn().mockResolvedValue({ id: 'p-1' }) };
    mock = createMockDb();
    service = new ContactsService(entityService, mock.database, people);
  });

  it('throws NotFoundException when the recruit_contact does not exist', async () => {
    mock.pushSelectResult([]);
    await expect(
      service.update('missing', { firstName: 'X' } as any, 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(people.update).not.toHaveBeenCalled();
  });

  it('syncs name + email changes to people', async () => {
    mock.pushSelectResult([{ personId: 'p-1', companyId: 'co-1' }]);
    await service.update(
      'ct-1',
      { firstName: 'Janet', email: 'JANET@example.com' } as any,
      'user-1',
    );
    expect(people.update).toHaveBeenCalledWith(
      'p-1',
      expect.objectContaining({ fullName: expect.stringContaining('Janet'), primaryEmail: 'janet@example.com' }),
      'user-1',
      expect.anything(),
    );
  });

  it('skips people write when only recruit-only fields change', async () => {
    mock.pushSelectResult([{ personId: 'p-1', companyId: 'co-1' }]);
    await service.update(
      'ct-1',
      { department: 'Engineering', mailingCity: 'NYC' } as any,
      'user-1',
    );
    expect(people.update).not.toHaveBeenCalled();
    expect(entityService.update).toHaveBeenCalled();
  });

  it('translates 23505 from people.update to ConflictException (email collision)', async () => {
    mock.pushSelectResult([{ personId: 'p-1', companyId: 'co-1' }]);
    people.update.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }));

    await expect(
      service.update('ct-1', { email: 'taken@example.com' } as any, 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(entityService.update).not.toHaveBeenCalled();
  });

  it('updates person.companyId when companyId changes', async () => {
    mock.pushSelectResult([{ personId: 'p-1', companyId: 'co-1' }]); // current contact
    await service.update('ct-1', { companyId: 'co-2' } as any, 'user-1');

    expect(people.update).toHaveBeenCalledWith(
      'p-1',
      { companyId: 'co-2' },
      'user-1',
      expect.anything(),
    );
  });
});
