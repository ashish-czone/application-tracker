/**
 * Public API for the laws module.
 *
 * Cross-module callers MUST import from `../laws` (this barrel), not from
 * individual files inside the folder. The barrel is the contract;
 * everything else is internal.
 *
 * Internals NOT exported (intentionally):
 * - `LAWS_CONFIG`        — entity-engine workflow definition,
 *                            wired only by laws.module
 * - `laws.dto.*`         — request DTOs and the URL query schema,
 *                            internal to the controller
 * - `laws.schema.*`      — Drizzle table; cross-module joins import
 *                            it directly from `./laws.schema`
 */

export { LawsModule } from './laws.module';

export {
  LawsService,
  type LawDisplayFields,
} from './laws.service';
