import { defineEntity } from '@packages/entity-engine';
import { complianceRules } from './rules.schema';

/**
 * Entity-engine config for compliance-rules.
 *
 * The status workflow is declared separately in `rules.workflow.ts` via
 * `defineWorkflow()` and registered through `WorkflowsModule.forFeature()`
 * in `rules.module.ts` — that's the camp-B path. The `status` field below
 * is a plain `text` column from the engine's perspective; runtime workflow
 * resolution happens via `WorkflowRegistryService.getByEntityField()`
 * (compliance-rules + status), not via field metadata.
 *
 * `extraPermissions` (`deprecate`) still flows through entity-engine's
 * auto-registration in this PR — permission decoupling is a follow-up
 * sprint. CRUD perms (read/create/update/delete) likewise.
 */
export const RULES_ENTITY = defineEntity({
  table: complianceRules,
  slug: 'compliance-rules',
  timestamps: true,

  extraPermissions: [
    {
      action: 'deprecate',
      description:
        'Deprecate a compliance rule and (optionally) cancel every in-flight filing generated from it. Required for both directions of the destructive `* ↔ deprecated` transition; reuse the same perm for reactivation so admins who can retire a rule can reverse it.',
    },
  ],

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
      // Plain text from the engine's perspective; the workflow def lives in
      // rules.workflow.ts and is registered via WorkflowsModule.forFeature.
      type: 'text',
      label: 'Status',
      system: true,
      listVisible: true,
      listOrder: 5,
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
