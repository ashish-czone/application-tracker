/**
 * DI token for the per-entity `BaseCrudService` instance. Wired in
 * `rules.module.ts` via `createCrudProvider(...)`.
 */
export const RULES_CRUD_TOKEN = 'CRUD_compliance-rules';
