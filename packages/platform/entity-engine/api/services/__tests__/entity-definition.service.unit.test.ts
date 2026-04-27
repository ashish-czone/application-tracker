import { describe, it, expect, beforeEach } from 'vitest';
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { EntityRegistryService } from '../../entity-registry.service';
import { FeatureDeriverRegistry } from '../feature-deriver.registry';
import { EntityDefinitionService } from '../entity-definition.service';
import { defineEntity } from '../../define-entity';

const tbl = pgTable('things', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull(),
});

describe('EntityDefinitionService', () => {
  let registry: EntityRegistryService;
  let service: EntityDefinitionService;

  beforeEach(() => {
    registry = new EntityRegistryService(new FeatureDeriverRegistry());
    service = new EntityDefinitionService(registry);
  });

  describe('isAdminConfigurable', () => {
    it('returns false for entities that did not opt in', () => {
      registry.register(defineEntity({
        table: tbl,
        slug: 'things',
        fields: { name: { type: 'text', label: 'Name' } },
      }));
      expect(service.isAdminConfigurable('things')).toBe(false);
    });

    it('returns true for entities that opted in', () => {
      registry.register(defineEntity({
        table: tbl,
        slug: 'things',
        adminConfigurable: true,
        fields: { name: { type: 'text', label: 'Name' } },
      }));
      expect(service.isAdminConfigurable('things')).toBe(true);
    });

    it('returns false for unregistered entities', () => {
      expect(service.isAdminConfigurable('unknown')).toBe(false);
    });
  });

  describe('resolveFieldsFromRegistry', () => {
    it('returns the in-memory field set for a registered entity', () => {
      registry.register(defineEntity({
        table: tbl,
        slug: 'things',
        fields: { name: { type: 'text', label: 'Name', isLabel: true } },
      }));
      const fields = service.resolveFieldsFromRegistry('things');
      const keys = fields.map((f) => f.fieldKey);
      expect(keys).toContain('name');
      expect(keys).toContain('createdBy');
      expect(keys).toContain('createdAt');
      expect(keys).toContain('updatedAt');
    });

    it('returns [] for an unregistered entity', () => {
      expect(service.resolveFieldsFromRegistry('unknown')).toEqual([]);
    });
  });

  describe('resolveLayoutFromRegistry', () => {
    it('returns a FullLayout built from the code-defined config', () => {
      registry.register(defineEntity({
        table: tbl,
        slug: 'things',
        fields: { name: { type: 'text', label: 'Name', quickCreate: true } },
        sections: [{ name: 'Basics', columns: 1, fields: ['name'] }],
      }));
      const layout = service.resolveLayoutFromRegistry('things');
      expect(layout.entityType).toBe('things');
      expect(layout.layoutName).toBe('Standard');
      expect(layout.sections.find((s) => s.name === 'Basics')).toBeDefined();
      expect(layout.quickCreateFields.map((f) => f.fieldKey)).toEqual(['name']);
    });

    it('returns an empty layout for an unregistered entity', () => {
      const layout = service.resolveLayoutFromRegistry('unknown');
      expect(layout).toEqual({
        entityType: 'unknown',
        layoutName: 'Standard',
        sections: [],
        relationSections: [],
        quickCreateFields: [],
      });
    });

    it('honours a custom layout name', () => {
      registry.register(defineEntity({
        table: tbl,
        slug: 'things',
        fields: { name: { type: 'text', label: 'Name' } },
      }));
      const layout = service.resolveLayoutFromRegistry('things', 'Mobile');
      expect(layout.layoutName).toBe('Mobile');
    });
  });

  describe('extensionOf resolution', () => {
    const parentTbl = pgTable('parent-tasks', {
      id: text('id').primaryKey(),
      title: text('title').notNull(),
      status: text('status').notNull().default('open'),
      createdBy: text('created_by').notNull(),
      createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
      updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull(),
    });

    const childTbl = pgTable('compliance-tasks', {
      id: text('id').primaryKey(),
      ruleId: text('rule_id'),
    });

    function registerParentAndChild() {
      registry.register(defineEntity({
        table: parentTbl,
        slug: 'parent-tasks',
        fields: {
          title: { type: 'text', label: 'Title' },
          status: { type: 'text', label: 'Status' },
        },
        extensionColumns: ['title', 'status'],
      }));
      registry.register(defineEntity({
        table: childTbl,
        slug: 'compliance-tasks',
        fields: { ruleId: { type: 'text', label: 'Rule' } },
        extensionOf: { entity: 'parent-tasks', foreignKey: 'id' },
      }));
      registry.finalize();
    }

    it('merges parent projected fields into resolveFieldsFromRegistry', () => {
      registerParentAndChild();
      const fields = service.resolveFieldsFromRegistry('compliance-tasks');
      const keys = fields.map((f) => f.fieldKey);
      expect(keys).toContain('ruleId');
      expect(keys).toContain('title');
      expect(keys).toContain('status');
    });

    it('exposes parent projected fields via resolveLayoutFromRegistry', () => {
      registerParentAndChild();
      const layout = service.resolveLayoutFromRegistry('compliance-tasks');
      const unassigned = layout.sections.find((s) => s.name === 'Unassigned Fields')!;
      expect(unassigned).toBeDefined();
      const keys = unassigned.fields.map((f) => f.fieldKey);
      expect(keys).toEqual(expect.arrayContaining(['ruleId', 'title', 'status']));
    });

    it('does not merge anything for non-extension entities', () => {
      registry.register(defineEntity({
        table: tbl,
        slug: 'things',
        fields: { name: { type: 'text', label: 'Name' } },
      }));
      registry.finalize();
      const fields = service.resolveFieldsFromRegistry('things');
      const keys = fields.map((f) => f.fieldKey);
      expect(keys).toEqual(expect.arrayContaining(['name', 'createdBy', 'createdAt', 'updatedAt']));
    });
  });
});
