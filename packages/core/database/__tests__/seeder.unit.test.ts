import type { INestApplicationContext } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assertDemoSeedAllowed, runSeeds, type SeedSource } from '../seeder';

function makeFakeCtx(): INestApplicationContext & { __close: ReturnType<typeof vi.fn> } {
  const close = vi.fn().mockResolvedValue(undefined);
  // Only `close` is used by runSeeds itself — seed functions receive this object
  // and call whatever they need on it. Cast is safe for tests.
  return { close, __close: close } as unknown as INestApplicationContext & {
    __close: ReturnType<typeof vi.fn>;
  };
}

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
  let ctx: ReturnType<typeof makeFakeCtx>;
  let bootstrap: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ctx = makeFakeCtx();
    bootstrap = vi.fn().mockResolvedValue(ctx);
  });

  function makeSource(
    name: string,
    kind: 'system' | 'demo',
    fn: (ctx: INestApplicationContext) => Promise<void>,
  ): SeedSource {
    return { name, kind, load: async () => fn };
  }

  it('returns early when no sources match the kind', async () => {
    const logs: string[] = [];
    const fn = vi.fn().mockResolvedValue(undefined);
    await runSeeds({
      sources: [makeSource('demo-only', 'demo', fn)],
      kind: 'system',
      bootstrap,
      logger: (m) => logs.push(m),
      env: { NODE_ENV: 'development', ALLOW_DEMO_SEED: 'true' },
    });
    expect(fn).not.toHaveBeenCalled();
    expect(bootstrap).not.toHaveBeenCalled();
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

    await runSeeds({ sources, kind: 'system', bootstrap, logger: () => {} });

    expect(calls).toEqual(['a-system', 'c-system']);
    expect(bootstrap).toHaveBeenCalledOnce();
    expect(ctx.__close).toHaveBeenCalledOnce();
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
      bootstrap,
      logger: () => {},
    });

    expect(systemLoad).toHaveBeenCalledOnce();
    expect(demoLoad).not.toHaveBeenCalled();
  });

  it('passes the bootstrapped context to each seed function', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    await runSeeds({
      sources: [makeSource('a', 'system', fn)],
      kind: 'system',
      bootstrap,
      logger: () => {},
    });
    expect(fn).toHaveBeenCalledWith(ctx);
  });

  it('refuses demo kind when NODE_ENV=production', async () => {
    await expect(
      runSeeds({
        sources: [makeSource('a', 'demo', async () => {})],
        kind: 'demo',
        bootstrap,
        logger: () => {},
        env: { NODE_ENV: 'production', ALLOW_DEMO_SEED: 'true' },
      }),
    ).rejects.toThrow(/production/);
    expect(bootstrap).not.toHaveBeenCalled();
  });

  it('refuses demo kind when ALLOW_DEMO_SEED is not set', async () => {
    await expect(
      runSeeds({
        sources: [makeSource('a', 'demo', async () => {})],
        kind: 'demo',
        bootstrap,
        logger: () => {},
        env: { NODE_ENV: 'development' },
      }),
    ).rejects.toThrow(/ALLOW_DEMO_SEED/);
    expect(bootstrap).not.toHaveBeenCalled();
  });

  it('allows demo kind when guard passes', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    await runSeeds({
      sources: [makeSource('a', 'demo', fn)],
      kind: 'demo',
      bootstrap,
      logger: () => {},
      env: { NODE_ENV: 'development', ALLOW_DEMO_SEED: 'true' },
    });
    expect(fn).toHaveBeenCalledOnce();
  });

  it('closes the context even when a seed function throws', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(
      runSeeds({
        sources: [makeSource('a', 'system', failing)],
        kind: 'system',
        bootstrap,
        logger: () => {},
      }),
    ).rejects.toThrow('boom');
    expect(ctx.__close).toHaveBeenCalledOnce();
  });

  it('closes the context even when bootstrap succeeds but source.load throws', async () => {
    const load = vi.fn().mockRejectedValue(new Error('load failed'));
    await expect(
      runSeeds({
        sources: [{ name: 'a', kind: 'system', load }],
        kind: 'system',
        bootstrap,
        logger: () => {},
      }),
    ).rejects.toThrow('load failed');
    expect(ctx.__close).toHaveBeenCalledOnce();
  });
});
