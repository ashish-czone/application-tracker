import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { baseClientColumns } from '@packages/directory';

// Extended `clients` reference for compliance queries. Spreads directory's
// `baseClientColumns` and adds compliance-prefixed columns. The physical
// table is the same shared identity row owned by directory; this reference
// just gives compliance's queries the wider row type.
//
// IMPORTANT: this file is NOT included in `drizzle.config.ts` schema array —
// drizzle-kit must not generate CREATE TABLE migrations for the shared
// identity table from compliance's package. The compliance_* columns are
// added by hand-written migration `0009_companies_compliance_columns.sql`.
//
// See .claude/rules/module-boundaries.md → "Shared Identity Tables".

export const complianceClientColumns = {
  complianceStatus: text('compliance_status'),
  complianceAccountManagerId: text('compliance_account_manager_id'),
  complianceOnboardedAt: timestamp('compliance_onboarded_at', { withTimezone: true, mode: 'date' }),
  complianceNotes: text('compliance_notes'),
  complianceBecameClientAt: timestamp('compliance_became_client_at', { withTimezone: true, mode: 'date' }),
  complianceArchivedAt: timestamp('compliance_archived_at', { withTimezone: true, mode: 'date' }),
} as const;

export const clients = pgTable('companies', {
  ...baseClientColumns,
  ...complianceClientColumns,
});

export type ComplianceClient = typeof clients.$inferSelect;
export type NewComplianceClient = typeof clients.$inferInsert;
