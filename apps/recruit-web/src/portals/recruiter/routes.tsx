import { lazy } from 'react';
import { TagGroupsListPage, CategoryGroupsListPage } from '@packages/platform-ui-taxonomy';
import { RolesListPage } from '@packages/platform-ui/rbac';
import { AutomationsPage } from '@packages/platform-ui/notifications';
import { RuleBuilderPage } from '@packages/platform-ui/automations';
import { UsersListPage } from '@packages/platform-ui/users';
import { SettingsPage as AppSettingsPage } from '@packages/platform-ui/settings';
import { OrgPositionsPage } from '@packages/platform-ui/org-positions';

export { TagGroupsListPage, CategoryGroupsListPage, RolesListPage, AutomationsPage, RuleBuilderPage, UsersListPage, AppSettingsPage, OrgPositionsPage };

// Candidates list/detail are now rendered by EntityListPage/EntityDetailPage
// via the entity engine — no lazy imports needed

export const SettingsPage = lazy(
  () => import('./features/settings/pages/SettingsPage'),
);

export { QueueDashboardPage as QueuedTasksPage } from '@packages/platform-ui/queue-dashboard';
