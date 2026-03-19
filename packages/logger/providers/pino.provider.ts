import type { LoggerProvider, LogEntry } from '../types';

/**
 * Production logging provider that outputs structured JSON via pino.
 * Each log line is a single JSON object — ideal for log aggregation
 * (ELK, Datadog, CloudWatch, etc.).
 */
export class PinoLoggerProvider implements LoggerProvider {
  readonly name = 'pino';
  private logger: any;

  constructor() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pino = require('pino');
      this.logger = pino({
        level: 'debug',
        formatters: {
          level: (label: string) => ({ level: label }),
        },
        timestamp: false, // We provide our own timestamp in LogEntry
      });
    } catch {
      throw new Error(
        'Pino provider requires the "pino" package. Install it: pnpm add pino',
      );
    }
  }

  write(entry: LogEntry): void {
    const { level, message, timestamp, context, correlationId, trace, data } = entry;

    const logObject: Record<string, unknown> = {
      timestamp,
      ...(context && { context }),
      ...(correlationId && { correlationId }),
      ...(trace && { trace }),
      ...data,
    };

    // Map our LogLevel to pino levels ('log' → 'info')
    const pinoLevel = level === 'log' ? 'info' : level;

    if (typeof this.logger[pinoLevel] === 'function') {
      this.logger[pinoLevel](logObject, message);
    } else {
      this.logger.info(logObject, message);
    }
  }
}
