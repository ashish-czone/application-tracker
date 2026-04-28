import { defineEntity } from '@packages/entity-engine';
import { caseStudies } from './schema/case-studies';

export const CASE_STUDIES_CONFIG = defineEntity({
  table: caseStudies,
  slug: 'case-studies',
  singularName: 'Case Study',
  pluralName: 'Case Studies',
  timestamps: true,
  adminConfigurable: true,

  fields: {
    title: {
      type: 'text',
      label: 'Title',
      required: true,
      searchable: true,
      sortable: true,
      isLabel: true,
      listVisible: true,
      listOrder: 1,
      quickCreate: true,
    },
    slug: {
      type: 'text',
      label: 'Slug',
      required: true,
      searchable: true,
      listVisible: true,
      listOrder: 2,
      quickCreate: true,
    },
    client: {
      type: 'text',
      label: 'Client',
      required: true,
      searchable: true,
      listVisible: true,
      listOrder: 3,
    },
    industry: {
      type: 'text',
      label: 'Industry',
      searchable: true,
      sortable: true,
      listVisible: true,
      listOrder: 4,
    },
    year: {
      type: 'number',
      label: 'Year',
      sortable: true,
      listVisible: true,
      listOrder: 5,
    },
    summary: {
      type: 'textarea',
      label: 'Summary',
      required: true,
      searchable: true,
    },
    body: {
      type: 'textarea',
      label: 'Body (markdown / plaintext)',
    },
    results: {
      type: 'textarea',
      label: 'Results',
      description: 'One per line: e.g. "Reduced reconciliation time by 87%"',
    },
    heroImageUrl: {
      type: 'url',
      label: 'Hero image URL',
    },
    ctaText: {
      type: 'text',
      label: 'CTA label',
    },
    ctaHref: {
      type: 'url',
      label: 'CTA link',
    },
    displayOrder: {
      type: 'number',
      label: 'Display order',
      sortable: true,
    },
    isActive: {
      type: 'boolean',
      label: 'Active',
      listVisible: true,
      listOrder: 6,
    },
    publishedAt: {
      type: 'datetime',
      label: 'Published at',
    },
  },

  defaultSort: 'displayOrder',
});
