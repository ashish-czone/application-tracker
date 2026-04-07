import { pgTable, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { workflowDefinitions } from './workflow-definitions';
import { workflowTransitions } from './workflow-transitions';

export const workflowTransitionHistory = pgTable('workflow_transition_history', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  workflowDefinitionId: text('workflow_definition_id').notNull().references(() => workflowDefinitions.id),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  fieldName: text('field_name').notNull(),
  fromState: text('from_state').notNull(),
  toState: text('to_state').notNull(),
  transitionId: text('transition_id').references(() => workflowTransitions.id, { onDelete: 'set null' }),
  actorId: text('actor_id'),
  reason: text('reason'),
  comment: text('comment'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  index('workflow_transition_history_entity_idx').on(table.entityType, table.entityId),
  index('workflow_transition_history_definition_id_idx').on(table.workflowDefinitionId),
  index('workflow_transition_history_actor_id_idx').on(table.actorId),
]);
