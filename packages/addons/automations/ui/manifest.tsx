import { Bell } from 'lucide-react';
import type { WebFeatureManifest } from '@packages/domains';
import { AutomationsPage } from './pages/AutomationsPage';
import { RuleBuilderPage } from './pages/RuleBuilderPage';

/**
 * Frontend manifest for the automations addon. Mounts the automations list
 * + rule builder admin routes and contributes a top-level sidebar entry.
 */
export const automationsWeb: WebFeatureManifest = {
  name: 'automations',
  routes: [
    { path: '/automations', element: <AutomationsPage /> },
    { path: '/automations/create', element: <RuleBuilderPage /> },
    { path: '/automations/:id/edit', element: <RuleBuilderPage /> },
  ],
  menuItems: [
    {
      path: '/automations',
      label: 'Automations',
      icon: Bell,
      permission: 'automations.rules.read',
      position: 'after',
    },
  ],
};
