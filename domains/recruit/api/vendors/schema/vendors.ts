import { pgTable, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

export const vendors = pgTable('vendors', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  // Vendor Information
  vendorName: text('vendor_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  website: text('website'),
  emailOptOut: boolean('email_opt_out').default(false),
  // Address
  street: text('street'),
  city: text('city'),
  province: text('province'),
  postalCode: text('postal_code'),
  country: text('country'),
  // Audit
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  deletedBy: text('deleted_by'),
}, (table) => [
  index('vendors_vendor_name_idx').on(table.vendorName),
  index('vendors_email_idx').on(table.email),
  index('vendors_created_by_idx').on(table.createdBy),
]);
