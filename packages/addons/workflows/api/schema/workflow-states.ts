import { pgTable, text, integer, timestamp, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { workflowDefinitions } from './workflow-definitions';

export const workflowStates = pgTable('workflow_states', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  workflowDefinitionId: text('workflow_definition_id').notNull().references(() => workflowDefinitions.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  label: text('label').notNull(),
  color: text('color'),
  sortOrder: integer('sort_order').notNull().default(0),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex('workflow_states_definition_name_key').on(table.workflowDefinitionId, table.name),
  index('workflow_states_definition_id_idx').on(table.workflowDefinitionId),
]);
