import { defineEntity } from '@packages/entity-engine';
import { complianceRules } from '../schema/rules';

/**
 * Late-bound update guard (I14). `COMPLIANCE_RULES_CONFIG` is evaluated at
 * module-load time — before Nest can DI the service in — so the hook
 * reaches through this indirection, identical to the pattern used by
 * `setClientDormancyHandler` in clients.config.ts. Wired in
 * `ComplianceDomainModule.onModuleInit` via `setRuleUpdateGuard()`.
 *
 * Leaving the guard unset is fine: the hook short-circuits to a pass-through,
 * matching platform pre-I14 behaviour. This keeps unit tests on the config
 * trivial and lets other apps that import the config run without the guard
 * wired, if they ever want to.
 */
export interface RuleUpdateGuard {
  assertUpdateAllowed(id: string, payload: Record<string, unknown>): Promise<void>;
}
let ruleUpdateGuardRef: RuleUpdateGuard | null = null;
export function setRuleUpdateGuard(g: RuleUpdateGuard): void {
  ruleUpdateGuardRef = g;
}

export const COMPLIANCE_RULES_CONFIG = defineEntity({
  table: complianceRules,
  slug: 'compliance_rules',
  singularName: 'Compliance Rule',
  pluralName: 'Compliance Rules',
  onDelete: { mode: 'hard' },
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
          { name: 'draft', label: 'Draft', color: '#6B7280' },
          { name: 'active', label: 'Active', color: '#10B981' },
          { name: 'deprecated', label: 'Deprecated', color: '#9CA3AF' },
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

  ui: {
    icon: 'Calendar',
    navGroup: 'compliance',
    navOrder: 3,
    createMode: 'modal',
  },

  hooks: {
    // I14: block identity-field edits once filings have been generated.
    // Returns the payload unchanged on pass-through; throws
    // `ImmutableRuleFieldError` (400) when the guard fires.
    beforeUpdate: async (id, payload) => {
      if (ruleUpdateGuardRef) {
        await ruleUpdateGuardRef.assertUpdateAllowed(id, payload);
      }
      return payload;
    },
  },
});
