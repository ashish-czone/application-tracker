import { lazy } from 'react';
import type { RouteObject } from 'react-router';
import type { DomainWebManifest } from '@packages/domains';

const ConsolePreviewPage = lazy(() =>
  import('./portals/customer/features/console-preview').then((m) => ({
    default: m.ConsolePreviewPage,
  })),
);

/**
 * Compliance domain UI manifest. The `console-preview` route is a static
 * design-review surface showing the Instrument kit in context — not wired
 * to live data. See `design-directions.md` for the aesthetic rationale.
 */
const routes: RouteObject[] = [
  { path: '/console-preview', element: <ConsolePreviewPage /> },
];

export const complianceWeb: DomainWebManifest = {
  name: 'compliance',
  displayName: 'Compliance',
  routes,
  detailPageOverrides: {},
  menuItems: [],
  entityUIConfigs: [],
};
