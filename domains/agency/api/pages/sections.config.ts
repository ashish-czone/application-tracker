import { defineEntity } from '@packages/entity-engine';
import { sections } from './schema/sections';

/**
 * Sections are rendered instances of registered blocks. `blockKind` selects
 * which `defineBlock({ kind })` entry renders the section, and `variant`
 * selects a visual variant within that block. Per-block field values live in
 * the `customFields` JSONB column — the schema for those values is owned by
 * the block registry (code), not by the admin layout.
 *
 * Sections are authored inside the Page editor (Puck canvas), never as a
 * standalone list — hidden from sidebar nav.
 */
export const SECTIONS_CONFIG = defineEntity({
  table: sections,
  slug: 'sections',
  singularName: 'Section',
  pluralName: 'Sections',
  timestamps: true,
  customFields: true,

  fields: {
    pageId: {
      type: 'lookup',
      label: 'Page',
      required: true,
      entity: 'pages',
      lookupLabelField: 'title',
    },
    order: {
      type: 'number',
      label: 'Order',
      required: true,
      sortable: true,
    },
    blockKind: {
      type: 'text',
      label: 'Block Kind',
      required: true,
      system: true,
    },
    variant: {
      type: 'text',
      label: 'Variant',
      system: true,
    },
    title: {
      type: 'text',
      label: 'Heading',
    },
    dataSource: {
      type: 'data_source',
      label: 'Data Source',
      system: true,
    },
  },

  defaultSort: 'order',
});
