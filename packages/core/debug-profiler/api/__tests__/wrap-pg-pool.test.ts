import { describe, expect, it } from 'vitest';
import { wrapPgPool } from '../wrap-pg-pool';
import { ProfilingContextStore } from '../profiling-context';
import type { RequestProfile } from '../types';
import type { Pool } from 'pg';

function fakePool(handler: (args: unknown[]) => Promise<unknown> | unknown) {
  return {
    query: (...args: unknown[]) => handler(args),
  } as unknown as Pool;
}

function makeProfile(): RequestProfile {
  return {
    requestId: 'req',
    method: 'GET',
    path: '/',
    startedAt: Date.now(),
    durationMs: 0,
    queries: [],
  };
}

describe('wrapPgPool', () => {
  it('records a query entry when called inside a context (promise form)', async () => {
    const store = new ProfilingContextStore();
    const pool = fakePool(() => Promise.resolve({ rows: [] }));
    wrapPgPool(pool, store);

    const profile = makeProfile();
    await store.run(profile, async () => {
      await pool.query('SELECT 1', [42]);
    });

    expect(profile.queries).toHaveLength(1);
    expect(profile.queries[0].sql).toBe('SELECT 1');
    expect(profile.queries[0].params).toEqual([42]);
    expect(profile.queries[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('supports the config-object form', async () => {
    const store = new ProfilingContextStore();
    const pool = fakePool(() => Promise.resolve({ rows: [] }));
    wrapPgPool(pool, store);

    const profile = makeProfile();
    await store.run(profile, async () => {
      await pool.query({ text: 'SELECT $1', values: ['x'] });
    });

    expect(profile.queries[0].sql).toBe('SELECT $1');
    expect(profile.queries[0].params).toEqual(['x']);
  });

  it('is a no-op when no context is active', async () => {
    const store = new ProfilingContextStore();
    let called = 0;
    const pool = fakePool(() => {
      called++;
      return Promise.resolve({ rows: [] });
    });
    wrapPgPool(pool, store);

    await pool.query('SELECT 1');
    expect(called).toBe(1);
  });

  it('still records when the underlying query rejects', async () => {
    const store = new ProfilingContextStore();
    const err = new Error('boom');
    const pool = fakePool(() => Promise.reject(err));
    wrapPgPool(pool, store);

    const profile = makeProfile();
    await store.run(profile, async () => {
      await expect(pool.query('BAD SQL', [])).rejects.toBe(err);
    });

    expect(profile.queries).toHaveLength(1);
    expect(profile.queries[0].sql).toBe('BAD SQL');
  });

  it('is idempotent — wrapping twice does not double-record', async () => {
    const store = new ProfilingContextStore();
    const pool = fakePool(() => Promise.resolve({ rows: [] }));
    wrapPgPool(pool, store);
    wrapPgPool(pool, store);

    const profile = makeProfile();
    await store.run(profile, async () => {
      await pool.query('SELECT 1');
    });

    expect(profile.queries).toHaveLength(1);
  });
});
