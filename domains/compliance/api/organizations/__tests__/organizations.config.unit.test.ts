import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { createOrganizationsEntityConfig } from '../organizations.config';

function makeDb(rowCount: number) {
  const fromFn = vi.fn().mockResolvedValue([{ count: rowCount }]);
  const selectFn = vi.fn().mockReturnValue({ from: fromFn });
  return { select: selectFn } as any;
}

describe('createOrganizationsEntityConfig', () => {
  it('registers the logo field as a file field type', () => {
    const config = createOrganizationsEntityConfig({ getDb: () => makeDb(0) });
    expect(config.fieldMeta.logoUrl.fieldType).toBe('file');
  });

  it('exposes the name field as the entity label', () => {
    const config = createOrganizationsEntityConfig({ getDb: () => makeDb(0) });
    expect(config.lookup?.labelField).toBe('name');
  });

  it('uses onDelete: restrict so engine-level deletes are rejected', () => {
    const config = createOrganizationsEntityConfig({ getDb: () => makeDb(0) });
    expect(config.onDelete.mode).toBe('restrict');
  });

  describe('beforeCreate hook', () => {
    it('allows the first insert through', async () => {
      const db = makeDb(0);
      const config = createOrganizationsEntityConfig({ getDb: () => db });
      const payload = { name: 'Acme' };
      const result = await config.hooks!.beforeCreate!(payload, 'actor-1');
      expect(result).toEqual(payload);
    });

    it('throws BadRequestException when a row already exists', async () => {
      const db = makeDb(1);
      const config = createOrganizationsEntityConfig({ getDb: () => db });
      await expect(
        config.hooks!.beforeCreate!({ name: 'Acme 2' }, 'actor-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('beforeDelete hook', () => {
    it('always throws BadRequestException', async () => {
      const config = createOrganizationsEntityConfig({ getDb: () => makeDb(1) });
      await expect(
        config.hooks!.beforeDelete!('any-id', 'actor-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
