import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { OrganizationsService } from '../organizations.service';

function makeDb(rowCount: number) {
  const fromFn = vi.fn().mockResolvedValue([{ count: rowCount }]);
  const selectFn = vi.fn().mockReturnValue({ from: fromFn });
  return { db: { select: selectFn } } as never;
}

describe('OrganizationsService', () => {
  let entityService: {
    list: ReturnType<typeof vi.fn>;
    findOneOrFail: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    getListLayout: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    entityService = {
      list: vi.fn(),
      findOneOrFail: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'o1', name: 'Acme' }),
      update: vi.fn(),
      getListLayout: vi.fn(),
    };
  });

  describe('create', () => {
    it('inserts the first organization when no row exists', async () => {
      const db = makeDb(0);
      const service = new OrganizationsService(entityService as never, db);
      const result = await service.create({ name: 'Acme' } as never, 'actor-1');
      expect(entityService.create).toHaveBeenCalledWith({ name: 'Acme' }, 'actor-1');
      expect(result).toEqual({ id: 'o1', name: 'Acme' });
    });

    it('throws BadRequestException when a row already exists (singleton)', async () => {
      const db = makeDb(1);
      const service = new OrganizationsService(entityService as never, db);
      await expect(service.create({ name: 'Second' } as never, 'actor-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(entityService.create).not.toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('always throws BadRequestException — the organization cannot be deleted', () => {
      const service = new OrganizationsService(entityService as never, makeDb(1));
      expect(() => service.softDelete('o1', 'actor-1')).toThrow(BadRequestException);
    });
  });
});
