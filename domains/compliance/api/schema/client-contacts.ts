import { pgTable, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { clients } from './clients';

// Contacts attached to a client. Exactly one row per client must have
// is_primary = true; enforced via a partial unique index added at the
// SQL migration level (Drizzle-kit doesn't yet emit partial indexes
// from the builder, so the WHERE clause lives in the migration file).
export const clientContacts = pgTable('client_contacts', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  designation: text('designation'),
  isPrimary: boolean('is_primary').notNull().default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
}, (table) => [
  index('client_contacts_client_id_idx').on(table.clientId),
  index('client_contacts_is_primary_idx').on(table.isPrimary),
]);
