import { defineEntity } from '@packages/entity-engine';
import { complianceRules } from '../schema/rules';

export const COMPLIANCE_RULES_CONFIG = defineEntity({
  table: complianceRules,
  slug: 'compliance-rules',
  singularName: 'Compliance Rule',
  pluralName: 'Compliance Rules',
  timestamps: true,

  fields: {
    code: {
      type: 'text',
      label: 'Code',
      required: true,
      unique: true,
      searchable: true,
      sortable: true,
      listVisible: true,
      listOrder: 1,
    },
    name: {
      type: 'text',
      label: 'Name',
      required: true,
      searchable: true,
      sortable: true,
      isLabel: true,
      listVisible: true,
      listOrder: 2,
    },
    lawId: {
      type: 'lookup',
      label: 'Law',
      entity: 'laws',
      required: true,
      lookupLabelField: 'name',
      lookupSearchFields: ['name', 'code'],
      listVisible: true,
      listOrder: 3,
    },
    frequency: {
      type: 'text',
      label: 'Frequency',
      required: true,
      listVisible: true,
      listOrder: 4,
    },
    status: {
      type: 'workflow',
      label: 'Status',
      system: true,
      listVisible: true,
      listOrder: 5,
      workflow: {
        slug: 'compliance-rule-status',
        initialState: 'draft',
        states: [
          // All three names are code-load-bearing: ComplianceRuleStatus is a
          // TS literal union, and ComplianceRulesService branches on
          // 'deprecated' (cascade) and the 'active' default. Lock the
          // identifiers in the admin UI.
          { name: 'draft', label: 'Draft', color: '#6B7280', isSystem: true },
          { name: 'active', label: 'Active', color: '#10B981', isSystem: true },
          { name: 'deprecated', label: 'Deprecated', color: '#9CA3AF', isSystem: true },
        ],
        transitions: [
          { from: 'draft', to: ['active', 'deprecated'] },
          { from: 'active', to: ['deprecated'] },
          { from: 'deprecated', to: ['active'] },
        ],
      },
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
  },

  relationships: [
    { name: 'law', type: 'belongsTo', foreignKey: 'lawId', targetEntity: 'laws', label: 'Law' },
  ],

  defaultSort: 'code',

  sections: [
    {
      name: 'Rule',
      fields: ['code', 'name', 'lawId', 'frequency', 'status', 'dueDayOfMonth', 'dueMonthOffset', 'gracePeriodDays', 'description'],
    },
  ],
});
