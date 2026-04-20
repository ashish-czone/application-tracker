import { defineEntity } from '@packages/entity-engine';
import { applyCompletedAt } from '@packages/tasks';
import { complianceTasks } from '../schema/compliance-tasks';

/** Natural key used for the tasks.external_key idempotency column. Mirrors
 *  the format the bespoke service used so existing rows + retries continue
 *  to match after the migration. */
export function buildComplianceExternalKey(ruleId: string, clientId: string, periodStart: string): string {
  return `${ruleId}:${clientId}:${periodStart}`;
}

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

  hooks: {
    // Derive the parent's `external_key` from the (rule, client, period)
    // tuple on every create so the idempotency column stays deterministic
    // under retries. Running in beforeCreate lets the hook mutate the
    // payload before it splits across parent + child inserts.
    beforeCreate: async (payload: Record<string, unknown>) => {
      const ruleId = payload.ruleId as string | undefined;
      const clientId = payload.clientId as string | undefined;
      const periodStart = payload.periodStart as string | undefined;
      const next: Record<string, unknown> = { ...payload };
      if (ruleId && clientId && periodStart && next.externalKey == null) {
        next.externalKey = buildComplianceExternalKey(ruleId, clientId, periodStart);
      }
      return applyCompletedAt(next);
    },
    beforeUpdate: async (_id: string, payload: Record<string, unknown>) => {
      return applyCompletedAt(payload);
    },
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
