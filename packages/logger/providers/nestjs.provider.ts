import { Logger } from '@nestjs/common';
import type { LoggerProvider } from '../types';

/**
 * Default logging provider that delegates to NestJS's built-in Logger.
 * Formats structured context as a JSON prefix for easy parsing.
 */
export class NestjsLoggerProvider implements LoggerProvider {
  readonly name = 'nestjs';
  private readonly logger: Logger;

  constructor(context?: string) {
    this.logger = new Logger(context ?? 'App');
  }

  log(message: string, context?: Record<string, unknown>): void {
    if (context) {
      this.logger.log(context, message);
    } else {
      this.logger.log(message);
    }
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (context) {
      this.logger.warn(context, message);
    } else {
      this.logger.warn(message);
    }
  }

  error(message: string, context?: Record<string, unknown>, trace?: string): void {
    if (context) {
      this.logger.error(context, trace ?? message);
    } else {
      this.logger.error(message, trace);
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (context) {
      this.logger.debug(context, message);
    } else {
      this.logger.debug(message);
    }
  }
}
