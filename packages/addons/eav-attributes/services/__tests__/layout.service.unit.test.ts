import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { LayoutService } from '../layout.service';

function createMockDb() {
  const mockChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    orderBy: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
    // Make chain thenable so `await db.select().from().where()` resolves to []
    then: vi.fn((resolve: any) => resolve([])),
  };

  return {
    select: vi.fn().mockReturnValue(mockChain),
    insert: vi.fn().mockReturnValue(mockChain),
    update: vi.fn().mockReturnValue(mockChain),
    delete: vi.fn().mockReturnValue(mockChain),
    _chain: mockChain,
  };
}

function makeSection(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sec1',
    entityType: 'candidates',
    layoutName: 'Standard',
    name: 'Basic Info',
    columns: 2,
    sortOrder: 0,
    isCollapsible: true,
    isTabular: false,
    tabularMaxRows: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('LayoutService', () => {
  let service: LayoutService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockFieldDefService: { listByEntityWithOptions: ReturnType<typeof vi.fn>; findByEntityAndKey: ReturnType<typeof vi.fn> };
  let mockEntityDefService: { isAdminConfigurable: ReturnType<typeof vi.fn>; resolveLayoutFromRegistry: ReturnType<typeof vi.fn> };
  let mockEntityRegistry: { getResolvedExtension: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockDb = createMockDb();
    const databaseService = { db: mockDb } as any;
    mockFieldDefService = {
      listByEntityWithOptions: vi.fn().mockReturnValue([]),
      findByEntityAndKey: vi.fn().mockReturnValue(null),
    };
    mockEntityDefService = {
      isAdminConfigurable: vi.fn().mockReturnValue(true),
      resolveLayoutFromRegistry: vi.fn(),
    };
    mockEntityRegistry = {
      getResolvedExtension: vi.fn().mockReturnValue(undefined),
      get: vi.fn().mockReturnValue(undefined),
    };
    service = new LayoutService(
      databaseService,
      mockFieldDefService as any,
      mockEntityDefService as any,
      mockEntityRegistry as any,
    );
  });

  // --- createSection ---

  describe('createSection', () => {
    it('should insert a section and return it', async () => {
      const section = makeSection();
      // select existing sections (for max sort order)
      mockDb._chain.orderBy.mockResolvedValueOnce([]);
      // insert returns new section
      mockDb._chain.returning.mockResolvedValueOnce([section]);

      const result = await service.createSection('candidates', 'Standard', {
        name: 'Basic Info',
      });

      expect(result).toEqual(section);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should compute next sort order from existing sections', async () => {
      const existing = [makeSection({ sortOrder: 2 }), makeSection({ id: 'sec2', sortOrder: 5 })];
      mockDb._chain.orderBy.mockResolvedValueOnce(existing);
      const newSection = makeSection({ id: 'sec3', sortOrder: 6 });
      mockDb._chain.returning.mockResolvedValueOnce([newSection]);

      const result = await service.createSection('candidates', 'Standard', {
        name: 'New Section',
      });

      expect(result.sortOrder).toBe(6);
    });

    it('should invalidate cache after creation', async () => {
      mockDb._chain.orderBy.mockResolvedValueOnce([]);
      mockDb._chain.returning.mockResolvedValueOnce([makeSection()]);

      // Populate cache first
      const invalidateSpy = vi.spyOn(service as any, 'invalidateCache');
      await service.createSection('candidates', 'Standard', { name: 'X' });

      expect(invalidateSpy).toHaveBeenCalledWith('candidates', 'Standard');
    });
  });

  // --- updateSection ---

  describe('updateSection', () => {
    it('should update and return the section', async () => {
      const existing = makeSection();
      const updated = makeSection({ name: 'Updated Name' });
      // findSectionById
      mockDb._chain.limit.mockResolvedValueOnce([existing]);
      // update returns updated
      mockDb._chain.returning.mockResolvedValueOnce([updated]);

      const result = await service.updateSection('sec1', { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if section not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.updateSection('nonexistent', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return existing section on empty update (no-op)', async () => {
      const existing = makeSection();
      mockDb._chain.limit.mockResolvedValueOnce([existing]);

      const result = await service.updateSection('sec1', {});

      expect(result).toEqual(existing);
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  // --- deleteSection ---

  describe('deleteSection', () => {
    it('should delete a section', async () => {
      const section = makeSection();
      mockDb._chain.limit.mockResolvedValueOnce([section]);

      await expect(service.deleteSection('sec1')).resolves.toBeUndefined();
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException if section not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.deleteSection('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // --- reorderSections ---

  describe('reorderSections', () => {
    it('should update sort order for all provided section ids', async () => {
      await service.reorderSections('candidates', 'Standard', ['sec2', 'sec1', 'sec3']);

      // Should call update 3 times
      expect(mockDb.update).toHaveBeenCalledTimes(3);
    });

    it('should invalidate cache after reorder', async () => {
      const invalidateSpy = vi.spyOn(service as any, 'invalidateCache');

      await service.reorderSections('candidates', 'Standard', ['sec1']);

      expect(invalidateSpy).toHaveBeenCalledWith('candidates', 'Standard');
    });
  });

  // --- addFieldToSection ---

  describe('addFieldToSection', () => {
    it('should add a field to a section', async () => {
      const section = makeSection();
      // findSectionById -> select().from().where().limit(1) -> resolves via limit
      mockDb._chain.limit.mockResolvedValueOnce([section]);
      // existingFields -> select().from(layoutFields).where() -> resolves via thenable chain to []

      await expect(service.addFieldToSection('sec1', 'fd1')).resolves.toBeUndefined();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should throw NotFoundException if section not found', async () => {
      // findSectionById returns empty
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.addFieldToSection('nonexistent', 'fd1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should compute next sort order from existing fields', async () => {
      const section = makeSection();
      // findSectionById via limit
      mockDb._chain.limit.mockResolvedValueOnce([section]);
      // existingFields: override .then to return fields with sort orders
      mockDb._chain.then.mockImplementationOnce((resolve: any) =>
        resolve([{ sortOrder: 0 }, { sortOrder: 3 }]),
      );

      await service.addFieldToSection('sec1', 'fd1');

      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  // --- removeFieldFromSection ---

  describe('removeFieldFromSection', () => {
    it('should remove a field from a section', async () => {
      const section = makeSection();
      mockDb._chain.limit.mockResolvedValueOnce([section]);

      await expect(service.removeFieldFromSection('sec1', 'fd1')).resolves.toBeUndefined();
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException if section not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.removeFieldFromSection('nonexistent', 'fd1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // --- reorderFieldsInSection ---

  describe('reorderFieldsInSection', () => {
    it('should update sort order for fields in section', async () => {
      const section = makeSection();
      mockDb._chain.limit.mockResolvedValueOnce([section]);

      await service.reorderFieldsInSection('sec1', ['fd3', 'fd1', 'fd2']);

      expect(mockDb.update).toHaveBeenCalledTimes(3);
    });

    it('should throw NotFoundException if section not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(
        service.reorderFieldsInSection('nonexistent', ['fd1']),
      ).rejects.toThrow(NotFoundException);
    });

    it('should invalidate cache after reorder', async () => {
      const section = makeSection();
      mockDb._chain.limit.mockResolvedValueOnce([section]);
      const invalidateSpy = vi.spyOn(service as any, 'invalidateCache');

      await service.reorderFieldsInSection('sec1', ['fd1']);

      expect(invalidateSpy).toHaveBeenCalledWith('candidates', 'Standard');
    });
  });

  // --- getLayout ---

  describe('getLayout', () => {
    it('should return full layout with sections, fields, and picklist options', async () => {
      const sections = [makeSection()];
      const layoutFieldRows = [
        { sectionId: 'sec1', fieldId: 'fd1', sortOrder: 0, columnIndex: 0 },
      ];
      const fieldsWithOptions = [
        {
          id: 'fd1', entityType: 'candidates', fieldKey: 'status', label: 'Status',
          fieldType: 'picklist', uiType: null, isRequired: false, isSystem: false,
          isCustom: false, isUnique: false, isQuickCreate: false, isReadonly: false,
          maxLength: null, defaultValue: null, columnName: null, lookupEntity: null,
          lookupLabelField: null, lookupSearchFields: null, sortOrder: 0,
          createdAt: new Date(), updatedAt: new Date(),
          picklistOptions: [
            { id: 'po1', fieldId: 'fd1', label: 'Active', value: 'active', isDefault: true, sortOrder: 0 },
          ],
          columnIndex: 0,
        },
      ];

      mockDb._chain.orderBy
        .mockResolvedValueOnce(sections)
        .mockResolvedValueOnce(layoutFieldRows);
      mockFieldDefService.listByEntityWithOptions.mockReturnValue(fieldsWithOptions);

      const result = await service.getLayout('candidates', 'Standard');

      expect(result.entityType).toBe('candidates');
      expect(result.layoutName).toBe('Standard');
      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].fields).toHaveLength(1);
      expect(result.sections[0].fields[0].picklistOptions).toHaveLength(1);
      expect(result.sections[0].fields[0].picklistOptions[0].label).toBe('Active');
    });

    it('should include unassigned fields section for fields not in any section', async () => {
      const sections = [makeSection()];
      // Only fd1 is placed in the section
      const layoutFieldRows = [
        { sectionId: 'sec1', fieldId: 'fd1', sortOrder: 0, columnIndex: 0 },
      ];

      mockDb._chain.orderBy
        .mockResolvedValueOnce(sections)
        .mockResolvedValueOnce(layoutFieldRows);
      mockFieldDefService.listByEntityWithOptions.mockReturnValue([
        {
          id: 'fd1', entityType: 'candidates', fieldKey: 'name', label: 'Name',
          fieldType: 'text', uiType: null, isRequired: false, isSystem: false,
          isCustom: false, isUnique: false, isQuickCreate: false, isReadonly: false,
          maxLength: null, defaultValue: null, columnName: null, lookupEntity: null,
          lookupLabelField: null, lookupSearchFields: null, sortOrder: 0,
          createdAt: new Date(), updatedAt: new Date(),
          picklistOptions: [], columnIndex: 0,
        },
        {
          id: 'fd2', entityType: 'candidates', fieldKey: 'orphan', label: 'Orphan Field',
          fieldType: 'text', uiType: null, isRequired: false, isSystem: false,
          isCustom: true, isUnique: false, isQuickCreate: false, isReadonly: false,
          maxLength: null, defaultValue: null, columnName: null, lookupEntity: null,
          lookupLabelField: null, lookupSearchFields: null, sortOrder: 1,
          createdAt: new Date(), updatedAt: new Date(),
          picklistOptions: [], columnIndex: 0,
        },
      ]);

      const result = await service.getLayout('candidates', 'Standard');

      // Regular section + unassigned section
      expect(result.sections).toHaveLength(2);
      const unassigned = result.sections.find(s => s.id === '__unassigned__');
      expect(unassigned).toBeDefined();
      expect(unassigned!.name).toBe('Unassigned Fields');
      expect(unassigned!.fields).toHaveLength(1);
      expect(unassigned!.fields[0].fieldKey).toBe('orphan');
    });

    it('should include quickCreateFields', async () => {
      mockDb._chain.orderBy.mockResolvedValueOnce([]);
      mockFieldDefService.listByEntityWithOptions.mockReturnValue([
        {
          id: 'fd1', entityType: 'candidates', fieldKey: 'name', label: 'Name',
          fieldType: 'text', uiType: null, isRequired: true, isSystem: false,
          isCustom: false, isUnique: false, isQuickCreate: true, isReadonly: false,
          maxLength: null, defaultValue: null, columnName: null, lookupEntity: null,
          lookupLabelField: null, lookupSearchFields: null, sortOrder: 0,
          createdAt: new Date(), updatedAt: new Date(),
          picklistOptions: [], columnIndex: 0,
        },
        {
          id: 'fd2', entityType: 'candidates', fieldKey: 'email', label: 'Email',
          fieldType: 'email', uiType: null, isRequired: false, isSystem: false,
          isCustom: false, isUnique: false, isQuickCreate: false, isReadonly: false,
          maxLength: null, defaultValue: null, columnName: null, lookupEntity: null,
          lookupLabelField: null, lookupSearchFields: null, sortOrder: 1,
          createdAt: new Date(), updatedAt: new Date(),
          picklistOptions: [], columnIndex: 0,
        },
      ]);

      const result = await service.getLayout('candidates');

      expect(result.quickCreateFields).toHaveLength(1);
      expect(result.quickCreateFields[0].fieldKey).toBe('name');
    });

    it('should cache results and return cached on second call', async () => {
      mockDb._chain.orderBy.mockResolvedValueOnce([]);

      const first = await service.getLayout('candidates', 'Standard');

      mockDb.select.mockClear();
      mockFieldDefService.listByEntityWithOptions.mockClear();

      const second = await service.getLayout('candidates', 'Standard');

      expect(second).toEqual(first);
      expect(mockDb.select).not.toHaveBeenCalled();
      expect(mockFieldDefService.listByEntityWithOptions).not.toHaveBeenCalled();
    });

    it('should invalidate cache after mutations', async () => {
      mockDb._chain.orderBy.mockResolvedValueOnce([]);

      // Populate cache
      await service.getLayout('candidates', 'Standard');

      // Mutate - deleteSection triggers invalidateCache
      const section = makeSection();
      mockDb._chain.limit.mockResolvedValueOnce([section]);
      await service.deleteSection('sec1');

      // Reset and setup for new getLayout call
      mockDb.select.mockClear();
      mockDb._chain.orderBy.mockResolvedValueOnce([]);

      // Should re-fetch since cache was invalidated
      await service.getLayout('candidates', 'Standard');
      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  // --- seedDefaultLayout ---

  describe('seedDefaultLayout', () => {
    it('should create sections and assign fields', async () => {
      // Check existing (none)
      mockDb._chain.limit.mockResolvedValueOnce([]);

      const section = makeSection();
      mockDb._chain.returning.mockResolvedValueOnce([section]);

      mockFieldDefService.findByEntityAndKey.mockReturnValue({ id: 'fd1', entityType: 'candidates', fieldKey: 'first_name' });

      await service.seedDefaultLayout('candidates', [
        { name: 'Basic Info', fields: ['first_name'] },
      ]);

      // insert for section + insert for layout_field
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });

    it('should skip seeding if sections already exist (idempotent)', async () => {
      // Check existing returns a section
      mockDb._chain.limit.mockResolvedValueOnce([makeSection()]);

      await service.seedDefaultLayout('candidates', [
        { name: 'Basic Info', fields: ['first_name'] },
      ]);

      // Should not insert anything
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should skip missing fields gracefully', async () => {
      // Check existing (none)
      mockDb._chain.limit.mockResolvedValueOnce([]);

      const section = makeSection();
      mockDb._chain.returning.mockResolvedValueOnce([section]);

      // field not found — mock returns null (default)
      mockFieldDefService.findByEntityAndKey.mockReturnValue(null);

      await service.seedDefaultLayout('candidates', [
        { name: 'Basic Info', fields: ['nonexistent_field'] },
      ]);

      // insert for section only, NOT for layout_field
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });
  });
});
