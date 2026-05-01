import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { addressColumns } from '@packages/address/schema';

export const organizations = pgTable('organizations', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  legalName: text('legal_name'),
  logoUrl: text('logo_url'),
  email: text('email'),
  phone: text('phone'),
  website: text('website'),
  taxRegistration: text('tax_registration'),
  fiscalYearStart: text('fiscal_year_start'),
  ...addressColumns(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});
