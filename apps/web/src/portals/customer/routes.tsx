import { lazy } from 'react';
import { TagGroupsListPage, CategoryGroupsListPage } from '@packages/platform-ui-taxonomy';
import { RolesListPage } from '@packages/platform-ui/rbac';
import { AutomationsPage, RuleBuilderPage } from '@packages/platform-ui/notifications';
import { WorkflowsListPage, WorkflowEditorPage } from '@packages/platform-ui/workflows';
import { SettingsPage } from '@packages/platform-ui/settings';
import { TasksListPage } from '@packages/platform-ui/tasks';

export { TagGroupsListPage, CategoryGroupsListPage, RolesListPage, AutomationsPage, RuleBuilderPage, WorkflowsListPage, WorkflowEditorPage, SettingsPage, TasksListPage };

export const UsersListPage = lazy(
  () => import('./features/users/pages/UsersListPage'),
);
