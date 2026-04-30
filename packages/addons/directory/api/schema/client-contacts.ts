import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { pgTable, text, boolean, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { clients } from './clients';

// Base columns for the shared identity table `client_contacts`. Exported so
// that domains can spread them into an extended `pgTable('client_contacts', { ... })`
// reference and add their own prefixed columns. See
// .claude/rules/module-boundaries.md → "Shared Identity Tables".
export const baseClientContactColumns = {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  fullName: text('full_name').notNull(),
  primaryEmail: text('primary_email'),
  primaryPhone: text('primary_phone'),
  linkedinUrl: text('linkedin_url'),
  jobTitle: text('job_title'),
  clientId: text('client_id').references(() => clients.id, { onDelete: 'set null' }),
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
  'client_contacts',
  baseClientContactColumns,
  (table) => [
    index('client_contacts_client_id_idx').on(table.clientId),
    index('client_contacts_full_name_lower_idx').on(sql`lower(${table.fullName})`),
    index('client_contacts_merged_into_idx').on(table.mergedIntoId),
    // Partial unique indexes for primary_email + linkedin_url come from migration SQL.
  ],
);

export type ClientContact = typeof clientContacts.$inferSelect;
export type NewClientContact = typeof clientContacts.$inferInsert;
