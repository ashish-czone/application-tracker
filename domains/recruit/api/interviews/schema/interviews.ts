import { pgTable, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

export const interviews = pgTable('interviews', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  // Interview Information
  interviewName: text('interview_name').notNull(),
  interviewType: text('interview_type'),
  round: integer('round'),
  candidateId: text('candidate_id').notNull(),
  clientId: text('company_id'),
  jobOpeningId: text('job_opening_id').notNull(),
  interviewFrom: timestamp('interview_from', { withTimezone: true, mode: 'string' }).notNull(),
  interviewTo: timestamp('interview_to', { withTimezone: true, mode: 'string' }).notNull(),
  location: text('location'),
  videoLink: text('video_link'),
  duration: integer('duration'),
  scheduleComments: text('schedule_comments'),
  status: text('status').default('scheduled'),
  // Audit
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  deletedBy: text('deleted_by'),
}, (table) => [
  index('interviews_candidate_id_idx').on(table.candidateId),
  index('interviews_job_opening_id_idx').on(table.jobOpeningId),
  index('interviews_company_id_idx').on(table.clientId),
  index('interviews_status_idx').on(table.status),
  index('interviews_interview_from_idx').on(table.interviewFrom),
  index('interviews_created_by_idx').on(table.createdBy),
]);
