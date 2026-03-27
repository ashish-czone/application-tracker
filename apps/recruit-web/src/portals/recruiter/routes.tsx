import { lazy } from 'react';
import { TagGroupsListPage, CategoryGroupsListPage } from '@packages/platform-ui-taxonomy';
import { RolesListPage } from '@packages/platform-ui/rbac';
import { AutomationsPage, RuleBuilderPage } from '@packages/platform-ui/notifications';
import { UsersListPage } from '@packages/platform-ui/users';

export { TagGroupsListPage, CategoryGroupsListPage, RolesListPage, AutomationsPage, RuleBuilderPage, UsersListPage };

// Candidates list/detail are now rendered by EntityListPage/EntityDetailPage
// via the entity engine — no lazy imports needed

export const SettingsPage = lazy(
  () => import('./features/settings/pages/SettingsPage'),
);
