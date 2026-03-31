import { lazy } from 'react';
import { TagGroupsListPage, CategoryGroupsListPage } from '@packages/platform-ui-taxonomy';
import { RolesListPage } from '@packages/platform-ui/rbac';
import { AutomationsPage, RuleBuilderPage } from '@packages/platform-ui/notifications';
import { UsersListPage } from '@packages/platform-ui/users';
import { SettingsPage as AppSettingsPage } from '@packages/platform-ui/settings';

export { TagGroupsListPage, CategoryGroupsListPage, RolesListPage, AutomationsPage, RuleBuilderPage, UsersListPage, AppSettingsPage };

// Candidates list/detail are now rendered by EntityListPage/EntityDetailPage
// via the entity engine — no lazy imports needed

export const SettingsPage = lazy(
  () => import('./features/settings/pages/SettingsPage'),
);

export const QueuedTasksPage = lazy(
  () => import('./features/queued-tasks/QueuedTasksPage').then((m) => ({ default: m.QueuedTasksPage })),
);
