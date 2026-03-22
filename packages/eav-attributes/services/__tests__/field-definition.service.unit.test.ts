import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { FieldDefinitionService } from '../field-definition.service';

function createMockDb() {
  const mockChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    orderBy: vi.fn().mockReturnThis(),
  };

  return {
    select: vi.fn().mockReturnValue(mockChain),
    insert: vi.fn().mockReturnValue(mockChain),
    update: vi.fn().mockReturnValue(mockChain),
    delete: vi.fn().mockReturnValue(mockChain),
    _chain: mockChain,
  };
}

function makeFieldDef(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fd1',
    entityType: 'candidates',
    fieldKey: 'custom_field',
    label: 'Custom Field',
    fieldType: 'text',
    uiType: null,
    isRequired: false,
    isSystem: false,
    isCustom: true,
    isUnique: false,
    isQuickCreate: false,
    isReadonly: false,
    maxLength: null,
    defaultValue: null,
    columnName: null,
    lookupEntity: null,
    lookupLabelField: null,
    lookupSearchFields: null,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('FieldDefinitionService', () => {
  let service: FieldDefinitionService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    const databaseService = { db: mockDb } as any;
    service = new FieldDefinitionService(databaseService);
  });

  // --- create ---

  describe('create', () => {
    it('should create a field definition and return it', async () => {
      const field = makeFieldDef();
      // findByEntityAndKey returns nothing (no duplicate)
      mockDb._chain.limit.mockResolvedValueOnce([]);
      // insert returns the new field
      mockDb._chain.returning.mockResolvedValueOnce([field]);

      const result = await service.create('candidates', {
        fieldKey: 'custom_field',
        label: 'Custom Field',
        fieldType: 'text',
      });

      expect(result).toEqual(field);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should set isCustom=true on created fields', async () => {
      const field = makeFieldDef({ isCustom: true });
      mockDb._chain.limit.mockResolvedValueOnce([]);
      mockDb._chain.returning.mockResolvedValueOnce([field]);

      const result = await service.create('candidates', {
        fieldKey: 'custom_field',
        label: 'Custom Field',
        fieldType: 'text',
      });

      expect(result.isCustom).toBe(true);
    });

    it('should throw ConflictException for standard field collision with descriptive message', async () => {
      const existing = makeFieldDef({ isCustom: false, fieldKey: 'first_name' });
      // findByEntityAndKey returns existing standard field
      mockDb._chain.limit.mockResolvedValueOnce([existing]);

      await expect(
        service.create('candidates', {
          fieldKey: 'first_name',
          label: 'First Name',
          fieldType: 'text',
        }),
      ).rejects.toThrow(/conflicts with a standard field/);
    });

    it('should throw ConflictException for custom field collision with descriptive message', async () => {
      const existing = makeFieldDef({ isCustom: true, fieldKey: 'custom_field' });
      // findByEntityAndKey returns existing custom field
      mockDb._chain.limit.mockResolvedValueOnce([existing]);

      await expect(
        service.create('candidates', {
          fieldKey: 'custom_field',
          label: 'Custom Field',
          fieldType: 'text',
        }),
      ).rejects.toThrow(/already exists for/);
    });

    it('should throw ConflictException on duplicate field_key', async () => {
      const existing = makeFieldDef();
      // findByEntityAndKey returns existing field
      mockDb._chain.limit.mockResolvedValueOnce([existing]);

      await expect(
        service.create('candidates', {
          fieldKey: 'custom_field',
          label: 'Custom Field',
          fieldType: 'text',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // --- update ---

  describe('update', () => {
    it('should update and return the field definition', async () => {
      const existing = makeFieldDef();
      const updated = makeFieldDef({ label: 'Updated Label' });
      // findById returns existing
      mockDb._chain.limit.mockResolvedValueOnce([existing]);
      // update returns updated
      mockDb._chain.returning.mockResolvedValueOnce([updated]);

      const result = await service.update('fd1', { label: 'Updated Label' });

      expect(result.label).toBe('Updated Label');
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if field not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.update('nonexistent', { label: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return existing field on empty update (no-op)', async () => {
      const existing = makeFieldDef();
      mockDb._chain.limit.mockResolvedValueOnce([existing]);

      const result = await service.update('fd1', {});

      expect(result).toEqual(existing);
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  // --- delete ---

  describe('delete', () => {
    it('should delete a custom field with no values', async () => {
      const field = makeFieldDef({ isCustom: true });
      // findById returns field via spy
      vi.spyOn(service, 'findById').mockResolvedValueOnce(field as any);
      // count query: select({total}).from().where() — terminates at where
      mockDb._chain.where.mockResolvedValueOnce([{ total: 0 }]);

      await expect(service.delete('fd1')).resolves.toBeUndefined();
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException if field not found', async () => {
      vi.spyOn(service, 'findById').mockResolvedValueOnce(null);

      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when deleting non-custom field', async () => {
      const field = makeFieldDef({ isCustom: false });
      vi.spyOn(service, 'findById').mockResolvedValueOnce(field as any);

      await expect(service.delete('fd1')).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when field has values', async () => {
      const field = makeFieldDef({ isCustom: true });
      vi.spyOn(service, 'findById').mockResolvedValueOnce(field as any);
      // count query returns values exist
      mockDb._chain.where.mockResolvedValueOnce([{ total: 5 }]);

      await expect(service.delete('fd1')).rejects.toThrow(ConflictException);
    });
  });

  // --- findById ---

  describe('findById', () => {
    it('should return field if found', async () => {
      const field = makeFieldDef();
      mockDb._chain.limit.mockResolvedValueOnce([field]);

      const result = await service.findById('fd1');
      expect(result).toEqual(field);
    });

    it('should return null if not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      const result = await service.findById('nonexistent');
      expect(result).toBeNull();
    });
  });

  // --- findByEntityAndKey ---

  describe('findByEntityAndKey', () => {
    it('should return field matching entity type and key', async () => {
      const field = makeFieldDef();
      mockDb._chain.limit.mockResolvedValueOnce([field]);

      const result = await service.findByEntityAndKey('candidates', 'custom_field');
      expect(result).toEqual(field);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return null when no match', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      const result = await service.findByEntityAndKey('candidates', 'nonexistent_key');
      expect(result).toBeNull();
    });
  });

  // --- listByEntity ---

  describe('listByEntity', () => {
    it('should return all fields for the entity type', async () => {
      const fields = [
        makeFieldDef({ id: 'fd1', fieldKey: 'first_name', sortOrder: 0 }),
        makeFieldDef({ id: 'fd2', fieldKey: 'last_name', sortOrder: 1 }),
      ];
      mockDb._chain.orderBy.mockResolvedValueOnce(fields);

      const result = await service.listByEntity('candidates');
      expect(result).toHaveLength(2);
      expect(result[0].fieldKey).toBe('first_name');
      expect(result[1].fieldKey).toBe('last_name');
    });

    it('should return empty array when no fields exist', async () => {
      mockDb._chain.orderBy.mockResolvedValueOnce([]);

      const result = await service.listByEntity('unknown_entity');
      expect(result).toEqual([]);
    });
  });

  // --- registerStandardFields ---

  describe('registerStandardFields', () => {
    it('should create new fields that do not exist', async () => {
      // For each field: findByEntityAndKey returns [] (not found), then findByEntityAndColumn returns [] (not found)
      mockDb._chain.limit
        .mockResolvedValueOnce([])   // findByEntityAndKey for first_name
        .mockResolvedValueOnce([])   // findByEntityAndColumn for first_name
        .mockResolvedValueOnce([])   // findByEntityAndKey for last_name
        .mockResolvedValueOnce([]);  // findByEntityAndColumn for last_name

      await service.registerStandardFields('candidates', [
        { fieldKey: 'first_name', label: 'First Name', fieldType: 'text', columnName: 'first_name' },
        { fieldKey: 'last_name', label: 'Last Name', fieldType: 'text', columnName: 'last_name' },
      ]);

      // Should have called insert twice
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });

    it('should not override admin customizations on existing fields (idempotent)', async () => {
      const existing = makeFieldDef({
        id: 'fd1',
        fieldKey: 'first_name',
        label: 'Admin Custom Label',
        columnName: 'first_name',
        sortOrder: 5,
        isCustom: false,
      });
      // findByEntityAndKey returns existing
      mockDb._chain.limit.mockResolvedValueOnce([existing]);

      await service.registerStandardFields('candidates', [
        {
          fieldKey: 'first_name',
          label: 'First Name',
          fieldType: 'text',
          columnName: 'first_name',
          sortOrder: 5,
        },
      ]);

      // Should NOT call insert (field exists), and should not update since nothing changed
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should update sortOrder and columnName if changed', async () => {
      const existing = makeFieldDef({
        id: 'fd1',
        fieldKey: 'first_name',
        columnName: null,
        sortOrder: 0,
        isCustom: false,
      });
      mockDb._chain.limit.mockResolvedValueOnce([existing]);

      await service.registerStandardFields('candidates', [
        {
          fieldKey: 'first_name',
          label: 'First Name',
          fieldType: 'text',
          columnName: 'first_name',
          sortOrder: 3,
        },
      ]);

      // Should have called update to set the columnName + sortOrder
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  // --- setPicklistOptions ---

  describe('setPicklistOptions', () => {
    it('should replace picklist options for a picklist field', async () => {
      const field = makeFieldDef({ id: 'fd1', fieldType: 'picklist' });
      mockDb._chain.limit.mockResolvedValueOnce([field]);

      await service.setPicklistOptions('candidates', 'custom_field', [
        { label: 'Option A', value: 'a' },
        { label: 'Option B', value: 'b', isDefault: true },
      ]);

      // Delete old options + insert new ones
      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should throw BadRequestException for non-picklist field type', async () => {
      const field = makeFieldDef({ id: 'fd1', fieldType: 'text' });
      mockDb._chain.limit.mockResolvedValueOnce([field]);

      await expect(
        service.setPicklistOptions('candidates', 'custom_field', [
          { label: 'Option A', value: 'a' },
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if field not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(
        service.setPicklistOptions('candidates', 'nonexistent', [
          { label: 'A', value: 'a' },
        ]),
      ).rejects.toThrow(NotFoundException);
    });

    it('should work with multi_select field type', async () => {
      const field = makeFieldDef({ id: 'fd1', fieldType: 'multi_select' });
      mockDb._chain.limit.mockResolvedValueOnce([field]);

      await service.setPicklistOptions('candidates', 'custom_field', [
        { label: 'Tag A', value: 'tag_a' },
      ]);

      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should only delete (not insert) when options array is empty', async () => {
      const field = makeFieldDef({ id: 'fd1', fieldType: 'picklist' });
      mockDb._chain.limit.mockResolvedValueOnce([field]);

      await service.setPicklistOptions('candidates', 'custom_field', []);

      expect(mockDb.delete).toHaveBeenCalled();
      // Insert should not be called since options are empty
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });
});
