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

});
