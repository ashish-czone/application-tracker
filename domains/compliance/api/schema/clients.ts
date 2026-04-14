import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

export const complianceClients = pgTable('compliance_clients', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  legalName: text('legal_name'),
  primaryContactEmail: text('primary_contact_email'),
  taxIdentifier: text('tax_identifier'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex('compliance_clients_tax_identifier_key').on(table.taxIdentifier),
]);
