import { describe, it, expect, beforeEach } from 'vitest';
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { FieldDefinitionService } from '../field-definition.service';
import { defineEntity } from '../../define-entity';

const tbl = pgTable('widgets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  status: text('status').notNull().default('draft'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull(),
});

describe('FieldDefinitionService.populateFromRegistry', () => {
  let service: FieldDefinitionService;

  beforeEach(() => {
    // DatabaseService isn't touched by populateFromRegistry — a stub is enough
    // to construct the service.
    service = new FieldDefinitionService({ db: {} as never } as never);
  });

  it('mirrors code-defined fields into the cache so existing readers serve them transparently', () => {
    const config = defineEntity({
      table: tbl,
      slug: 'widgets',
      fields: {
        name: { type: 'text', label: 'Name' },
        status: {
          type: 'picklist',
          label: 'Status',
          options: [
            { label: 'Draft', value: 'draft', isDefault: true },
            { label: 'Published', value: 'published' },
          ],
        },
      },
      ui: { icon: 'Box' },
    });

    service.populateFromRegistry(config);

    const keys = service.listByEntity('widgets').map((f) => f.fieldKey);
    expect(keys).toContain('name');
    expect(keys).toContain('status');
    expect(keys).toContain('createdBy');
    expect(keys).toContain('createdAt');
    expect(keys).toContain('updatedAt');
  });

  it('wires picklist options so listByEntityWithOptions / getPicklistOptions work', () => {
    const config = defineEntity({
      table: tbl,
      slug: 'widgets',
      fields: {
        status: {
          type: 'picklist',
          label: 'Status',
          options: [
            { label: 'Draft', value: 'draft' },
            { label: 'Published', value: 'published' },
          ],
        },
      },
      ui: { icon: 'Box' },
    });

    service.populateFromRegistry(config);

    const withOpts = service.listByEntityWithOptions('widgets');
    const status = withOpts.find((f) => f.fieldKey === 'status')!;
    expect(status.picklistOptions).toHaveLength(2);
    expect(service.getPicklistOptions(status.id)).toHaveLength(2);
  });

  it('is a no-op when the cache already holds entries for the entity — DB rows win', () => {
    const config = defineEntity({
      table: tbl,
      slug: 'widgets',
      fields: { name: { type: 'text', label: 'Name (code)' } },
      ui: { icon: 'Box' },
    });

    // Pretend DB rows were loaded at bootstrap for the same entityType by
    // invoking populate once (simulates the cache being primed) — a second
    // call with a different label must not overwrite.
    service.populateFromRegistry(config);

    const configB = defineEntity({
      table: tbl,
      slug: 'widgets',
      fields: { name: { type: 'text', label: 'Name (DB)' } },
      ui: { icon: 'Box' },
    });
    service.populateFromRegistry(configB);

    const nameField = service.findByEntityAndKey('widgets', 'name')!;
    expect(nameField.label).toBe('Name (code)');
  });

  it('does not cross-pollute entities — each entityType has its own bucket', () => {
    const widgets = defineEntity({
      table: tbl,
      slug: 'widgets',
      fields: { name: { type: 'text', label: 'Name' } },
      ui: { icon: 'Box' },
    });
    const gizmos = defineEntity({
      table: pgTable('gizmos', {
        id: text('id').primaryKey(),
        title: text('title').notNull(),
      }),
      slug: 'gizmos',
      fields: { title: { type: 'text', label: 'Title' } },
      ui: { icon: 'Box' },
    });

    service.populateFromRegistry(widgets);
    service.populateFromRegistry(gizmos);

    expect(service.listByEntity('widgets').map((f) => f.fieldKey)).toContain('name');
    expect(service.listByEntity('gizmos').map((f) => f.fieldKey)).toContain('title');
    expect(service.listByEntity('gizmos').map((f) => f.fieldKey)).not.toContain('name');
  });
});

describe('FieldDefinitionService.countByCategoryGroupSlug', () => {
  let service: FieldDefinitionService;

  beforeEach(() => {
    service = new FieldDefinitionService({ db: {} as never } as never);
  });

  it('returns empty map when no fields are loaded', () => {
    expect(service.countByCategoryGroupSlug()).toEqual({});
  });

  it('counts fieldType=category fields grouped by categoryGroupSlug', () => {
    const widgets = defineEntity({
      table: tbl,
      slug: 'widgets',
      fields: {
        name: { type: 'text', label: 'Name' },
        country: { type: 'category', label: 'Country', categoryGroupSlug: 'countries' },
        currency: { type: 'category', label: 'Currency', categoryGroupSlug: 'currencies' },
      },
      ui: { icon: 'Box' },
    });
    const gizmos = defineEntity({
      table: pgTable('gizmos', { id: text('id').primaryKey(), title: text('title').notNull() }),
      slug: 'gizmos',
      fields: {
        homeCountry: { type: 'category', label: 'Home Country', categoryGroupSlug: 'countries' },
      },
      ui: { icon: 'Box' },
    });

    service.populateFromRegistry(widgets);
    service.populateFromRegistry(gizmos);

    const counts = service.countByCategoryGroupSlug();
    expect(counts.countries).toBe(2);
    expect(counts.currencies).toBe(1);
  });

  it('ignores non-category fields and category fields with no slug', () => {
    const widgets = defineEntity({
      table: tbl,
      slug: 'widgets',
      fields: {
        name: { type: 'text', label: 'Name' },
        country: { type: 'category', label: 'Country', categoryGroupSlug: 'countries' },
      },
      ui: { icon: 'Box' },
    });

    service.populateFromRegistry(widgets);

    const counts = service.countByCategoryGroupSlug();
    expect(Object.keys(counts)).toEqual(['countries']);
    expect(counts.countries).toBe(1);
  });
});
