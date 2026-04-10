import { Inject, Injectable } from '@nestjs/common';
import { LOGGER_PROVIDER, type LoggerProvider, type LogEntry, type LogLevel } from '../types';
import { getCorrelationId } from '../correlation/store';

/**
 * Injectable logging service that:
 * 1. Builds structured LogEntry objects
 * 2. Attaches correlationId from async context
 * 3. Delegates to the configured LoggerProvider
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
   */
  forContext(context: string): ContextLogger {
    return new ContextLogger(context, this.provider);
  }

  log(message: string, data?: Record<string, unknown>): void {
    this.write('log', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.write('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>, trace?: string): void {
    this.write('error', message, data, undefined, trace);
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.write('debug', message, data);
  }

  private write(level: LogLevel, message: string, data?: Record<string, unknown>, context?: string, trace?: string): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      correlationId: getCorrelationId(),
      context,
      trace,
      data,
    };
    this.provider.write(entry);
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
    this.write('log', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.write('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>, trace?: string): void {
    this.write('error', message, data, trace);
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.write('debug', message, data);
  }

  private write(level: LogLevel, message: string, data?: Record<string, unknown>, trace?: string): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      correlationId: getCorrelationId(),
      context: this.context,
      trace,
      data,
    };
    this.provider.write(entry);
  }
}
