import { pgTable, text, integer, timestamp, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { workflowDefinitions } from './workflow-definitions';
import { workflowStates } from './workflow-states';

export const workflowTransitions = pgTable('workflow_transitions', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  workflowDefinitionId: text('workflow_definition_id').notNull().references(() => workflowDefinitions.id, { onDelete: 'cascade' }),
  fromStateId: text('from_state_id').notNull().references(() => workflowStates.id, { onDelete: 'cascade' }),
  toStateId: text('to_state_id').notNull().references(() => workflowStates.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  requiredPermissions: jsonb('required_permissions'),
  guardNames: jsonb('guard_names'),
  sortOrder: integer('sort_order').notNull().default(0),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex('workflow_transitions_definition_from_to_key').on(table.workflowDefinitionId, table.fromStateId, table.toStateId),
  index('workflow_transitions_definition_id_idx').on(table.workflowDefinitionId),
]);
