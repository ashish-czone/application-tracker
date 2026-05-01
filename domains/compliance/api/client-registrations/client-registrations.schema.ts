import { pgTable, text, timestamp, date, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { complianceLaws } from '../schema/laws';

// `clientId` references the shared identity row (the directory `clients`
// table). The FK constraint lives at the SQL migration level; we don't
// declare it on the JS side because importing the shared ref here
// transitively pulls `@packages/directory` index, which exports the
// NestJS `DirectoryModule` whose decorators trip drizzle-kit's parser.

// Registration pivot: which clients are filing under which laws.
// Soft deactivation via deactivated_at — partial unique index on
// (client_id, law_id) WHERE deactivated_at IS NULL keeps history while
// preventing duplicate active registrations.
//
// `registrationNumber` is the regulator-issued identifier the firm holds
// for the client under this law (free text — every regulator has its own
// format, validation belongs at the regulator level not here).
//
// `effectiveFrom` is the calendar date the registration legally takes
// effect — distinct from `registeredAt` (when the row was inserted).
// Stored as DATE (no timezone) per data-formatting rules for calendar
// dates.
export const complianceClientRegistrations = pgTable('compliance_client_registrations', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  clientId: text('client_id').notNull(),
  lawId: text('law_id').notNull().references(() => complianceLaws.id, { onDelete: 'cascade' }),
  registrationNumber: text('registration_number'),
  effectiveFrom: date('effective_from', { mode: 'string' }),
  registeredAt: timestamp('registered_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  deactivatedAt: timestamp('deactivated_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
}, (table) => [
  // Active unique index added at SQL level (partial WHERE clause).
  uniqueIndex('compliance_client_registrations_pk_key').on(table.clientId, table.lawId, table.registeredAt),
  index('compliance_client_registrations_client_id_idx').on(table.clientId),
  index('compliance_client_registrations_law_id_idx').on(table.lawId),
]);
