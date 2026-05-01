/**
 * Public API for the clients module.
 *
 * Cross-module callers MUST import from `../clients` (this barrel), not from
 * individual files inside the folder. The barrel is the contract; everything
 * else is internal and free to be reorganised without breaking callers.
 *
 * Internals NOT exported (intentionally):
 * - `CLIENTS_CONFIG`             — entity-engine workflow definition,
 *                                   wired only by clients.module
 * - `ClientsRollupService`       — internal aggregation for the dashboard
 *                                   list endpoint, not part of the public
 *                                   API; consumers use ClientsService.list
 * - `clients.dto.*`              — request DTOs and the URL query schema,
 *                                   internal to the controller
 * - `clients.schema.*`           — Drizzle table; cross-module joins import
 *                                   it directly from './clients.schema',
 *                                   bypassing the barrel because schemas
 *                                   are stable constants without behaviour
 */

export { ClientsModule } from './clients.module';

export {
  ClientsService,
  type Client,
  type Contact,
  type ClientInput,
  type ContactInput,
  type CreateWithContactsInput,
  type CreateWithContactsResult,
} from './clients.service';

export { ClientDormancyService } from './clients.dormancy.service';
