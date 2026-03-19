/** Log level matching PROMPT-API.md logging conventions */
export type LogLevel = 'error' | 'warn' | 'log' | 'debug';

/**
 * Provider interface for pluggable logging backends.
 * Ships with NestJS Logger by default; swap to pino, winston, etc. by
 * implementing this interface and passing it via module config.
 */
export interface LoggerProvider {
  readonly name: string;
  log(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>, trace?: string): void;
  debug(message: string, context?: Record<string, unknown>): void;
}

/** Module configuration */
export interface LoggerModuleConfig {
  /** The logging provider to use. Defaults to 'nestjs'. */
  provider?: 'nestjs';
}

export interface LoggerModuleAsyncOptions {
  useFactory: (...args: any[]) => LoggerModuleConfig | Promise<LoggerModuleConfig>;
  inject?: any[];
}

export const LOGGER_MODULE_CONFIG = Symbol('LOGGER_MODULE_CONFIG');
export const LOGGER_PROVIDER = Symbol('LOGGER_PROVIDER');
