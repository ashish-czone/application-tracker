import { randomUUID } from 'node:crypto';
import { pgTable, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { evaluations } from './evaluations';

export const evaluationScores = pgTable('evaluation_scores', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  evaluationId: text('evaluation_id').notNull().references(() => evaluations.id, { onDelete: 'cascade' }),
  criteriaName: text('criteria_name').notNull(),
  score: integer('score').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  index('evaluation_scores_evaluation_id_idx').on(table.evaluationId),
]);
