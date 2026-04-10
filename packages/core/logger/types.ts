/** Log level matching PROMPT-API.md logging conventions */
export type LogLevel = 'error' | 'warn' | 'log' | 'debug';

/**
 * Common structured log entry that all providers receive.
 * The service layer builds this; each provider formats/outputs it however it wants.
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  correlationId?: string;
  trace?: string;
  data?: Record<string, unknown>;
}

/**
 * Provider interface for pluggable logging backends.
 * Each provider receives a structured LogEntry and decides how to format/output it.
 *
 * - NestJS provider: colored text output (dev)
 * - Pino provider: JSON lines (production)
 * - Console provider: simple console.log (testing)
 */
export interface LoggerProvider {
  readonly name: string;
  write(entry: LogEntry): void;
}

/** Module configuration */
export interface LoggerModuleConfig {
  /** The logging provider to use. Defaults to 'nestjs'. */
  provider?: 'nestjs' | 'pino';
}

export interface LoggerModuleAsyncOptions {
  useFactory: (...args: any[]) => LoggerModuleConfig | Promise<LoggerModuleConfig>;
  inject?: any[];
}

export const LOGGER_MODULE_CONFIG = Symbol('LOGGER_MODULE_CONFIG');
export const LOGGER_PROVIDER = Symbol('LOGGER_PROVIDER');
