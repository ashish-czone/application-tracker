import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const poolEndMock = vi.fn();
const poolCtorMock = vi.fn();
const drizzleMock = vi.fn();

vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle: (...args: unknown[]) => {
    drizzleMock(...args);
    return { __fakeDb: true };
  },
}));

vi.mock('pg', () => ({
  Pool: class {
    constructor(config: unknown) {
      poolCtorMock(config);
    }
    end() {
      return poolEndMock();
    }
  },
}));

import { assertDemoSeedAllowed, runSeeds, type SeedSource } from '../seeder';

describe('assertDemoSeedAllowed', () => {
  it('throws when NODE_ENV=production', () => {
    expect(() =>
      assertDemoSeedAllowed({ NODE_ENV: 'production', ALLOW_DEMO_SEED: 'true' }),
    ).toThrow(/production/);
  });

  it('throws when ALLOW_DEMO_SEED is not set', () => {
    expect(() => assertDemoSeedAllowed({ NODE_ENV: 'development' })).toThrow(
      /ALLOW_DEMO_SEED/,
    );
  });

  it('throws when ALLOW_DEMO_SEED is not exactly "true"', () => {
    expect(() =>
      assertDemoSeedAllowed({ NODE_ENV: 'development', ALLOW_DEMO_SEED: '1' }),
    ).toThrow(/ALLOW_DEMO_SEED/);
  });

  it('passes when NODE_ENV!=production and ALLOW_DEMO_SEED=true', () => {
    expect(() =>
      assertDemoSeedAllowed({ NODE_ENV: 'development', ALLOW_DEMO_SEED: 'true' }),
    ).not.toThrow();
  });
});

describe('runSeeds', () => {
  beforeEach(() => {
    poolEndMock.mockReset();
    poolCtorMock.mockReset();
    drizzleMock.mockReset();
  });

  afterEach(() => {
    delete process.env.DATABASE_URL;
  });

  function makeSource(name: string, kind: 'system' | 'demo', fn: () => Promise<void>): SeedSource {
    return { name, kind, load: async () => fn };
  }

  it('throws when DATABASE_URL is missing', async () => {
    await expect(
      runSeeds({
        sources: [makeSource('a', 'system', async () => {})],
        kind: 'system',
      }),
    ).rejects.toThrow(/DATABASE_URL/);
  });

  it('returns early when no sources match the kind', async () => {
    const logs: string[] = [];
    const fn = vi.fn().mockResolvedValue(undefined);
    await runSeeds({
      sources: [makeSource('demo-only', 'demo', fn)],
      kind: 'system',
      databaseUrl: 'postgres://test',
      logger: (m) => logs.push(m),
      env: { NODE_ENV: 'development', ALLOW_DEMO_SEED: 'true' },
    });
    expect(fn).not.toHaveBeenCalled();
    expect(poolCtorMock).not.toHaveBeenCalled();
    expect(logs.some((l) => l.includes('nothing to do'))).toBe(true);
  });

  it('filters sources by kind and calls them in order', async () => {
    const calls: string[] = [];
    const sources: SeedSource[] = [
      makeSource('a-system', 'system', async () => {
        calls.push('a-system');
      }),
      makeSource('b-demo', 'demo', async () => {
        calls.push('b-demo');
      }),
      makeSource('c-system', 'system', async () => {
        calls.push('c-system');
      }),
    ];

    await runSeeds({
      sources,
      kind: 'system',
      databaseUrl: 'postgres://test',
      logger: () => {},
    });

    expect(calls).toEqual(['a-system', 'c-system']);
    expect(poolCtorMock).toHaveBeenCalledOnce();
    expect(drizzleMock).toHaveBeenCalledOnce();
    expect(poolEndMock).toHaveBeenCalledOnce();
  });

  it('lazy-loads seed functions only when their kind matches', async () => {
    const systemLoad = vi.fn().mockResolvedValue(async () => {});
    const demoLoad = vi.fn().mockResolvedValue(async () => {});

    await runSeeds({
      sources: [
        { name: 'a', kind: 'system', load: systemLoad },
        { name: 'b', kind: 'demo', load: demoLoad },
      ],
      kind: 'system',
      databaseUrl: 'postgres://test',
      logger: () => {},
    });

    expect(systemLoad).toHaveBeenCalledOnce();
    expect(demoLoad).not.toHaveBeenCalled();
  });

  it('passes the drizzle db instance to each seed function', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    await runSeeds({
      sources: [makeSource('a', 'system', fn)],
      kind: 'system',
      databaseUrl: 'postgres://test',
      logger: () => {},
    });
    expect(fn).toHaveBeenCalledWith({ __fakeDb: true });
  });

  it('refuses demo kind when NODE_ENV=production', async () => {
    await expect(
      runSeeds({
        sources: [makeSource('a', 'demo', async () => {})],
        kind: 'demo',
        databaseUrl: 'postgres://test',
        logger: () => {},
        env: { NODE_ENV: 'production', ALLOW_DEMO_SEED: 'true' },
      }),
    ).rejects.toThrow(/production/);
    expect(poolCtorMock).not.toHaveBeenCalled();
  });

  it('refuses demo kind when ALLOW_DEMO_SEED is not set', async () => {
    await expect(
      runSeeds({
        sources: [makeSource('a', 'demo', async () => {})],
        kind: 'demo',
        databaseUrl: 'postgres://test',
        logger: () => {},
        env: { NODE_ENV: 'development' },
      }),
    ).rejects.toThrow(/ALLOW_DEMO_SEED/);
  });

  it('allows demo kind when guard passes', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    await runSeeds({
      sources: [makeSource('a', 'demo', fn)],
      kind: 'demo',
      databaseUrl: 'postgres://test',
      logger: () => {},
      env: { NODE_ENV: 'development', ALLOW_DEMO_SEED: 'true' },
    });
    expect(fn).toHaveBeenCalledOnce();
  });

  it('closes the pool even when a seed function throws', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(
      runSeeds({
        sources: [makeSource('a', 'system', failing)],
        kind: 'system',
        databaseUrl: 'postgres://test',
        logger: () => {},
      }),
    ).rejects.toThrow('boom');
    expect(poolEndMock).toHaveBeenCalledOnce();
  });

  it('reads DATABASE_URL from process.env when not passed explicitly', async () => {
    process.env.DATABASE_URL = 'postgres://from-env';
    await runSeeds({
      sources: [makeSource('a', 'system', async () => {})],
      kind: 'system',
      logger: () => {},
    });
    expect(poolCtorMock).toHaveBeenCalledWith({ connectionString: 'postgres://from-env' });
  });
});
