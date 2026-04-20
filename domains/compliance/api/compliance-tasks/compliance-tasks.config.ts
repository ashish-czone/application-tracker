import { defineEntity } from '@packages/entity-engine';
import { complianceTasks } from '../schema/compliance-tasks';

/**
 * compliance_tasks is a shared-key extension of @packages/tasks. The child
 * row keys off the parent task's id (task_id IS the PK-also-FK) and carries
 * the (rule, client, law, period) tuple that makes a task a compliance
 * obligation. The entity-engine write path creates/updates/soft-deletes
 * both tables atomically once this config is registered.
 *
 * Domain-specific bits (idempotency lookups by rule+client+period, the
 * automation that generates a 6-month horizon of tasks, the
 * COMPLIANCE_TASK_GENERATED event) live in the compliance module and sit
 * on top of the entity-engine layer — they do not bypass it.
 */
export const COMPLIANCE_TASKS_CONFIG = defineEntity({
  table: complianceTasks,
  slug: 'compliance-tasks',
  singularName: 'Compliance Task',
  pluralName: 'Compliance Tasks',
  onDelete: { mode: 'soft' },
  timestamps: true,

  extensionOf: {
    entity: 'tasks',
    foreignKey: 'taskId',
    parentDefaults: { kind: 'compliance' },
  },

  fields: {
    ruleId: {
      type: 'belongsTo',
      label: 'Rule',
      entity: 'compliance-rules',
      required: true,
      searchable: true,
      listVisible: true,
      listOrder: 1,
    },
    clientId: {
      type: 'belongsTo',
      label: 'Client',
      entity: 'clients',
      required: true,
      searchable: true,
      listVisible: true,
      listOrder: 2,
    },
    lawId: {
      type: 'belongsTo',
      label: 'Law',
      entity: 'laws',
      required: true,
      listVisible: true,
      listOrder: 3,
    },
    periodStart: {
      type: 'date',
      label: 'Period Start',
      required: true,
      sortable: true,
      listVisible: true,
      listOrder: 4,
    },
    periodEnd: {
      type: 'date',
      label: 'Period End',
      required: true,
      listVisible: true,
      listOrder: 5,
    },
  },

  defaultSort: 'periodStart',

  ui: {
    icon: 'ClipboardCheck',
    navGroup: 'compliance',
    navOrder: 4,
  },
});
