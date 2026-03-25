import { lazy } from 'react';

// Candidates list/detail are now rendered by EntityListPage/EntityDetailPage
// via the entity engine — no lazy imports needed

export const SettingsPage = lazy(
  () => import('./features/settings/pages/SettingsPage'),
);

export const AutomationsPage = lazy(
  () => import('./features/automations/pages/AutomationsPage'),
);

export const RuleBuilderPage = lazy(
  () => import('./features/automations/pages/RuleBuilderPage'),
);

export const RolesListPage = lazy(
  () => import('./features/rbac/pages/RolesListPage'),
);
