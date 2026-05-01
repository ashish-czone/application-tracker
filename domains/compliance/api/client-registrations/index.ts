/**
 * Public API for the client-registrations module.
 *
 * Cross-module callers MUST import from `../client-registrations` (this
 * barrel), not from individual files inside the folder. The barrel is the
 * contract; everything else is internal and free to be reorganised without
 * breaking callers.
 *
 * Internals NOT exported (intentionally):
 * - `CLIENT_REGISTRATIONS_CONFIG` — entity-engine workflow definition,
 *                                     wired only by client-registrations.module
 * - `client-registrations.dto.*`  — request DTOs and the URL query schema,
 *                                     internal to the controller
 * - `client-registrations.schema.*` — Drizzle table; cross-module joins
 *                                       import it directly from
 *                                       `./client-registrations.schema`
 *                                       (same convention as clients/)
 */

export { ClientRegistrationsModule } from './client-registrations.module';

export {
  ClientRegistrationsService,
  type ClientRegistration,
  type DeactivationPreview,
  type DeactivationResult,
  NoResolvableAssigneeError,
} from './client-registrations.service';
