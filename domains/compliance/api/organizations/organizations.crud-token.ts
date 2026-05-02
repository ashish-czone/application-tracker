/**
 * DI token for the per-entity `BaseCrudService` instance. Wired in
 * `organizations.module.ts` via `createCrudProvider(...)`. Consumers
 * `@Inject(ORGANIZATIONS_CRUD_TOKEN)` to receive the configured instance.
 */
export const ORGANIZATIONS_CRUD_TOKEN = 'CRUD_organizations';
