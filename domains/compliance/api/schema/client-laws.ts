import { pgTable, text, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { complianceLaws } from './laws';
import { complianceClients } from './clients';

// Registration pivot: which clients are filing under which laws.
// Soft deactivation via deactivated_at — partial unique index on
// (client_id, law_id) WHERE deactivated_at IS NULL keeps history while
// preventing duplicate active registrations.
export const complianceClientLaws = pgTable('compliance_client_laws', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  clientId: text('client_id').notNull().references(() => complianceClients.id, { onDelete: 'cascade' }),
  lawId: text('law_id').notNull().references(() => complianceLaws.id, { onDelete: 'cascade' }),
  registeredAt: timestamp('registered_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  deactivatedAt: timestamp('deactivated_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
}, (table) => [
  // Active unique index added at SQL level (partial WHERE clause).
  uniqueIndex('compliance_client_laws_pk_key').on(table.clientId, table.lawId, table.registeredAt),
  index('compliance_client_laws_client_id_idx').on(table.clientId),
  index('compliance_client_laws_law_id_idx').on(table.lawId),
]);
