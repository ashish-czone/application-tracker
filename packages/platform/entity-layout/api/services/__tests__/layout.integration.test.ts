import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { createPlatformTestModule, cleanDatabase } from '@packages/platform-testing';
import { FieldDefinitionService, EntityRegistryService, EntityDefinitionService } from '@packages/entity-engine';
import { LayoutService } from '../layout.service';
import type { DrizzleDB } from '@packages/database';
import type { TestingModule } from '@nestjs/testing';

describe('Entity Layout (integration)', () => {
  let module: TestingModule;
  let db: DrizzleDB;
  let cleanup: () => Promise<void>;
  let layoutService: LayoutService;
  let fieldDefService: FieldDefinitionService;

  beforeAll(async () => {
    const ctx = await createPlatformTestModule({
      providers: [LayoutService, FieldDefinitionService, EntityRegistryService, EntityDefinitionService],
      mocks: { automations: false },
    });
    module = ctx.module;
    db = ctx.db;
    cleanup = ctx.cleanup;
    layoutService = module.get(LayoutService);
    fieldDefService = module.get(FieldDefinitionService);
  });

  afterEach(async () => {
    await cleanDatabase(db);
    await fieldDefService.reloadCache();
  });

  afterAll(async () => {
    await cleanup();
  });

  async function seedFields(entityType: string, fieldKeys: string[]) {
    await fieldDefService.registerStandardFields(
      entityType,
      fieldKeys.map((key, i) => ({
        fieldKey: key,
        label: key.charAt(0).toUpperCase() + key.slice(1),
        fieldType: 'text' as const,
        sortOrder: i,
      })),
    );
    const fields = await fieldDefService.listByEntity(entityType);
    return new Map(fields.map(f => [f.fieldKey, f.id]));
  }

  // ---------------------------------------------------------------------------
  // Section CRUD
  // ---------------------------------------------------------------------------

  describe('Section CRUD', () => {
    it('should create a section', async () => {
      const section = await layoutService.createSection('test_entity', 'Standard', {
        name: 'General Info',
        columns: 2,
      });

      expect(section.id).toBeDefined();
      expect(section.name).toBe('General Info');
      expect(section.columns).toBe(2);
      expect(section.isCollapsible).toBe(true);
    });

    it('should auto-calculate sortOrder', async () => {
      await layoutService.createSection('sort_entity', 'Standard', { name: 'First' });
      const second = await layoutService.createSection('sort_entity', 'Standard', { name: 'Second' });

      expect(second.sortOrder).toBe(1);
    });

    it('should update a section', async () => {
      const section = await layoutService.createSection('update_entity', 'Standard', {
        name: 'Original',
        columns: 2,
      });

      const updated = await layoutService.updateSection(section.id, {
        name: 'Updated',
        columns: 3,
      });

      expect(updated.name).toBe('Updated');
      expect(updated.columns).toBe(3);
    });

    it('should throw on update of nonexistent section', async () => {
      await expect(
        layoutService.updateSection('nonexistent-id', { name: 'X' }),
      ).rejects.toThrow();
    });

    it('should delete a section', async () => {
      const section = await layoutService.createSection('delete_entity', 'Standard', {
        name: 'To Delete',
      });

      await layoutService.deleteSection(section.id);

      // Verify section is gone by trying to update it
      await expect(
        layoutService.updateSection(section.id, { name: 'X' }),
      ).rejects.toThrow();
    });

    it('should reorder sections', async () => {
      const s1 = await layoutService.createSection('reorder_entity', 'Standard', { name: 'A' });
      const s2 = await layoutService.createSection('reorder_entity', 'Standard', { name: 'B' });
      const s3 = await layoutService.createSection('reorder_entity', 'Standard', { name: 'C' });

      await layoutService.reorderSections('reorder_entity', 'Standard', [s3.id, s1.id, s2.id]);

      const layout = await layoutService.getLayout('reorder_entity', 'Standard');
      const sectionNames = layout.sections
        .filter(s => s.id !== '__unassigned__')
        .map(s => s.name);
      expect(sectionNames).toEqual(['C', 'A', 'B']);
    });
  });

  // ---------------------------------------------------------------------------
  // Field Placement
  // ---------------------------------------------------------------------------

  describe('Field Placement', () => {
    it('should add and remove a field from a section', async () => {
      const fieldMap = await seedFields('placement_entity', ['firstName', 'email']);
      const section = await layoutService.createSection('placement_entity', 'Standard', {
        name: 'Details',
      });

      await layoutService.addFieldToSection(section.id, fieldMap.get('firstName')!);
      await layoutService.addFieldToSection(section.id, fieldMap.get('email')!);

      let layout = await layoutService.getLayout('placement_entity', 'Standard');
      const detailsSection = layout.sections.find(s => s.name === 'Details')!;
      expect(detailsSection.fields).toHaveLength(2);

      await layoutService.removeFieldFromSection(section.id, fieldMap.get('email')!);

      layout = await layoutService.getLayout('placement_entity', 'Standard');
      const updated = layout.sections.find(s => s.name === 'Details')!;
      expect(updated.fields).toHaveLength(1);
      expect(updated.fields[0].fieldKey).toBe('firstName');
    });

    it('should reorder fields in a section', async () => {
      const fieldMap = await seedFields('reorder_fields', ['a', 'b', 'c']);
      const section = await layoutService.createSection('reorder_fields', 'Standard', {
        name: 'Fields',
      });

      await layoutService.addFieldToSection(section.id, fieldMap.get('a')!);
      await layoutService.addFieldToSection(section.id, fieldMap.get('b')!);
      await layoutService.addFieldToSection(section.id, fieldMap.get('c')!);

      await layoutService.reorderFieldsInSection(section.id, [
        fieldMap.get('c')!,
        fieldMap.get('a')!,
        fieldMap.get('b')!,
      ]);

      const layout = await layoutService.getLayout('reorder_fields', 'Standard');
      const fieldsSection = layout.sections.find(s => s.name === 'Fields')!;
      const keys = fieldsSection.fields.map(f => f.fieldKey);
      expect(keys).toEqual(['c', 'a', 'b']);
    });
  });

  // ---------------------------------------------------------------------------
  // getLayout
  // ---------------------------------------------------------------------------

  describe('getLayout', () => {
    it('should assemble a full layout with sections and fields', async () => {
      const fieldMap = await seedFields('full_layout', ['name', 'email', 'phone']);

      const section = await layoutService.createSection('full_layout', 'Standard', {
        name: 'Contact Info',
        columns: 2,
      });

      await layoutService.addFieldToSection(section.id, fieldMap.get('name')!);
      await layoutService.addFieldToSection(section.id, fieldMap.get('email')!);

      const layout = await layoutService.getLayout('full_layout', 'Standard');

      expect(layout.entityType).toBe('full_layout');
      expect(layout.layoutName).toBe('Standard');

      const contactSection = layout.sections.find(s => s.name === 'Contact Info')!;
      expect(contactSection).toBeDefined();
      expect(contactSection.fields).toHaveLength(2);
      expect(contactSection.columns).toBe(2);

      // phone should be in unassigned
      const unassigned = layout.sections.find(s => s.id === '__unassigned__');
      expect(unassigned).toBeDefined();
      expect(unassigned!.fields.some(f => f.fieldKey === 'phone')).toBe(true);
    });

    it('should include quickCreateFields', async () => {
      await fieldDefService.registerStandardFields('quick_create', [
        { fieldKey: 'name', label: 'Name', fieldType: 'text', isQuickCreate: true },
        { fieldKey: 'email', label: 'Email', fieldType: 'email', isQuickCreate: true },
        { fieldKey: 'notes', label: 'Notes', fieldType: 'textarea' },
      ]);

      const layout = await layoutService.getLayout('quick_create', 'Standard');
      expect(layout.quickCreateFields).toHaveLength(2);
      expect(layout.quickCreateFields.map(f => f.fieldKey).sort()).toEqual(['email', 'name']);
    });

    it('should return cached layout on second call', async () => {
      await seedFields('cached_entity', ['x']);
      const layout1 = await layoutService.getLayout('cached_entity', 'Standard');
      const layout2 = await layoutService.getLayout('cached_entity', 'Standard');
      expect(layout1).toBe(layout2); // same reference = cached
    });
  });

  // ---------------------------------------------------------------------------
  // seedDefaultLayout
  // ---------------------------------------------------------------------------

  describe('seedDefaultLayout', () => {
    it('should seed sections with fields', async () => {
      const fieldMap = await seedFields('seed_entity', ['firstName', 'lastName', 'email', 'phone']);

      await layoutService.seedDefaultLayout('seed_entity', [
        { name: 'Personal', fields: ['firstName', 'lastName'] },
        { name: 'Contact', fields: ['email', 'phone'] },
      ]);

      const layout = await layoutService.getLayout('seed_entity', 'Standard');
      const sectionNames = layout.sections
        .filter(s => s.id !== '__unassigned__')
        .map(s => s.name);
      expect(sectionNames).toContain('Personal');
      expect(sectionNames).toContain('Contact');

      const personal = layout.sections.find(s => s.name === 'Personal')!;
      expect(personal.fields).toHaveLength(2);
    });

    it('should be idempotent', async () => {
      await seedFields('idempotent_entity', ['a', 'b']);

      await layoutService.seedDefaultLayout('idempotent_entity', [
        { name: 'Section', fields: ['a', 'b'] },
      ]);
      await layoutService.seedDefaultLayout('idempotent_entity', [
        { name: 'Section', fields: ['a', 'b'] },
      ]);

      const layout = await layoutService.getLayout('idempotent_entity', 'Standard');
      const sections = layout.sections.filter(s => s.name === 'Section');
      expect(sections).toHaveLength(1);
    });

    it('should skip missing fields gracefully', async () => {
      await seedFields('missing_fields', ['exists']);

      await layoutService.seedDefaultLayout('missing_fields', [
        { name: 'Section', fields: ['exists', 'doesNotExist'] },
      ]);

      const layout = await layoutService.getLayout('missing_fields', 'Standard');
      const section = layout.sections.find(s => s.name === 'Section')!;
      expect(section.fields).toHaveLength(1);
      expect(section.fields[0].fieldKey).toBe('exists');
    });

    it('should support tuple format for column index', async () => {
      await seedFields('tuple_entity', ['left', 'right']);

      await layoutService.seedDefaultLayout('tuple_entity', [
        { name: 'Row', columns: 2, fields: [['left', 0], ['right', 1]] },
      ]);

      const layout = await layoutService.getLayout('tuple_entity', 'Standard');
      const section = layout.sections.find(s => s.name === 'Row')!;
      expect(section.fields).toHaveLength(2);
    });
  });
});
