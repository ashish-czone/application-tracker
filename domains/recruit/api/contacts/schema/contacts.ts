import { pgTable, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

export const contacts = pgTable('recruit_contacts', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  // Identity FK to directory client_contacts (the shared contact-person
  // identity row). Nullable until R-3 backfill is complete and old identity
  // columns are dropped.
  clientContactId: text('client_contact_id'),
  // Legacy identity columns — read by services until R-2 rewires to directory,
  // dropped in R-3 when this table is renamed to recruit_contact_extras and
  // collapses to recruit-only overflow (mobile, secondary email, addresses,
  // social, opt-out).
  firstName: text('first_name'),
  lastName: text('last_name').notNull(),
  clientId: text('client_id'),
  department: text('department'),
  email: text('email'),
  secondaryEmail: text('secondary_email'),
  jobTitle: text('job_title'),
  workPhone: text('work_phone'),
  mobile: text('mobile'),
  // Mailing Address
  mailingStreet: text('mailing_street'),
  mailingCity: text('mailing_city'),
  mailingProvince: text('mailing_province'),
  mailingPostalCode: text('mailing_postal_code'),
  mailingCountry: text('mailing_country'),
  // Other Address
  otherStreet: text('other_street'),
  otherCity: text('other_city'),
  otherProvince: text('other_province'),
  otherPostalCode: text('other_postal_code'),
  otherCountry: text('other_country'),
  // Social
  linkedinUrl: text('linkedin_url'),
  facebookUrl: text('facebook_url'),
  twitterHandle: text('twitter_handle'),
  // Other Info
  source: text('source').default('added-by-user'),
  isPrimaryContact: boolean('is_primary_contact').default(false),
  emailOptOut: boolean('email_opt_out').default(false),
  // Audit
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  deletedBy: text('deleted_by'),
}, (table) => [
  index('recruit_contacts_client_id_idx').on(table.clientId),
  index('recruit_contacts_email_idx').on(table.email),
  index('recruit_contacts_last_name_idx').on(table.lastName),
  index('recruit_contacts_created_by_idx').on(table.createdBy),
  index('recruit_contacts_client_contact_id_idx').on(table.clientContactId),
]);
