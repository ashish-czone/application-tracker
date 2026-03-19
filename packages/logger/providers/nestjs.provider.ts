import { Logger } from '@nestjs/common';
import type { LoggerProvider, LogEntry } from '../types';

/**
 * Default logging provider that delegates to NestJS's built-in Logger.
 * Formats structured context as a readable text output for development.
 */
export class NestjsLoggerProvider implements LoggerProvider {
  readonly name = 'nestjs';

  write(entry: LogEntry): void {
    const context = entry.context ?? 'App';
    const logger = new Logger(context);

    // Build a data string from entry metadata
    const meta: Record<string, unknown> = {};
    if (entry.correlationId) meta.correlationId = entry.correlationId;
    if (entry.data) Object.assign(meta, entry.data);
    const hasMeta = Object.keys(meta).length > 0;

    const message = hasMeta
      ? `${entry.message} ${JSON.stringify(meta)}`
      : entry.message;

    switch (entry.level) {
      case 'log':
        logger.log(message);
        break;
      case 'warn':
        logger.warn(message);
        break;
      case 'error':
        logger.error(message, entry.trace);
        break;
      case 'debug':
        logger.debug(message);
        break;
    }
  }
}
