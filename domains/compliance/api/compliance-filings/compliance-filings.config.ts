import { defineEntity } from '@packages/entity-engine';
import { and, isNull, sql } from 'drizzle-orm';
import { orgUnitMembers } from '@packages/org-units';
import { notesFeature } from '@packages/notes';
import { attachmentsFeature } from '@packages/attachments';
import { complianceFilings } from './compliance-filings.schema';
import {
  COMPLIANCE_ATTACHMENT_MIME_TYPES,
  COMPLIANCE_MAX_ATTACHMENT_BYTES,
} from '../constants';

/** Natural key used for the compliance_filings.external_key idempotency column.
 *  The generate action reuses this format across retries — keep the shape stable.
 *
 *  Callers of the HTTP API don't need to supply this directly — the filings
 *  service derives it automatically at create-time when ruleId/clientId/
 *  periodStart are present. Exposed for the automation and seeds which pre-
 *  compute the key to dedupe before insert. */
export function buildFilingExternalKey(ruleId: string, clientId: string, periodStart: string): string {
  return `${ruleId}:${clientId}:${periodStart}`;
}

/**
 * Compliance filings are first-class domain entities — a (rule, client, period)
 * tuple that must be filed to a regulator. They are NOT an extension of the
 * generic tasks addon: tasks is a polymorphic ad-hoc work-item inbox; filings
 * are structured, recurring, auditable, and carry their own multi-reviewer
 * workflow. Keeping them separate means the tasks addon stays fully generic
 * and the filings workflow can evolve without fighting tasks' lifecycle.
 *
 * Workflow (`compliance-filing-status`):
 *   pending → in_progress          (claim — requires compliance-filings.pickup)
 *   in_progress → pending          (release)
 *   in_progress → review           (submit for review)
 *   review → in_progress           (reviewer pulls it back to rework)
 *   review → completed             (approve — terminal, requires compliance-filings.complete)
 *   review → rejected              (reject — reasonRequired + commentRequired)
 *   rejected → in_progress         (preparer reworks)
 *   {pending,in_progress,review,rejected} → cancelled (terminal, requires compliance-filings.close)
 *
 * `completed` and `cancelled` are system terminals — admins cannot rename or
 * delete them because downstream dashboards pivot on the literal values.
 */
export const COMPLIANCE_FILINGS_CONFIG = defineEntity({
  table: complianceFilings,
  slug: 'compliance-filings',
  timestamps: true,

  features: {
    ...attachmentsFeature({
      acceptedMimeTypes: [...COMPLIANCE_ATTACHMENT_MIME_TYPES],
      maxFileSize: COMPLIANCE_MAX_ATTACHMENT_BYTES,
      deleteMode: 'soft',
    }),
    ...notesFeature(),
  },

  // Permissions live in compliance-filings.permissions.ts (CRUD via
  // crudPermissionManifests + 6 extras inline) and are registered via
  // RbacIntegrationModule.forFeature in compliance-filings.module.ts.
  // The supportedScopes mirror what deriveSupportedScopes would produce
  // for this entity (anchors: creator/assignee/team + inline
  // unassigned_in_unit) — see comment header in the permissions file.
  skipAutoRegistration: { permissions: true },

  dataAccess: {
    // Anchors drive the registered scope resolvers:
    //   own        → creator anchor  → createdBy = actor
    //   assigned   → assignee anchor → assigneeId = actor
    //   unit       → team anchor     → assigneeTeamId in actor's units
    //   descendants→ team anchor     → assigneeTeamId in actor's unit subtree
    anchors: {
      creator: 'createdBy',
      assignee: 'assigneeId',
      team: 'assigneeTeamId',
    },
    scopes: [
      {
        // Pickup pool: filings unclaimed (assigneeId IS NULL) in a team the
        // actor belongs to. Used by Preparers/Reviewers whose `pickup` grant
        // is scoped to this key so they can only self-claim from their team
        // pool — never from another team and never steal work already
        // assigned to someone else (even if it's still pending).
        key: 'unassigned_in_unit',
        label: 'Unassigned filings in my teams',
        resolve: (userId: string) => and(
          isNull(complianceFilings.assigneeId),
          sql`${complianceFilings.assigneeTeamId} IN (SELECT ${orgUnitMembers.orgUnitId} FROM ${orgUnitMembers} WHERE ${orgUnitMembers.userId} = ${userId})`,
        )!,
      },
    ],
  },

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
    },
    description: {
      type: 'textarea',
      label: 'Description',
    },
    status: {
      // Plain text from the engine's perspective; the workflow def lives in
      // compliance-filings.workflow.ts and is registered via WorkflowsModule.forFeature.
      type: 'text',
      label: 'Status',
      system: true,
      sortable: true,
      listVisible: true,
      listOrder: 2,
      cellRenderer: 'PipelineProgressRenderer',
    },
    priority: {
      type: 'picklist',
      label: 'Priority',
      sortable: true,
      listVisible: true,
      listOrder: 3,
      defaultValue: 'medium',
      options: [
        { label: 'Low', value: 'low' },
        { label: 'Medium', value: 'medium', isDefault: true },
        { label: 'High', value: 'high' },
        { label: 'Urgent', value: 'urgent' },
      ],
    },
    assigneeId: {
      type: 'user',
      label: 'Assignee',
      listVisible: true,
      listOrder: 4,
      isRecipient: true,
    },
    assigneeTeamId: {
      type: 'lookup',
      label: 'Assigned Team',
      entity: 'org-units',
      lookupLabelField: 'name',
      lookupSearchFields: ['name'],
      listColumnHidden: true,
    },
    dueDate: {
      type: 'date',
      label: 'Due Date',
      sortable: true,
      listVisible: true,
      listOrder: 5,
    },
    completedAt: {
      type: 'datetime',
      label: 'Completed At',
      system: true,
      readonly: true,
      sortable: true,
      excludeFromList: true,
    },
    ruleId: {
      type: 'lookup',
      label: 'Rule',
      entity: 'compliance-rules',
      required: true,
      searchable: true,
      listVisible: true,
      listOrder: 6,
    },
    clientId: {
      type: 'lookup',
      label: 'Client',
      entity: 'clients',
      required: true,
      searchable: true,
      listVisible: true,
      listOrder: 7,
    },
    lawId: {
      type: 'lookup',
      label: 'Law',
      entity: 'laws',
      required: true,
      listVisible: true,
      listOrder: 8,
    },
    periodStart: {
      type: 'date',
      label: 'Period Start',
      required: true,
      sortable: true,
      listVisible: true,
      listOrder: 9,
    },
    periodEnd: {
      type: 'date',
      label: 'Period End',
      required: true,
      listVisible: true,
      listOrder: 10,
    },
    externalKey: {
      type: 'text',
      label: 'External Key',
      system: true,
      readonly: true,
      excludeFromList: true,
    },
    createdBy: {
      type: 'user',
      label: 'Creator',
      system: true,
      readonly: true,
      isRecipient: true,
    },
  },

  relationships: [
    { name: 'rule', type: 'belongsTo', foreignKey: 'ruleId', targetEntity: 'compliance-rules', label: 'Rule' },
    { name: 'client', type: 'belongsTo', foreignKey: 'clientId', targetEntity: 'clients', label: 'Client' },
    { name: 'law', type: 'belongsTo', foreignKey: 'lawId', targetEntity: 'laws', label: 'Law' },
  ],

  defaultSort: 'dueDate',
});
