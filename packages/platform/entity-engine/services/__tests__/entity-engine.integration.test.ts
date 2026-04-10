import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { createPlatformTestModule, cleanDatabase } from '@packages/platform-testing';
import { FieldDefinitionService } from '../field-definition.service';
import { LookupResolverService } from '../lookup-resolver.service';
import { FieldTypeSaveHookRegistry } from '../field-type-save-hook.registry';
import { EntityRegistryService } from '../../entity-registry.service';
import type { DrizzleDB } from '@packages/database';
import type { TestingModule } from '@nestjs/testing';

describe('Entity Engine (integration)', () => {
  let module: TestingModule;
  let db: DrizzleDB;
  let cleanup: () => Promise<void>;
  let fieldDefService: FieldDefinitionService;
  let entityRegistry: EntityRegistryService;
  let lookupResolver: LookupResolverService;

  beforeAll(async () => {
    const ctx = await createPlatformTestModule({
      providers: [
        FieldDefinitionService,
        EntityRegistryService,
        LookupResolverService,
        FieldTypeSaveHookRegistry,
      ],
      mocks: { automations: false },
    });
    module = ctx.module;
    db = ctx.db;
    cleanup = ctx.cleanup;
    fieldDefService = module.get(FieldDefinitionService);
    entityRegistry = module.get(EntityRegistryService);
    lookupResolver = module.get(LookupResolverService);
  });

  afterEach(async () => {
    await cleanDatabase(db);
    LookupResolverService.clearRegistry();
  });

  afterAll(async () => {
    await cleanup();
  });

  // ---------------------------------------------------------------------------
  // FieldDefinitionService
  // ---------------------------------------------------------------------------

  describe('FieldDefinitionService', () => {
    it('should create a custom field and retrieve it', async () => {
      const field = await fieldDefService.create('test_entity', {
        fieldKey: 'custom_score',
        label: 'Custom Score',
        fieldType: 'number',
      });

      expect(field.id).toBeDefined();
      expect(field.fieldKey).toBe('custom_score');
      expect(field.label).toBe('Custom Score');
      expect(field.fieldType).toBe('number');
      expect(field.isCustom).toBe(true);
      expect(field.isSystem).toBe(false);
      expect(field.columnName).toBeNull();

      const found = await fieldDefService.findById(field.id);
      expect(found).not.toBeNull();
      expect(found!.fieldKey).toBe('custom_score');
    });

    it('should reject duplicate field keys for the same entity', async () => {
      await fieldDefService.create('test_entity', {
        fieldKey: 'unique_field',
        label: 'First',
        fieldType: 'text',
      });

      await expect(
        fieldDefService.create('test_entity', {
          fieldKey: 'unique_field',
          label: 'Duplicate',
          fieldType: 'text',
        }),
      ).rejects.toThrow('already exists');
    });

    it('should allow same field key on different entities', async () => {
      await fieldDefService.create('entity_a', {
        fieldKey: 'status',
        label: 'Status',
        fieldType: 'picklist',
      });

      const field = await fieldDefService.create('entity_b', {
        fieldKey: 'status',
        label: 'Status',
        fieldType: 'picklist',
      });

      expect(field.id).toBeDefined();
    });

    it('should update a field', async () => {
      const field = await fieldDefService.create('test_entity', {
        fieldKey: 'editable',
        label: 'Original',
        fieldType: 'text',
      });

      const updated = await fieldDefService.update(field.id, {
        label: 'Updated Label',
        isRequired: true,
        maxLength: 200,
      });

      expect(updated.label).toBe('Updated Label');
      expect(updated.isRequired).toBe(true);
      expect(updated.maxLength).toBe(200);
    });

    it('should delete a custom field', async () => {
      const field = await fieldDefService.create('test_entity', {
        fieldKey: 'to_delete',
        label: 'Delete Me',
        fieldType: 'text',
      });

      await fieldDefService.delete(field.id);

      const found = await fieldDefService.findById(field.id);
      expect(found).toBeNull();
    });

    it('should prevent deletion of non-custom fields', async () => {
      await fieldDefService.registerStandardFields('test_entity', [
        { fieldKey: 'standard', label: 'Standard', fieldType: 'text', columnName: 'standard' },
      ]);

      const field = await fieldDefService.findByEntityAndKey('test_entity', 'standard');
      expect(field).not.toBeNull();

      await expect(fieldDefService.delete(field!.id)).rejects.toThrow('Cannot delete');
    });

    it('should list fields by entity ordered by sortOrder', async () => {
      await fieldDefService.create('sorted_entity', {
        fieldKey: 'third',
        label: 'Third',
        fieldType: 'text',
      });
      await fieldDefService.create('sorted_entity', {
        fieldKey: 'first',
        label: 'First',
        fieldType: 'text',
      });

      // Update sort orders
      const fields = await fieldDefService.listByEntity('sorted_entity');
      await fieldDefService.update(fields[0].id, { sortOrder: 2 });
      await fieldDefService.update(fields[1].id, { sortOrder: 1 });

      const sorted = await fieldDefService.listByEntity('sorted_entity');
      expect(sorted[0].fieldKey).toBe('first');
      expect(sorted[1].fieldKey).toBe('third');
    });

    it('should find field by entity and key', async () => {
      await fieldDefService.create('find_entity', {
        fieldKey: 'target',
        label: 'Target',
        fieldType: 'text',
      });

      const found = await fieldDefService.findByEntityAndKey('find_entity', 'target');
      expect(found).not.toBeNull();
      expect(found!.label).toBe('Target');

      const notFound = await fieldDefService.findByEntityAndKey('find_entity', 'nonexistent');
      expect(notFound).toBeNull();
    });

    describe('Picklist options', () => {
      it('should set and retrieve picklist options', async () => {
        const field = await fieldDefService.create('picklist_entity', {
          fieldKey: 'priority',
          label: 'Priority',
          fieldType: 'picklist',
        });

        await fieldDefService.setPicklistOptions('picklist_entity', 'priority', [
          { label: 'High', value: 'high', isDefault: false },
          { label: 'Medium', value: 'medium', isDefault: true },
          { label: 'Low', value: 'low', isDefault: false },
        ]);

        const options = await fieldDefService.getPicklistOptions(field.id);
        expect(options).toHaveLength(3);
        expect(options[0].label).toBe('High');
        expect(options[1].isDefault).toBe(true);
        expect(options[2].value).toBe('low');
      });

      it('should replace picklist options on re-set', async () => {
        await fieldDefService.create('replace_entity', {
          fieldKey: 'status',
          label: 'Status',
          fieldType: 'picklist',
        });

        await fieldDefService.setPicklistOptions('replace_entity', 'status', [
          { label: 'Old', value: 'old' },
        ]);

        await fieldDefService.setPicklistOptions('replace_entity', 'status', [
          { label: 'New A', value: 'a' },
          { label: 'New B', value: 'b' },
        ]);

        const field = await fieldDefService.findByEntityAndKey('replace_entity', 'status');
        const options = await fieldDefService.getPicklistOptions(field!.id);
        expect(options).toHaveLength(2);
        expect(options[0].value).toBe('a');
      });

      it('should reject picklist options on non-picklist fields', async () => {
        await fieldDefService.create('text_entity', {
          fieldKey: 'name',
          label: 'Name',
          fieldType: 'text',
        });

        await expect(
          fieldDefService.setPicklistOptions('text_entity', 'name', [
            { label: 'A', value: 'a' },
          ]),
        ).rejects.toThrow('picklist or multi_select');
      });

      it('should list fields with options attached', async () => {
        await fieldDefService.create('with_opts', {
          fieldKey: 'color',
          label: 'Color',
          fieldType: 'picklist',
        });
        await fieldDefService.create('with_opts', {
          fieldKey: 'name',
          label: 'Name',
          fieldType: 'text',
        });

        await fieldDefService.setPicklistOptions('with_opts', 'color', [
          { label: 'Red', value: 'red' },
          { label: 'Blue', value: 'blue' },
        ]);

        const fields = await fieldDefService.listByEntityWithOptions('with_opts');
        expect(fields).toHaveLength(2);

        const colorField = fields.find(f => f.fieldKey === 'color')!;
        expect(colorField.picklistOptions).toHaveLength(2);

        const nameField = fields.find(f => f.fieldKey === 'name')!;
        expect(nameField.picklistOptions).toHaveLength(0);
      });
    });

    describe('registerStandardFields', () => {
      it('should idempotently register standard fields', async () => {
        const fields = [
          { fieldKey: 'firstName', label: 'First Name', fieldType: 'text' as const, columnName: 'first_name' },
          { fieldKey: 'email', label: 'Email', fieldType: 'email' as const, columnName: 'email' },
        ];

        await fieldDefService.registerStandardFields('register_entity', fields);
        const first = await fieldDefService.listByEntity('register_entity');
        expect(first).toHaveLength(2);

        // Re-register with label change
        fields[0].label = 'Given Name';
        await fieldDefService.registerStandardFields('register_entity', fields);
        const second = await fieldDefService.listByEntity('register_entity');
        expect(second).toHaveLength(2);
        expect(second[0].label).toBe('Given Name');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // EntityRegistryService
  // ---------------------------------------------------------------------------

  describe('EntityRegistryService', () => {
    it('should register and retrieve entity configs', () => {
      const config = {
        entityType: 'test_type',
        singularName: 'Test',
        pluralName: 'Tests',
        slug: 'tests',
        table: {} as any,
        fieldMeta: {},
        sections: [],
      };

      entityRegistry.register(config);

      expect(entityRegistry.get('test_type')).toBeDefined();
      expect(entityRegistry.get('test_type')!.singularName).toBe('Test');
      expect(entityRegistry.getBySlug('tests')).toBeDefined();
      expect(entityRegistry.size).toBeGreaterThanOrEqual(1);
    });

    it('should return undefined for unregistered types', () => {
      expect(entityRegistry.get('nonexistent')).toBeUndefined();
      expect(entityRegistry.getBySlug('nonexistent')).toBeUndefined();
    });

    it('should throw on duplicate registration', () => {
      const config = {
        entityType: 'dup_type',
        singularName: 'Dup',
        pluralName: 'Dups',
        slug: 'dups',
        table: {} as any,
        fieldMeta: {},
        sections: [],
      };

      entityRegistry.register(config);
      expect(() => entityRegistry.register(config)).toThrow();
    });

    it('should list all registered entries', () => {
      const config = {
        entityType: 'list_type',
        singularName: 'ListItem',
        pluralName: 'ListItems',
        slug: 'list-items',
        table: {} as any,
        fieldMeta: {},
        sections: [],
        ui: { boardFields: [] },
      };

      entityRegistry.register(config);
      const entries = entityRegistry.getRegistryEntries();
      expect(entries.some(e => e.entityType === 'list_type')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // FieldTypeSaveHookRegistry
  // ---------------------------------------------------------------------------

  describe('FieldTypeSaveHookRegistry', () => {
    let hookRegistry: FieldTypeSaveHookRegistry;

    beforeAll(() => {
      hookRegistry = new FieldTypeSaveHookRegistry();
    });

    it('should register and retrieve hooks', () => {
      const hooks = {
        onBeforeSave: async () => ({}),
      };

      hookRegistry.register('test_type', hooks);
      expect(hookRegistry.has('test_type')).toBe(true);
      expect(hookRegistry.get('test_type')).toBe(hooks);
    });

    it('should return undefined for unregistered types', () => {
      expect(hookRegistry.has('unknown')).toBe(false);
      expect(hookRegistry.get('unknown')).toBeUndefined();
    });

    it('should throw on duplicate registration', () => {
      hookRegistry.register('dup_type', { onBeforeSave: async () => ({}) });
      expect(() =>
        hookRegistry.register('dup_type', { onBeforeSave: async () => ({}) }),
      ).toThrow();
    });
  });
});
