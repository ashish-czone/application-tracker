import { defineEntity } from '@packages/entity-engine';
import { testimonials } from './schema/testimonials';

export const TESTIMONIALS_CONFIG = defineEntity({
  table: testimonials,
  slug: 'testimonials',
  singularName: 'Testimonial',
  pluralName: 'Testimonials',
  timestamps: true,
  adminConfigurable: true,

  fields: {
    authorName: {
      type: 'text',
      label: 'Author',
      required: true,
      searchable: true,
      sortable: true,
      isLabel: true,
      listVisible: true,
      listOrder: 1,
      quickCreate: true,
    },
    quote: {
      type: 'textarea',
      label: 'Quote',
      required: true,
      searchable: true,
      listVisible: true,
      listOrder: 2,
      quickCreate: true,
    },
    authorRole: {
      type: 'text',
      label: 'Role',
      searchable: true,
      listVisible: true,
      listOrder: 3,
    },
    companyName: {
      type: 'text',
      label: 'Company',
      searchable: true,
      sortable: true,
      listVisible: true,
      listOrder: 4,
    },
    avatarUrl: {
      type: 'file',
      label: 'Avatar',
      accept: ['image/*'],
    },
    companyLogoUrl: {
      type: 'file',
      label: 'Company Logo',
      accept: ['image/*'],
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
      listOrder: 5,
    },
  },

  defaultSort: 'displayOrder',

  ui: {
    icon: 'MessageSquareQuote',
    navGroup: 'Content',
    groupRenderMode: 'tabs',
    navOrder: 10,
    createMode: 'modal',
  },
});
