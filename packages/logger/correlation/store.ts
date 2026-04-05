import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

interface RequestContext {
  correlationId: string;
  tenantId?: string;
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

/**
 * Set the tenant ID for the current request context.
 * Called by the tenancy middleware/guard after resolving the tenant.
 * Safe to call — mutates the existing store object within the async scope.
 */
export function setTenantId(tenantId: string): void {
  const store = storage.getStore();
  if (store) {
    store.tenantId = tenantId;
  }
}

/**
 * Get the tenant ID for the current request context.
 * Returns undefined when tenancy is not active or outside a request context.
 */
export function getTenantId(): string | undefined {
  return storage.getStore()?.tenantId;
}
