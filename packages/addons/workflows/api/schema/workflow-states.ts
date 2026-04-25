import { pgTable, text, integer, timestamp, jsonb, boolean, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { workflowDefinitions } from './workflow-definitions';

export const workflowStates = pgTable('workflow_states', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  workflowDefinitionId: text('workflow_definition_id').notNull().references(() => workflowDefinitions.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  label: text('label').notNull(),
  color: text('color'),
  sortOrder: integer('sort_order').notNull().default(0),
  /**
   * Code-load-bearing states: domain logic branches on these state names.
   * Admin UIs must block rename/delete on these states. Set via
   * `WorkflowStateDef.isSystem` on the entity config; admins can still add or
   * reorder non-system states around them.
   */
  isSystem: boolean('is_system').notNull().default(false),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex('workflow_states_definition_name_key').on(table.workflowDefinitionId, table.name),
  index('workflow_states_definition_id_idx').on(table.workflowDefinitionId),
]);
