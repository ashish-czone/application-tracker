export { complianceLaws } from './laws';
export { complianceRules } from '../rules/rules.schema';
export { complianceLawHandlers } from './law-handlers';
export { complianceClientRegistrations } from './client-registrations';
export { complianceFilings } from './compliance-filings';
export { organizations } from './organizations';

// `clients` and `clientContacts` are NOT re-exported here. They live on
// the shared identity tables owned by `@packages/directory` and compliance
// extends them via `domains/compliance/api/clients/clients.schema.ts` /
// `domains/compliance/api/client-contacts/client-contacts.schema.ts`.
// Those schema files are imported directly by the
// services that need them. Re-exporting them here would force
// drizzle-kit (which globs `./schema`) to follow the cross-package
// transitive imports and trip on the directory module's NestJS
// decorators.
