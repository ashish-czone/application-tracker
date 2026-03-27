import { lazy } from 'react';
import { TagGroupsListPage, CategoryGroupsListPage } from '@packages/platform-ui-taxonomy';
import { RolesListPage } from '@packages/platform-ui/rbac';

export { TagGroupsListPage, CategoryGroupsListPage, RolesListPage };

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

export const AutomationsPage = lazy(
  () => import('./features/automations/pages/AutomationsPage'),
);

export const RuleBuilderPage = lazy(
  () => import('./features/automations/pages/RuleBuilderPage'),
);

export const SettingsPage = lazy(
  () => import('./features/settings/pages/SettingsPage'),
);
