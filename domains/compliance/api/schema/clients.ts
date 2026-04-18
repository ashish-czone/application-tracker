import { pgTable, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { addressColumns } from '@packages/address/schema';

// Domain-agnostic `clients` table. No compliance_ prefix — designed to
// graduate to a platform package once more than one domain needs it.
// FKs to other-package tables (users, categories) are enforced at the
// SQL migration level only, not via Drizzle .references(), to keep this
// schema free of cross-package imports.
export const clients = pgTable('clients', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  legalName: text('legal_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  website: text('website'),
  taxId: text('tax_id'),
  industryId: text('industry_id'),
  ...addressColumns(),
  accountManagerId: text('account_manager_id'),
  status: text('status').notNull().default('onboarding'),
  onboardedAt: timestamp('onboarded_at', { withTimezone: true, mode: 'date' }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
}, (table) => [
  // country_id index is added at the SQL migration level — columns spread
  // via addressColumns() are not surfaced to Drizzle's index callback typing.
  uniqueIndex('clients_tax_id_key').on(table.taxId),
  index('clients_status_idx').on(table.status),
  index('clients_industry_id_idx').on(table.industryId),
  index('clients_account_manager_id_idx').on(table.accountManagerId),
]);
