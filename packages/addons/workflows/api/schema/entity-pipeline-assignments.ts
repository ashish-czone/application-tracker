import { pgTable, text, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

/**
 * Tracks which pipeline (workflow definition) is assigned to a specific
 * entity record. Only populated for entities with multi-pipeline
 * discriminators; single-pipeline entities don't need an assignment row.
 *
 * `workflowDefinitionId` is plain text — no FK to `workflow_definitions.id`
 * because code-defined workflows (registered via
 * `WorkflowsModule.forFeature(...)`) use `code:<slug>` ids that have no
 * corresponding DB row. See `.claude/rules/init-vs-seed.md`.
 */
export const entityPipelineAssignments = pgTable('entity_pipeline_assignments', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  fieldName: text('field_name').notNull(),
  workflowDefinitionId: text('workflow_definition_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('entity_pipeline_assignments_entity_field_key')
    .on(table.entityType, table.entityId, table.fieldName),
  index('entity_pipeline_assignments_entity_idx')
    .on(table.entityType, table.entityId),
]);
