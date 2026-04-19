import { describe, expect, it } from 'vitest';
import { ProfilingContextStore } from '../profiling-context';
import type { RequestProfile } from '../types';

function makeProfile(): RequestProfile {
  return {
    requestId: 'req-1',
    method: 'GET',
    path: '/tasks',
    startedAt: Date.now(),
    durationMs: 0,
    queries: [],
  };
}

describe('ProfilingContextStore', () => {
  it('returns undefined when no context is active', () => {
    const store = new ProfilingContextStore();
    expect(store.current()).toBeUndefined();
  });

  it('makes the profile available inside run()', () => {
    const store = new ProfilingContextStore();
    const profile = makeProfile();
    store.run(profile, () => {
      expect(store.current()).toBe(profile);
    });
    expect(store.current()).toBeUndefined();
  });

  it('preserves the profile across awaited async work', async () => {
    const store = new ProfilingContextStore();
    const profile = makeProfile();
    await store.run(profile, async () => {
      await Promise.resolve();
      expect(store.current()).toBe(profile);
    });
  });

  it('appends query entries to the active profile', () => {
    const store = new ProfilingContextStore();
    const profile = makeProfile();
    store.run(profile, () => {
      store.recordQuery({ sql: 'SELECT 1', params: [], durationMs: 2, startedAt: 0 });
      store.recordQuery({ sql: 'SELECT 2', params: [], durationMs: 3, startedAt: 0 });
    });
    expect(profile.queries).toHaveLength(2);
    expect(profile.queries[0].sql).toBe('SELECT 1');
  });

  it('is a no-op when recordQuery is called outside a context', () => {
    const store = new ProfilingContextStore();
    expect(() => store.recordQuery({ sql: 'x', params: [], durationMs: 0, startedAt: 0 })).not.toThrow();
  });

  it('isolates concurrent contexts', async () => {
    const store = new ProfilingContextStore();
    const a = makeProfile();
    const b = makeProfile();
    a.requestId = 'req-a';
    b.requestId = 'req-b';

    const run = (p: RequestProfile, sql: string) =>
      store.run(p, async () => {
        await new Promise((r) => setTimeout(r, 5));
        store.recordQuery({ sql, params: [], durationMs: 1, startedAt: 0 });
      });

    await Promise.all([run(a, 'a-sql'), run(b, 'b-sql')]);

    expect(a.queries.map((q) => q.sql)).toEqual(['a-sql']);
    expect(b.queries.map((q) => q.sql)).toEqual(['b-sql']);
  });
});
