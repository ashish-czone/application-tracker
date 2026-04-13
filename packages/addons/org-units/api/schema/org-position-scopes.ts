import { pgTable, text, primaryKey } from 'drizzle-orm/pg-core';
import { orgPositions } from './org-positions';

export const orgPositionScopes = pgTable('org_position_scopes', {
  positionId: text('position_id').notNull().references(() => orgPositions.id, { onDelete: 'cascade' }),
  entityType: text('entity_type').notNull(),
  scope: text('scope').notNull(),
}, (table) => [
  primaryKey({ columns: [table.positionId, table.entityType] }),
]);
