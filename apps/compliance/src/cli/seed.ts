import { NestFactory } from '@nestjs/core';
import { runSeeds, type SeedKind, type SeedSource } from '@packages/database/seeder';
import { platformSystemSeedSources } from '@packages/app-shell/seeds';
import { orgUnitsSystemSeedSources } from '@packages/org-units/seeds/system';
import { tasksSystemSeedSources } from '@packages/tasks/seeds/system';
import { complianceDemoSeedSources, complianceSystemSeedSources } from '@domains/compliance-api/seeds';
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

function collectSources(kind: SeedKind): SeedSource[] {
  if (kind === 'system') {
    return [
      ...platformSystemSeedSources(),
      ...orgUnitsSystemSeedSources(),
      ...tasksSystemSeedSources(),
      ...complianceSystemSeedSources(),
    ];
  }
  return [...complianceDemoSeedSources()];
}

async function main() {
  const kind = parseKind(process.argv.slice(2));

  await runSeeds({
    sources: collectSources(kind),
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
