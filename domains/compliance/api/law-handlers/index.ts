/**
 * Public API for the law-handlers module.
 *
 * Cross-module callers MUST import from `../law-handlers` (this barrel),
 * not from individual files inside the folder.
 *
 * Internals NOT exported (intentionally):
 * - `LAW_HANDLERS_CONFIG`     — entity-engine workflow definition
 * - `law-handlers.dto.*`      — request DTOs and the URL query schema
 * - `law-handlers.schema.*`   — Drizzle table; cross-module joins import
 *                                  it directly from `./law-handlers.schema`
 */

export { LawHandlersModule } from './law-handlers.module';

export {
  LawHandlersService,
  type LawHandler,
  type CreateLawHandlerInput,
} from './law-handlers.service';
