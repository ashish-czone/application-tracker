import { lazy } from 'react';
import { TagGroupsListPage, CategoryGroupsListPage } from '@packages/taxonomy-ui';
import { RolesListPage } from '@packages/rbac-ui';
import { AutomationsPage, RuleBuilderPage } from '@packages/automations-ui';
import { UsersListPage } from '@packages/users-ui';
import { SettingsPage as AppSettingsPage } from '@packages/settings-ui';
import { OrgPositionsPage } from '@packages/org-units-ui';
import { OrgUnitsPage } from '@packages/org-units-ui';

export { TagGroupsListPage, CategoryGroupsListPage, RolesListPage, AutomationsPage, RuleBuilderPage, UsersListPage, AppSettingsPage, OrgPositionsPage, OrgUnitsPage };

// Candidates list/detail are now rendered by EntityListPage/EntityDetailPage
// via the entity engine — no lazy imports needed

export const SettingsPage = lazy(
  () => import('./features/settings/pages/SettingsPage'),
);

export const AppearancePage = lazy(
  () => import('@packages/theming-ui').then((m) => ({ default: m.AppearancePage })),
);

export { QueueDashboardPage as QueuedTasksPage } from '@packages/queue-ui';
