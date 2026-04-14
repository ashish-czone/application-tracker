import { pgTable, text, boolean, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { complianceLaws } from './laws';
import { complianceClients } from './clients';

// Pivot: which org-unit handles a given law.
// client_id NULL  → global default handler for the law.
// client_id set   → override for a specific client.
// is_primary true → the preferred handler when multiple exist at the same tier.
export const complianceLawHandlers = pgTable('compliance_law_handlers', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  lawId: text('law_id').notNull().references(() => complianceLaws.id, { onDelete: 'cascade' }),
  // References org_units.id owned by @packages/org-units. FK added at SQL level
  // to avoid an import from a peer package's schema.
  orgEntityId: text('org_entity_id').notNull(),
  clientId: text('client_id').references(() => complianceClients.id, { onDelete: 'cascade' }),
  isPrimary: boolean('is_primary').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex('compliance_law_handlers_law_org_client_key')
    .on(table.lawId, table.orgEntityId, table.clientId),
  index('compliance_law_handlers_law_id_idx').on(table.lawId),
  index('compliance_law_handlers_client_id_idx').on(table.clientId),
]);
