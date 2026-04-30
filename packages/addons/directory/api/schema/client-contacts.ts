import { randomUUID } from 'node:crypto';
import { pgTable, text, boolean, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { clients } from './clients';

// Base columns for the shared identity table `client_contacts`. Exported so
// that domains can spread them into an extended `pgTable('people', { ... })`
// reference and add their own prefixed columns. See
// .claude/rules/module-boundaries.md → "Shared Identity Tables".
//
// NOTE: the underlying DB table is still named `people` — the JS-side rename
// to `client_contacts` ships ahead of the table rename, which is deferred to
// a follow-up coordinated migration.
export const baseClientContactColumns = {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  fullName: text('full_name').notNull(),
  primaryEmail: text('primary_email'),
  primaryPhone: text('primary_phone'),
  linkedinUrl: text('linkedin_url'),
  jobTitle: text('job_title'),
  clientId: text('company_id').references(() => clients.id, { onDelete: 'set null' }),
  doNotContact: boolean('do_not_contact').notNull().default(false),
  externalIds: jsonb('external_ids').notNull().default({}),
  mergedIntoId: text('merged_into_id'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
  createdBy: text('created_by').notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  deletedBy: text('deleted_by'),
} as const;

export const clientContacts = pgTable(
  'people',
  baseClientContactColumns,
  (table) => [
    index('people_company_id_idx').on(table.clientId),
    index('people_full_name_lower_idx').on(table.fullName),
    index('people_merged_into_idx').on(table.mergedIntoId),
    // Partial unique indexes for primary_email + linkedin_url come from migration SQL.
  ],
);

export type ClientContact = typeof clientContacts.$inferSelect;
export type NewClientContact = typeof clientContacts.$inferInsert;
