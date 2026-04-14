import { NestFactory } from '@nestjs/core';
import { runSeeds, type SeedKind, type SeedSource } from '@packages/database/seeder';
import { platformSeedSources } from '@packages/app-shell/seeds';
import { AppModule } from '../app.module';

function parseKind(argv: string[]): SeedKind {
  const kindArg = argv.find((a) => a.startsWith('--kind='));
  const kind = kindArg?.split('=')[1];
  if (kind !== 'system' && kind !== 'demo') {
    throw new Error(
      `[db:seed] --kind must be "system" or "demo" (got ${kind ?? 'undefined'})`,
    );
  }
  return kind;
}

async function main() {
  const kind = parseKind(process.argv.slice(2));

  const sources: SeedSource[] = [
    ...platformSeedSources(),
    // Domain seeds (recruit) — registered as each OnApplicationBootstrap seed
    // service is migrated to a seed source.
  ];

  await runSeeds({
    sources,
    kind,
    bootstrap: () =>
      NestFactory.createApplicationContext(AppModule, {
        logger: ['error', 'warn', 'log'],
      }),
  });
}

main().catch((err) => {
  console.error('[db:seed] failed:', err);
  process.exit(1);
});
