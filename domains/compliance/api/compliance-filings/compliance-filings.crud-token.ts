/**
 * DI token for the per-entity `BaseCrudService` instance. Wired in
 * `compliance-filings.module.ts` via `createCrudProvider(...)`.
 */
export const COMPLIANCE_FILINGS_CRUD_TOKEN = 'CRUD_compliance-filings';
