#!/usr/bin/env tsx
/**
 * gen-entity CLI entry.
 *
 * Usage:
 *   pnpm gen:entity <entity> --domain <domain> [--init]
 */

import { parseArgs } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './generator';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    options: {
      domain: { type: 'string' },
      init: { type: 'boolean', default: false },
    },
    allowPositionals: true,
  });

  const entitySlug = positionals[0];
  if (!entitySlug) {
    console.error('Error: missing positional <entity> argument');
    console.error('Usage: pnpm gen:entity <entity> --domain <domain> [--init]');
    process.exit(1);
  }
  if (!values.domain) {
    console.error('Error: --domain is required');
    process.exit(1);
  }

  // Resolve repo root from this file's location: tools/gen-entity/index.ts → repo root is two up.
  const repoRoot = resolve(__dirname, '..', '..');

  try {
    await run({
      entitySlug,
      domain: values.domain,
      init: values.init,
      repoRoot,
    });
  } catch (err) {
    console.error(`gen:entity failed: ${(err as Error).message}`);
    process.exit(1);
  }
}

main();
