import { randomUUID } from 'node:crypto';
import { pgTable, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { evaluationTemplates } from './evaluation-templates';

export const evaluations = pgTable('evaluations', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  templateId: text('template_id').notNull().references(() => evaluationTemplates.id),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  evaluatorId: text('evaluator_id').notNull(),
  overallRating: integer('overall_rating').notNull(),
  recommendation: text('recommendation'),
  comment: text('comment'),
  submittedAt: timestamp('submitted_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table) => [
  index('evaluations_entity_lookup_idx').on(table.entityType, table.entityId),
  index('evaluations_template_id_idx').on(table.templateId),
  index('evaluations_evaluator_id_idx').on(table.evaluatorId),
]);
