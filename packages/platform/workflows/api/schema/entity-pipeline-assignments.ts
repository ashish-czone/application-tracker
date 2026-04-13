import { pgTable, text, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { workflowDefinitions } from './workflow-definitions';

/**
 * Tracks which pipeline (workflow definition) is assigned to a specific entity record.
 * Only populated for entities with multi-pipeline discriminators.
 * Entities with a single pipeline don't need an assignment row.
 */
export const entityPipelineAssignments = pgTable('entity_pipeline_assignments', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  fieldName: text('field_name').notNull(),
  workflowDefinitionId: text('workflow_definition_id').notNull().references(() => workflowDefinitions.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('entity_pipeline_assignments_entity_field_key')
    .on(table.entityType, table.entityId, table.fieldName),
  index('entity_pipeline_assignments_entity_idx')
    .on(table.entityType, table.entityId),
]);
