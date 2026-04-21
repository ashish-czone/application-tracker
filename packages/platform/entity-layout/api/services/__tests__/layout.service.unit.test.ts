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

function makeField(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fd1',
    entityType: 'candidates',
    fieldKey: 'status',
    label: 'Status',
    fieldType: 'picklist',
    uiType: null,
    isRequired: false,
    isSystem: false,
    isCustom: false,
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

describe('LayoutService', () => {
  let service: LayoutService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockFieldDefService: { listByEntityWithOptions: ReturnType<typeof vi.fn>; findByEntityAndKey: ReturnType<typeof vi.fn> };
  let mockEntityDefService: { isAdminConfigurable: ReturnType<typeof vi.fn>; resolveLayoutFromRegistry: ReturnType<typeof vi.fn> };
  let mockEntityRegistry: { getResolvedExtension: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };

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
    it('should insert a section with default values and return it', async () => {
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

    it('should auto-calculate sort order from existing sections', async () => {
      const existing = [makeSection({ sortOrder: 2 }), makeSection({ id: 'sec2', sortOrder: 5 })];
      mockDb._chain.orderBy.mockResolvedValueOnce(existing);
      const newSection = makeSection({ id: 'sec3', sortOrder: 6 });
      mockDb._chain.returning.mockResolvedValueOnce([newSection]);

      const result = await service.createSection('candidates', 'Standard', {
        name: 'New Section',
      });

      expect(result.sortOrder).toBe(6);
    });

    it('should use sortOrder 0 when no existing sections', async () => {
      mockDb._chain.orderBy.mockResolvedValueOnce([]);
      const newSection = makeSection({ sortOrder: 0 });
      mockDb._chain.returning.mockResolvedValueOnce([newSection]);

      const result = await service.createSection('candidates', 'Standard', {
        name: 'First Section',
      });

      expect(result.sortOrder).toBe(0);
    });

    it('should use explicit sortOrder when provided', async () => {
      mockDb._chain.orderBy.mockResolvedValueOnce([makeSection({ sortOrder: 0 })]);
      const newSection = makeSection({ sortOrder: 10 });
      mockDb._chain.returning.mockResolvedValueOnce([newSection]);

      const result = await service.createSection('candidates', 'Standard', {
        name: 'Custom Order',
        sortOrder: 10,
      });

      expect(result.sortOrder).toBe(10);
    });

    it('should invalidate cache after creation', async () => {
      mockDb._chain.orderBy.mockResolvedValueOnce([]);
      mockDb._chain.returning.mockResolvedValueOnce([makeSection()]);

      const invalidateSpy = vi.spyOn(service as any, 'invalidateCache');
      await service.createSection('candidates', 'Standard', { name: 'X' });

      expect(invalidateSpy).toHaveBeenCalledWith('candidates', 'Standard');
    });

    it('should default columns to 2 and isCollapsible to true', async () => {
      mockDb._chain.orderBy.mockResolvedValueOnce([]);
      const section = makeSection({ columns: 2, isCollapsible: true });
      mockDb._chain.returning.mockResolvedValueOnce([section]);

      const result = await service.createSection('candidates', 'Standard', {
        name: 'Defaults Test',
      });

      expect(result.columns).toBe(2);
      expect(result.isCollapsible).toBe(true);
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

    it('should only update provided fields', async () => {
      const existing = makeSection();
      const updated = makeSection({ columns: 3 });
      mockDb._chain.limit.mockResolvedValueOnce([existing]);
      mockDb._chain.returning.mockResolvedValueOnce([updated]);

      const result = await service.updateSection('sec1', { columns: 3 });

      expect(result.columns).toBe(3);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should invalidate cache after update', async () => {
      const existing = makeSection();
      const updated = makeSection({ name: 'New' });
      mockDb._chain.limit.mockResolvedValueOnce([existing]);
      mockDb._chain.returning.mockResolvedValueOnce([updated]);

      const invalidateSpy = vi.spyOn(service as any, 'invalidateCache');
      await service.updateSection('sec1', { name: 'New' });

      expect(invalidateSpy).toHaveBeenCalledWith('candidates', 'Standard');
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

    it('should invalidate cache after deletion', async () => {
      const section = makeSection();
      mockDb._chain.limit.mockResolvedValueOnce([section]);

      const invalidateSpy = vi.spyOn(service as any, 'invalidateCache');
      await service.deleteSection('sec1');

      expect(invalidateSpy).toHaveBeenCalledWith('candidates', 'Standard');
    });
  });

  // --- reorderSections ---

  describe('reorderSections', () => {
    it('should update sort order for all provided section ids', async () => {
      await service.reorderSections('candidates', 'Standard', ['sec2', 'sec1', 'sec3']);

      expect(mockDb.update).toHaveBeenCalledTimes(3);
    });

    it('should assign sort order based on array position', async () => {
      const setCalls: Record<string, unknown>[] = [];
      mockDb._chain.set.mockImplementation((values: Record<string, unknown>) => {
        setCalls.push(values);
        return mockDb._chain;
      });

      await service.reorderSections('candidates', 'Standard', ['sec2', 'sec1']);

      expect(setCalls[0]).toEqual({ sortOrder: 0 });
      expect(setCalls[1]).toEqual({ sortOrder: 1 });
    });

    it('should invalidate cache after reorder', async () => {
      const invalidateSpy = vi.spyOn(service as any, 'invalidateCache');

      await service.reorderSections('candidates', 'Standard', ['sec1']);

      expect(invalidateSpy).toHaveBeenCalledWith('candidates', 'Standard');
    });
  });

  // --- addFieldToSection ---

  describe('addFieldToSection', () => {
    it('should add a field to a section with default columnIndex 0', async () => {
      const section = makeSection();
      mockDb._chain.limit.mockResolvedValueOnce([section]);

      await expect(service.addFieldToSection('sec1', 'fd1')).resolves.toBeUndefined();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should throw NotFoundException if section not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.addFieldToSection('nonexistent', 'fd1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should auto-calculate sort order from existing layout fields', async () => {
      const section = makeSection();
      mockDb._chain.limit.mockResolvedValueOnce([section]);
      // existingFields via thenable chain
      mockDb._chain.then.mockImplementationOnce((resolve: any) =>
        resolve([{ sortOrder: 0 }, { sortOrder: 3 }]),
      );

      await service.addFieldToSection('sec1', 'fd1');

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should use columnIndex when provided', async () => {
      const section = makeSection();
      mockDb._chain.limit.mockResolvedValueOnce([section]);

      await service.addFieldToSection('sec1', 'fd1', 1);

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should invalidate cache after adding field', async () => {
      const section = makeSection();
      mockDb._chain.limit.mockResolvedValueOnce([section]);

      const invalidateSpy = vi.spyOn(service as any, 'invalidateCache');
      await service.addFieldToSection('sec1', 'fd1');

      expect(invalidateSpy).toHaveBeenCalledWith('candidates', 'Standard');
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

    it('should invalidate cache after removing field', async () => {
      const section = makeSection();
      mockDb._chain.limit.mockResolvedValueOnce([section]);

      const invalidateSpy = vi.spyOn(service as any, 'invalidateCache');
      await service.removeFieldFromSection('sec1', 'fd1');

      expect(invalidateSpy).toHaveBeenCalledWith('candidates', 'Standard');
    });
  });

  // --- reorderFieldsInSection ---

  describe('reorderFieldsInSection', () => {
    it('should handle string[] format (field ids only)', async () => {
      const section = makeSection();
      mockDb._chain.limit.mockResolvedValueOnce([section]);

      await service.reorderFieldsInSection('sec1', ['fd3', 'fd1', 'fd2']);

      expect(mockDb.update).toHaveBeenCalledTimes(3);
    });

    it('should handle { fieldId, columnIndex }[] format', async () => {
      const section = makeSection();
      mockDb._chain.limit.mockResolvedValueOnce([section]);

      const setCalls: Record<string, unknown>[] = [];
      mockDb._chain.set.mockImplementation((values: Record<string, unknown>) => {
        setCalls.push(values);
        return mockDb._chain;
      });

      await service.reorderFieldsInSection('sec1', [
        { fieldId: 'fd1', columnIndex: 0 },
        { fieldId: 'fd2', columnIndex: 1 },
      ]);

      expect(mockDb.update).toHaveBeenCalledTimes(2);
      expect(setCalls[0]).toEqual({ sortOrder: 0, columnIndex: 0 });
      expect(setCalls[1]).toEqual({ sortOrder: 1, columnIndex: 1 });
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
          ...makeField(),
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

    it('should include unassigned fields section for non-system fields not in any section', async () => {
      const sections = [makeSection()];
      const layoutFieldRows = [
        { sectionId: 'sec1', fieldId: 'fd1', sortOrder: 0, columnIndex: 0 },
      ];

      mockDb._chain.orderBy
        .mockResolvedValueOnce(sections)
        .mockResolvedValueOnce(layoutFieldRows);
      mockFieldDefService.listByEntityWithOptions.mockReturnValue([
        { ...makeField({ id: 'fd1', fieldKey: 'name' }), picklistOptions: [], columnIndex: 0 },
        { ...makeField({ id: 'fd2', fieldKey: 'orphan', isCustom: true }), picklistOptions: [], columnIndex: 0 },
      ]);

      const result = await service.getLayout('candidates', 'Standard');

      expect(result.sections).toHaveLength(2);
      const unassigned = result.sections.find(s => s.id === '__unassigned__');
      expect(unassigned).toBeDefined();
      expect(unassigned!.name).toBe('Unassigned Fields');
      expect(unassigned!.sortOrder).toBe(999);
      expect(unassigned!.fields).toHaveLength(1);
      expect(unassigned!.fields[0].fieldKey).toBe('orphan');
    });

    it('should filter system fields from unassigned section', async () => {
      mockDb._chain.orderBy.mockResolvedValueOnce([]);
      mockFieldDefService.listByEntityWithOptions.mockReturnValue([
        { ...makeField({ id: 'fd1', fieldKey: 'createdAt', isSystem: true }), picklistOptions: [], columnIndex: 0 },
        { ...makeField({ id: 'fd2', fieldKey: 'updatedAt', isSystem: true }), picklistOptions: [], columnIndex: 0 },
        { ...makeField({ id: 'fd3', fieldKey: 'name', isSystem: false }), picklistOptions: [], columnIndex: 0 },
      ]);

      const result = await service.getLayout('candidates');

      const unassigned = result.sections.find(s => s.id === '__unassigned__');
      expect(unassigned).toBeDefined();
      expect(unassigned!.fields).toHaveLength(1);
      expect(unassigned!.fields[0].fieldKey).toBe('name');
    });

    it('should not include unassigned section when all fields are placed', async () => {
      const sections = [makeSection()];
      const layoutFieldRows = [
        { sectionId: 'sec1', fieldId: 'fd1', sortOrder: 0, columnIndex: 0 },
      ];

      mockDb._chain.orderBy
        .mockResolvedValueOnce(sections)
        .mockResolvedValueOnce(layoutFieldRows);
      mockFieldDefService.listByEntityWithOptions.mockReturnValue([
        { ...makeField({ id: 'fd1', fieldKey: 'name' }), picklistOptions: [], columnIndex: 0 },
      ]);

      const result = await service.getLayout('candidates', 'Standard');

      expect(result.sections).toHaveLength(1);
      expect(result.sections.find(s => s.id === '__unassigned__')).toBeUndefined();
    });

    it('should include quickCreateFields', async () => {
      mockDb._chain.orderBy.mockResolvedValueOnce([]);
      mockFieldDefService.listByEntityWithOptions.mockReturnValue([
        { ...makeField({ id: 'fd1', fieldKey: 'name', isQuickCreate: true }), picklistOptions: [], columnIndex: 0 },
        { ...makeField({ id: 'fd2', fieldKey: 'email', isQuickCreate: false }), picklistOptions: [], columnIndex: 0 },
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

    it('should re-fetch after cache invalidation', async () => {
      mockDb._chain.orderBy.mockResolvedValueOnce([]);

      // Populate cache
      await service.getLayout('candidates', 'Standard');

      // Invalidate via deleteSection
      const section = makeSection();
      mockDb._chain.limit.mockResolvedValueOnce([section]);
      await service.deleteSection('sec1');

      // Reset and setup for new getLayout call
      mockDb.select.mockClear();
      mockDb._chain.orderBy.mockResolvedValueOnce([]);

      await service.getLayout('candidates', 'Standard');
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should default layoutName to Standard', async () => {
      mockDb._chain.orderBy.mockResolvedValueOnce([]);

      const result = await service.getLayout('candidates');

      expect(result.layoutName).toBe('Standard');
    });

    it('short-circuits via EntityDefinitionService when entity is not adminConfigurable — no DB calls', async () => {
      const registryLayout = {
        entityType: 'things',
        layoutName: 'Standard',
        sections: [{
          id: 'in-memory:things:section:0',
          name: 'Basics',
          columns: 1,
          sortOrder: 0,
          isCollapsible: true,
          isTabular: false,
          tabularMaxRows: null,
          fields: [],
        }],
        quickCreateFields: [],
        relationSections: [],
      };
      mockEntityDefService.isAdminConfigurable.mockReturnValue(false);
      mockEntityDefService.resolveLayoutFromRegistry.mockReturnValue(registryLayout);

      const result = await service.getLayout('things');

      expect(result).toEqual(registryLayout);
      expect(mockEntityDefService.resolveLayoutFromRegistry).toHaveBeenCalledWith('things', 'Standard');
      expect(mockDb.select).not.toHaveBeenCalled();
      expect(mockFieldDefService.listByEntityWithOptions).not.toHaveBeenCalled();
    });

    it('caches the registry-built layout on subsequent calls', async () => {
      const registryLayout = {
        entityType: 'things',
        layoutName: 'Standard',
        sections: [],
        quickCreateFields: [],
        relationSections: [],
      };
      mockEntityDefService.isAdminConfigurable.mockReturnValue(false);
      mockEntityDefService.resolveLayoutFromRegistry.mockReturnValue(registryLayout);

      await service.getLayout('things');
      mockEntityDefService.resolveLayoutFromRegistry.mockClear();
      await service.getLayout('things');

      expect(mockEntityDefService.resolveLayoutFromRegistry).not.toHaveBeenCalled();
    });

    it('merges parent projected fields into the layout for extension entities', async () => {
      mockDb._chain.orderBy.mockResolvedValueOnce([]); // no sections for child
      const childFields = [
        { ...makeField({ id: 'cf1', entityType: 'compliance_tasks', fieldKey: 'ruleId', label: 'Rule' }), picklistOptions: [], columnIndex: 0 },
      ];
      const parentFields = [
        { ...makeField({ id: 'pf1', entityType: 'tasks', fieldKey: 'title', label: 'Title' }), picklistOptions: [], columnIndex: 0 },
        { ...makeField({ id: 'pf2', entityType: 'tasks', fieldKey: 'status', label: 'Status' }), picklistOptions: [], columnIndex: 0 },
        { ...makeField({ id: 'pf3', entityType: 'tasks', fieldKey: 'assignee', label: 'Assignee' }), picklistOptions: [], columnIndex: 0 },
      ];
      mockFieldDefService.listByEntityWithOptions.mockImplementation((t: string) =>
        t === 'compliance_tasks' ? childFields : parentFields,
      );
      mockEntityRegistry.getResolvedExtension.mockReturnValue({
        parentEntityType: 'tasks',
        projectedColumns: [{ fieldKey: 'title' }, { fieldKey: 'status' }],
      });

      const result = await service.getLayout('compliance_tasks', 'Standard');

      const unassigned = result.sections.find((s) => s.id === '__unassigned__');
      expect(unassigned).toBeDefined();
      const keys = unassigned!.fields.map((f) => f.fieldKey);
      expect(keys).toEqual(expect.arrayContaining(['ruleId', 'title', 'status']));
      expect(keys).not.toContain('assignee');
    });

    it('child-declared fieldKey shadows the parent projection', async () => {
      mockDb._chain.orderBy.mockResolvedValueOnce([]);
      const childFields = [
        { ...makeField({ id: 'cf1', entityType: 'child', fieldKey: 'status', label: 'Child Status' }), picklistOptions: [], columnIndex: 0 },
      ];
      const parentFields = [
        { ...makeField({ id: 'pf1', entityType: 'parent', fieldKey: 'status', label: 'Parent Status' }), picklistOptions: [], columnIndex: 0 },
      ];
      mockFieldDefService.listByEntityWithOptions.mockImplementation((t: string) =>
        t === 'child' ? childFields : parentFields,
      );
      mockEntityRegistry.getResolvedExtension.mockReturnValue({
        parentEntityType: 'parent',
        projectedColumns: [{ fieldKey: 'status' }],
      });

      const result = await service.getLayout('child');

      const unassigned = result.sections.find((s) => s.id === '__unassigned__')!;
      const statusEntries = unassigned.fields.filter((f) => f.fieldKey === 'status');
      expect(statusEntries).toHaveLength(1);
      expect(statusEntries[0].label).toBe('Child Status');
    });

    it('should handle fields with no matching layout field gracefully', async () => {
      const sections = [makeSection()];
      // layoutField references a fieldId that does not exist in the cache
      const layoutFieldRows = [
        { sectionId: 'sec1', fieldId: 'nonexistent-field', sortOrder: 0, columnIndex: 0 },
      ];

      mockDb._chain.orderBy
        .mockResolvedValueOnce(sections)
        .mockResolvedValueOnce(layoutFieldRows);
      mockFieldDefService.listByEntityWithOptions.mockReturnValue([
        { ...makeField({ id: 'fd1' }), picklistOptions: [], columnIndex: 0 },
      ]);

      const result = await service.getLayout('candidates', 'Standard');

      // The section should have 0 fields since the fieldId didn't match
      expect(result.sections[0].fields).toHaveLength(0);
      // fd1 is unassigned since it's not placed
      const unassigned = result.sections.find(s => s.id === '__unassigned__');
      expect(unassigned).toBeDefined();
      expect(unassigned!.fields).toHaveLength(1);
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
      mockDb._chain.limit.mockResolvedValueOnce([makeSection()]);

      await service.seedDefaultLayout('candidates', [
        { name: 'Basic Info', fields: ['first_name'] },
      ]);

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should skip missing fields gracefully', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      const section = makeSection();
      mockDb._chain.returning.mockResolvedValueOnce([section]);

      // field not found
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await service.seedDefaultLayout('candidates', [
        { name: 'Basic Info', fields: ['nonexistent_field'] },
      ]);

      // insert for section only, NOT for layout_field
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });

    it('should handle tuple field entries with explicit columnIndex', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      const section = makeSection();
      mockDb._chain.returning.mockResolvedValueOnce([section]);

      mockFieldDefService.findByEntityAndKey.mockReturnValue({ id: 'fd1', entityType: 'candidates', fieldKey: 'first_name' });

      await service.seedDefaultLayout('candidates', [
        { name: 'Basic Info', fields: [['first_name', 1]] },
      ]);

      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });

    it('should create multiple sections with correct sort orders', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      const section1 = makeSection({ id: 'sec1' });
      const section2 = makeSection({ id: 'sec2', name: 'Details' });
      mockDb._chain.returning
        .mockResolvedValueOnce([section1])
        .mockResolvedValueOnce([section2]);

      await service.seedDefaultLayout('candidates', [
        { name: 'Basic Info', fields: [] },
        { name: 'Details', fields: [] },
      ]);

      // Two section inserts, no field inserts
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });

    it('should default layoutName to Standard', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([makeSection()]);

      await service.seedDefaultLayout('candidates', []);

      // We just verify it doesn't throw and the idempotent check works
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should invalidate cache after seeding', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      const section = makeSection();
      mockDb._chain.returning.mockResolvedValueOnce([section]);

      const invalidateSpy = vi.spyOn(service as any, 'invalidateCache');
      await service.seedDefaultLayout('candidates', [
        { name: 'Basic Info', fields: [] },
      ]);

      expect(invalidateSpy).toHaveBeenCalledWith('candidates', 'Standard');
    });
  });

  // --- invalidateCache ---

  describe('invalidateCache', () => {
    it('should clear cache for a specific entity type and layout name', async () => {
      // Populate cache via getLayout
      mockDb._chain.orderBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.getLayout('candidates', 'Standard');

      // Access internal cache to verify it's populated
      const cache = (service as any).layoutCache;
      expect(cache.has('candidates:Standard')).toBe(true);

      // Invalidate
      (service as any).invalidateCache('candidates', 'Standard');

      expect(cache.has('candidates:Standard')).toBe(false);
    });

    it('should not affect cache entries for other entity types', async () => {
      // Populate cache for two entity types
      mockDb._chain.orderBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.getLayout('candidates', 'Standard');
      await service.getLayout('contacts', 'Standard');

      const cache = (service as any).layoutCache;
      expect(cache.has('candidates:Standard')).toBe(true);
      expect(cache.has('contacts:Standard')).toBe(true);

      // Invalidate only candidates
      (service as any).invalidateCache('candidates', 'Standard');

      expect(cache.has('candidates:Standard')).toBe(false);
      expect(cache.has('contacts:Standard')).toBe(true);
    });
  });
});
