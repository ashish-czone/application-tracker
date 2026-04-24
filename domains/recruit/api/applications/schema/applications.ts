import { pgTable, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

export const applications = pgTable('applications', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  // Relationships
  candidateId: text('candidate_id').notNull(),
  jobOpeningId: text('job_opening_id').notNull(),
  // Core
  stage: text('stage').default('new'),
  source: text('source'),
  referredBy: text('referred_by'),
  notes: text('notes'),
  // Audit
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  deletedBy: text('deleted_by'),
}, (table) => [
  index('applications_candidate_id_idx').on(table.candidateId),
  index('applications_job_opening_id_idx').on(table.jobOpeningId),
  index('applications_stage_idx').on(table.stage),
  uniqueIndex('applications_candidate_job_unique_idx').on(table.candidateId, table.jobOpeningId),
]);
