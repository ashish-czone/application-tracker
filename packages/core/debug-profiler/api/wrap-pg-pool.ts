import type { Pool } from 'pg';
import type { ProfilingContextStore } from './profiling-context';

const WRAPPED = Symbol.for('debug-profiler.wrapped');

interface Wrappable {
  query: (...args: unknown[]) => unknown;
  [WRAPPED]?: boolean;
}

function extractSqlAndParams(args: unknown[]): { sql: string; params: unknown[] } {
  const first = args[0];
  if (typeof first === 'string') {
    const params = Array.isArray(args[1]) ? (args[1] as unknown[]) : [];
    return { sql: first, params };
  }
  if (first && typeof first === 'object') {
    const config = first as { text?: string; values?: unknown[] };
    return { sql: config.text ?? '', params: config.values ?? [] };
  }
  return { sql: '', params: [] };
}

/**
 * Replaces pool.query with a timing wrapper that records entries on the
 * active ProfilingContextStore. No-op when no context is active.
 * Idempotent — calling twice on the same pool leaves a single wrapper.
 */
export function wrapPgPool(pool: Pool, store: ProfilingContextStore): void {
  const target = pool as unknown as Wrappable;
  if (target[WRAPPED]) return;

  const original = target.query.bind(pool);

  target.query = function wrappedQuery(...args: unknown[]): unknown {
    const profile = store.current();
    if (!profile) return original(...args);

    const { sql, params } = extractSqlAndParams(args);
    const startedAt = performance.now();
    const result = original(...args);

    if (result && typeof (result as Promise<unknown>).then === 'function') {
      return (result as Promise<unknown>).finally(() => {
        store.recordQuery({
          sql,
          params,
          durationMs: performance.now() - startedAt,
          startedAt,
        });
      });
    }

    store.recordQuery({
      sql,
      params,
      durationMs: performance.now() - startedAt,
      startedAt,
    });
    return result;
  };

  target[WRAPPED] = true;
}
