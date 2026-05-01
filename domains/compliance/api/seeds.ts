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

/**
 * Single seed source for the e2e-admin user. Consumed by the
 * compliance app's test-hooks reset endpoint, which reseeds a
 * minimal "system + e2e-admin" set rather than the full demo set.
 * Lives outside `complianceDemoSeedSources()` so the test-hooks
 * caller doesn't pull in opinionated demo content (clients, rules,
 * filings) that would conflict with test-created entities.
 */
export function complianceE2eAdminSeedSource(): SeedSource {
  return demo('@domains/compliance-api/demo-e2e-admin', () =>
    import('./users/seeds/demo-e2e-admin').then((m) => m.seedDemoE2eAdmin),
  );
}

export function complianceSystemSeedSources(): SeedSource[] {
  return [
    system('@domains/compliance-api/system-laws', () =>
      import('./laws/laws.system.seeds').then((m) => m.seedSystemLaws),
    ),
    system('@domains/compliance-api/system-organization', () =>
      import('./organizations/seeds/system-organization').then((m) => m.seedSystemOrganization),
    ),
    system('@domains/compliance-api/system-roles', () =>
      import('./shared/seeds/system-roles').then((m) => m.seedSystemRoles),
    ),
    system('@domains/compliance-api/system-positions', () =>
      import('./shared/seeds/system-positions').then((m) => m.seedSystemPositions),
    ),
    system('@domains/compliance-api/system-generator-cron', () =>
      import('./automations/seeds/system-generator-cron').then((m) => m.seedComplianceGeneratorCron),
    ),
    system('@domains/compliance-api/system-automations', () =>
      import('./automations/seeds/system-automations').then((m) => m.seedComplianceSystemAutomations),
    ),
  ];
}

export function complianceDemoSeedSources(): SeedSource[] {
  return [
    demo('@domains/compliance-api/demo-global-sets', () =>
      import('./shared/seeds/global-sets').then((m) => m.seedGlobalSets),
    ),
    demo('@domains/compliance-api/demo-laws', () =>
      import('./laws/laws.demo.seeds').then((m) => m.seedDemoLaws),
    ),
    demo('@domains/compliance-api/demo-clients', () =>
      import('./clients/clients.seeds').then((m) => m.seedDemoClients),
    ),
    demo('@domains/compliance-api/demo-users', () =>
      import('./users/seeds/demo-users').then((m) => m.seedDemoUsers),
    ),
    demo('@domains/compliance-api/demo-e2e-admin', () =>
      import('./users/seeds/demo-e2e-admin').then((m) => m.seedDemoE2eAdmin),
    ),
    demo('@domains/compliance-api/demo-user-roles', () =>
      import('./users/seeds/demo-user-roles').then((m) => m.seedDemoUserRoles),
    ),
    demo('@domains/compliance-api/demo-law-handlers', () =>
      import('./law-handlers/seeds/demo-law-handlers').then((m) => m.seedDemoLawHandlers),
    ),
    demo('@domains/compliance-api/demo-rules', () =>
      import('./rules/rules.seeds').then((m) => m.seedDemoRules),
    ),
    demo('@domains/compliance-api/demo-client-registrations', () =>
      import('./client-registrations/client-registrations.seeds').then(
        (m) => m.seedDemoClientRegistrations,
      ),
    ),
    demo('@domains/compliance-api/demo-filings', () =>
      import('./compliance-filings/compliance-filings.seeds').then((m) => m.seedDemoFilings),
    ),
    demo('@domains/compliance-api/demo-org-hierarchy', () =>
      import('./shared/seeds/demo-org-hierarchy').then((m) => m.seedDemoOrgHierarchy),
    ),
    demo('@domains/compliance-api/demo-notifications', () =>
      import('./notifications/seeds/demo-notifications').then((m) => m.seedDemoNotifications),
    ),
  ];
}
