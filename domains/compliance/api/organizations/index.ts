/**
 * Public API for the organizations module.
 *
 * Cross-module callers MUST import from `../organizations` (this barrel),
 * not from individual files inside the folder.
 *
 * Internals NOT exported (intentionally):
 * - `ORGANIZATIONS_CONFIG`     — entity-engine workflow definition
 * - `organizations.dto.*`      — request DTOs and the URL query schema
 * - `organizations.schema.*`   — Drizzle table; cross-module joins
 *                                  import directly from
 *                                  `./organizations.schema`
 */

export { OrganizationsModule } from './organizations.module';

export { OrganizationsService } from './organizations.service';
