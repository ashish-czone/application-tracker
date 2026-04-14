import type { INestApplicationContext } from '@nestjs/common';

export type SeedKind = 'system' | 'demo';

export type SeedFn = (ctx: INestApplicationContext) => Promise<void>;

export interface SeedSource {
  name: string;
  kind: SeedKind;
  load: () => Promise<SeedFn>;
}

export interface RunSeedsOptions {
  sources: SeedSource[];
  kind: SeedKind;
  bootstrap: () => Promise<INestApplicationContext>;
  logger?: (message: string) => void;
  env?: NodeJS.ProcessEnv;
}

export function assertDemoSeedAllowed(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV === 'production') {
    throw new Error(
      'db:seed:demo is refused when NODE_ENV=production. Demo data must never run against production databases.',
    );
  }
  if (env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error(
      'db:seed:demo requires ALLOW_DEMO_SEED=true. Set this explicitly before running demo seeds.',
    );
  }
}

export async function runSeeds({
  sources,
  kind,
  bootstrap,
  logger = (message) => console.log(`[db:seed:${kind}] ${message}`),
  env = process.env,
}: RunSeedsOptions): Promise<void> {
  if (kind === 'demo') {
    assertDemoSeedAllowed(env);
  }

  const matching = sources.filter((source) => source.kind === kind);
  if (matching.length === 0) {
    logger(`no ${kind} sources registered, nothing to do`);
    return;
  }

  const ctx = await bootstrap();

  try {
    for (const source of matching) {
      logger(`seeding ${source.name}`);
      const seedFn = await source.load();
      await seedFn(ctx);
    }
    logger(`done (${matching.length} source${matching.length === 1 ? '' : 's'})`);
  } finally {
    await ctx.close();
  }
}
