import { defineEntity } from '@packages/entity-engine';
import { services } from './schema/services';

export const SERVICES_CONFIG = defineEntity({
  table: services,
  slug: 'services',
  singularName: 'Service',
  pluralName: 'Services',
  onDelete: { mode: 'soft' },
  timestamps: true,
  adminConfigurable: true,

  fields: {
    name: {
      type: 'text',
      label: 'Service Name',
      required: true,
      searchable: true,
      sortable: true,
      isLabel: true,
      listVisible: true,
      listOrder: 1,
      quickCreate: true,
    },
    description: {
      type: 'textarea',
      label: 'Description',
      required: true,
      searchable: true,
      listVisible: true,
      listOrder: 2,
      quickCreate: true,
    },
    iconName: {
      type: 'text',
      label: 'Icon Name',
    },
    ctaText: {
      type: 'text',
      label: 'CTA Label',
    },
    ctaHref: {
      type: 'url',
      label: 'CTA Link',
    },
    displayOrder: {
      type: 'number',
      label: 'Display Order',
      sortable: true,
    },
    isActive: {
      type: 'boolean',
      label: 'Active',
      listVisible: true,
      listOrder: 3,
    },
  },

  defaultSort: 'displayOrder',

  ui: {
    icon: 'Briefcase',
    navGroup: 'Content',
    navOrder: 40,
    createMode: 'modal',
  },
});
