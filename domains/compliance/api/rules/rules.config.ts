import { defineEntity } from '@packages/entity-engine';
import { complianceRules } from '../schema/rules';

export const COMPLIANCE_RULES_CONFIG = defineEntity({
  table: complianceRules,
  slug: 'compliance_rules',
  singularName: 'Compliance Rule',
  pluralName: 'Compliance Rules',
  softDelete: false,
  timestamps: true,

  fields: {
    name: {
      type: 'text',
      label: 'Name',
      required: true,
      searchable: true,
      sortable: true,
      isLabel: true,
      listVisible: true,
      listOrder: 1,
    },
    lawId: {
      type: 'belongsTo',
      label: 'Law',
      entity: 'laws',
      required: true,
      lookupLabelField: 'name',
      lookupSearchFields: ['name', 'code'],
      listVisible: true,
      listOrder: 2,
    },
    frequency: {
      type: 'picklist',
      label: 'Frequency',
      required: true,
      options: [
        { label: 'Monthly', value: 'monthly' },
        { label: 'Quarterly', value: 'quarterly' },
        { label: 'Half-Yearly', value: 'half_yearly' },
        { label: 'Yearly', value: 'yearly' },
      ],
      listVisible: true,
      listOrder: 3,
    },
    dueDayOfMonth: {
      type: 'number',
      label: 'Due Day of Month',
      required: true,
    },
    dueMonthOffset: {
      type: 'number',
      label: 'Due Month Offset',
      required: true,
      defaultValue: '0',
    },
    gracePeriodDays: {
      type: 'number',
      label: 'Grace Period (days)',
      required: true,
      defaultValue: '0',
    },
    description: {
      type: 'textarea',
      label: 'Description',
      maxLength: 32000,
    },
    active: {
      type: 'boolean',
      label: 'Active',
      defaultValue: 'true',
      listVisible: true,
      listOrder: 4,
    },
  },

  defaultSort: 'name',

  sections: [
    {
      name: 'Rule',
      fields: ['name', 'lawId', 'frequency', 'dueDayOfMonth', 'dueMonthOffset', 'gracePeriodDays', 'description', 'active'],
    },
  ],

  ui: {
    icon: 'Calendar',
    navGroup: 'compliance',
    navOrder: 3,
    createMode: 'modal',
  },
});
