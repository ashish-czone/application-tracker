import { defineEntity } from '@packages/entity-engine';
import { faqItems } from './schema/faq-items';

export const FAQ_ITEMS_CONFIG = defineEntity({
  table: faqItems,
  slug: 'faq-items',
  singularName: 'FAQ Item',
  pluralName: 'FAQ Items',
  timestamps: true,
  adminConfigurable: true,

  fields: {
    question: {
      type: 'text',
      label: 'Question',
      required: true,
      searchable: true,
      sortable: true,
      isLabel: true,
      listVisible: true,
      listOrder: 1,
      quickCreate: true,
    },
    answer: {
      type: 'textarea',
      label: 'Answer',
      required: true,
      searchable: true,
      listVisible: true,
      listOrder: 2,
      quickCreate: true,
    },
    category: {
      type: 'text',
      label: 'Category',
      searchable: true,
      sortable: true,
      listVisible: true,
      listOrder: 3,
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
      listOrder: 4,
    },
  },

  defaultSort: 'displayOrder',
});
