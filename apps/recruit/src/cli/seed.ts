import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { runSeeds, type SeedKind, type SeedSource } from '@packages/database/seeder';
import { platformSeedSources } from '@packages/app-shell/seeds';

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
  loadEnv({ path: path.resolve(__dirname, '../../.env') });

  const kind = parseKind(process.argv.slice(2));

  const sources: SeedSource[] = [
    ...platformSeedSources(),
    // Domain seeds (recruit) — none registered yet in PR 1.
  ];

  await runSeeds({ sources, kind });
}

main().catch((err) => {
  console.error('[db:seed] failed:', err);
  process.exit(1);
});
