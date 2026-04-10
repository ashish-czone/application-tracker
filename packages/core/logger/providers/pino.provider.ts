import type { LoggerProvider, LogEntry } from '../types';

/**
 * Structured JSON logging provider via pino.
 *
 * - In production: outputs JSON lines for log aggregation (ELK, Datadog, etc.)
 * - In development: uses pino-pretty for readable colored output (if installed)
 */
export class PinoLoggerProvider implements LoggerProvider {
  readonly name = 'pino';
  private logger: any;

  constructor() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pino = require('pino');
      const isDev = process.env.NODE_ENV !== 'production';

      this.logger = pino({
        level: 'debug',
        formatters: {
          level: (label: string) => ({ level: label }),
        },
        timestamp: false,
        ...(isDev && hasPinoPretty()
          ? {
              transport: {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  ignore: 'pid,hostname',
                  translateTime: false,
                  messageFormat: '{context} | {msg}',
                },
              },
            }
          : {}),
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

    const pinoLevel = level === 'log' ? 'info' : level;

    if (typeof this.logger[pinoLevel] === 'function') {
      this.logger[pinoLevel](logObject, message);
    } else {
      this.logger.info(logObject, message);
    }
  }
}

function hasPinoPretty(): boolean {
  try {
    require.resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}
