import { pgTable, text, boolean } from 'drizzle-orm/pg-core';
import { baseClientContactColumns } from '@packages/directory';

// Extended `client_contacts` reference for compliance queries. Spreads
// directory's `baseClientContactColumns` and adds compliance-prefixed
// columns. The physical table is the same shared identity row owned by
// directory; this reference just gives compliance's queries the wider row
// type.
//
// Per the shared-identity prefix pattern, each row represents the contact
// person's identity. Compliance's relationship to the contact (which client
// they work at, designation, primary flag, notes) lives on the prefixed
// columns. Same human as a contact at two compliance clients = two rows
// (M:N within a single domain isn't expressible by the prefix model — see
// .claude/rules/module-boundaries.md → "When NOT to extend the shared
// table"). In practice compliance contacts are 1-client (the compliance
// officer at *that* client).
//
// IMPORTANT: this file is NOT included in `drizzle.config.ts` schema array —
// the compliance_* columns are added by a hand-written migration that ALTERs
// the directory `client_contacts` table.

export const complianceClientContactColumns = {
  // FK to the compliance client this contact works at. Different from base
  // `clientId` (which points at the contact's primary employer in the
  // directory): compliance can hold a separate FK because the same person
  // may be a contact at one client in compliance scope and a contact at
  // another in recruit scope, with different operational relationships.
  complianceClientId: text('compliance_client_id'),
  complianceDesignation: text('compliance_designation'),
  complianceIsPrimary: boolean('compliance_is_primary').notNull().default(false),
  complianceNotes: text('compliance_notes'),
} as const;

export const clientContacts = pgTable('client_contacts', {
  ...baseClientContactColumns,
  ...complianceClientContactColumns,
});

export type ComplianceClientContact = typeof clientContacts.$inferSelect;
export type NewComplianceClientContact = typeof clientContacts.$inferInsert;
