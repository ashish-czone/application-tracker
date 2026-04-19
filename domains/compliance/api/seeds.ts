import type { SeedSource, SeedFn } from '@packages/database/seeder';

/**
 * Compliance domain seed sources, split by kind. The cli picks the
 * matching set based on `--kind` so the runner never sees sources
 * of the wrong kind.
 *
 * **System seeds** are load-bearing reference data the compliance
 * domain needs to function — e.g. the `laws` table must hold the
 * known tax/regulatory frameworks (GST, ITR, TDS, ROC, PT) before
 * any client can be registered against them. Without these rows the
 * registration flow is broken, not just empty, so they run on every
 * fresh install as peer-to-migrations.
 *
 * **Demo seeds** are opinionated sample content — demo clients,
 * sample users — that a production install can skip. Packages may
 * not ship demo data; domains own both kinds and keep them in
 * separate registries. See the `feedback_seeds_ownership` rule.
 */
const system = (name: string, load: () => Promise<SeedFn>): SeedSource => ({
  name,
  kind: 'system',
  load,
});

const demo = (name: string, load: () => Promise<SeedFn>): SeedSource => ({
  name,
  kind: 'demo',
  load,
});

export function complianceSystemSeedSources(): SeedSource[] {
  return [
    system('@domains/compliance-api/system-laws', () =>
      import('./laws/seeds/system-laws').then((m) => m.seedSystemLaws),
    ),
  ];
}

export function complianceDemoSeedSources(): SeedSource[] {
  return [
    demo('@domains/compliance-api/demo-laws', () =>
      import('./laws/seeds/demo-laws').then((m) => m.seedDemoLaws),
    ),
    demo('@domains/compliance-api/demo-clients', () =>
      import('./clients/seeds/demo-clients').then((m) => m.seedDemoClients),
    ),
  ];
}
