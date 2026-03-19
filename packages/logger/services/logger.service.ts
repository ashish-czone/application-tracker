import { Inject, Injectable } from '@nestjs/common';
import { LOGGER_PROVIDER, type LoggerProvider } from '../types';
import { getCorrelationId } from '../correlation/store';

/**
 * Injectable logging service that:
 * 1. Delegates to the configured LoggerProvider
 * 2. Automatically attaches the current request's correlationId to every log entry
 *
 * Usage:
 *   constructor(private readonly logger: AppLoggerService) {}
 *   this.logger.log('Order created', { orderId });
 */
@Injectable()
export class AppLoggerService {
  constructor(
    @Inject(LOGGER_PROVIDER) private readonly provider: LoggerProvider,
  ) {}

  /**
   * Create a child logger with a fixed context name (e.g., service/class name).
   * This returns a new instance that logs with that context.
   */
  forContext(context: string): ContextLogger {
    return new ContextLogger(context, this.provider);
  }

  log(message: string, context?: Record<string, unknown>): void {
    this.provider.log(message, this.enrich(context));
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.provider.warn(message, this.enrich(context));
  }

  error(message: string, context?: Record<string, unknown>, trace?: string): void {
    this.provider.error(message, this.enrich(context), trace);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.provider.debug(message, this.enrich(context));
  }

  private enrich(context?: Record<string, unknown>): Record<string, unknown> {
    return {
      correlationId: getCorrelationId(),
      ...context,
    };
  }
}

/**
 * A logger scoped to a specific context (class/service name).
 * Not injectable — create via AppLoggerService.forContext().
 */
export class ContextLogger {
  constructor(
    private readonly context: string,
    private readonly provider: LoggerProvider,
  ) {}

  log(message: string, data?: Record<string, unknown>): void {
    this.provider.log(message, this.enrich(data));
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.provider.warn(message, this.enrich(data));
  }

  error(message: string, data?: Record<string, unknown>, trace?: string): void {
    this.provider.error(message, this.enrich(data), trace);
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.provider.debug(message, this.enrich(data));
  }

  private enrich(data?: Record<string, unknown>): Record<string, unknown> {
    return {
      correlationId: getCorrelationId(),
      context: this.context,
      ...data,
    };
  }
}
