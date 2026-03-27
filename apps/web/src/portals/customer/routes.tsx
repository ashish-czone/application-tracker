import { lazy } from 'react';
import { TagGroupsListPage, CategoryGroupsListPage } from '@packages/platform-ui-taxonomy';
import { RolesListPage } from '@packages/platform-ui/rbac';
import { AutomationsPage, RuleBuilderPage } from '@packages/platform-ui/notifications';

export { TagGroupsListPage, CategoryGroupsListPage, RolesListPage, AutomationsPage, RuleBuilderPage };

export const UsersListPage = lazy(
  () => import('./features/users/pages/UsersListPage'),
);

export const TasksListPage = lazy(
  () => import('./features/tasks/pages/TasksListPage'),
);

export const WorkflowsListPage = lazy(
  () => import('./features/workflows/pages/WorkflowsListPage'),
);

export const WorkflowEditorPage = lazy(
  () => import('./features/workflows/pages/WorkflowEditorPage'),
);

export const SettingsPage = lazy(
  () => import('./features/settings/pages/SettingsPage'),
);
