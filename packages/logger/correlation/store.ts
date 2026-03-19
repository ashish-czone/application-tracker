import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

interface RequestContext {
  correlationId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * Run a callback within a correlation context.
 * Used by the HTTP middleware to scope each request.
 */
export function runWithCorrelationId<T>(correlationId: string, fn: () => T): T {
  return storage.run({ correlationId }, fn);
}

/**
 * Get the current request's correlation ID.
 * Returns the request-scoped ID if inside a request, otherwise generates a new one.
 * This allows event emissions outside HTTP context (e.g., seeders, cron jobs)
 * to still produce valid correlation IDs.
 */
export function getCorrelationId(): string {
  return storage.getStore()?.correlationId ?? randomUUID();
}
