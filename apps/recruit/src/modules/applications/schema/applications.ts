import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { users } from '@packages/database/schema';

export const applications = pgTable('applications', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  // Relationships
  candidateId: text('candidate_id').notNull(),
  jobOpeningId: text('job_opening_id').notNull(),
  // Core
  status: text('status').default('applied'),
  stage: text('stage').default('new'),
  notes: text('notes'),
  // Audit
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  deletedBy: text('deleted_by'),
}, (table) => [
  index('applications_candidate_id_idx').on(table.candidateId),
  index('applications_job_opening_id_idx').on(table.jobOpeningId),
  index('applications_status_idx').on(table.status),
]);
