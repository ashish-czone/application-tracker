import { pgTable, text, timestamp, date, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { hierarchyColumns } from '@packages/hierarchy/schema';

// parent_id FK constraint is added at the SQL migration level (TDZ prevents
// passing complianceLaws as a self-reference inside its own definition).
export const complianceLaws = pgTable('compliance_laws', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  ...hierarchyColumns(),
  name: text('name').notNull(),
  code: text('code').notNull(),
  issuingAuthority: text('issuing_authority'),
  jurisdiction: text('jurisdiction'),
  effectiveFrom: date('effective_from', { mode: 'string' }),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex('compliance_laws_code_key').on(table.code),
  index('compliance_laws_parent_id_idx').on(table.parentId),
  index('compliance_laws_path_idx').on(table.path),
]);
