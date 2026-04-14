import type { DomainWebManifest } from '@packages/domains';

/**
 * Compliance domain UI manifest. The compliance app currently has no
 * domain-specific frontend features — the platform shell handles all routes
 * (entity engine, settings, automations, users, ...). Domain features (a
 * compliance dashboard, custom detail pages, etc.) will be added here.
 */
export const complianceWeb: DomainWebManifest = {
  name: 'compliance',
  displayName: 'Compliance',
  routes: [],
  detailPageOverrides: {},
  menuItems: [],
  entityUIConfigs: [],
};
