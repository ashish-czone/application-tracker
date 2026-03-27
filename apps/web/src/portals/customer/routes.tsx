import { lazy } from 'react';
import { TagGroupsListPage, CategoryGroupsListPage } from '@packages/platform-ui-taxonomy';
import { RolesListPage } from '@packages/platform-ui/rbac';
import { AutomationsPage, RuleBuilderPage } from '@packages/platform-ui/notifications';
import { WorkflowsListPage, WorkflowEditorPage } from '@packages/platform-ui/workflows';

export { TagGroupsListPage, CategoryGroupsListPage, RolesListPage, AutomationsPage, RuleBuilderPage, WorkflowsListPage, WorkflowEditorPage };

export const UsersListPage = lazy(
  () => import('./features/users/pages/UsersListPage'),
);

export const TasksListPage = lazy(
  () => import('./features/tasks/pages/TasksListPage'),
);

export const SettingsPage = lazy(
  () => import('./features/settings/pages/SettingsPage'),
);
