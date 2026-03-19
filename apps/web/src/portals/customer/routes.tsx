import { lazy } from 'react';

export const UsersListPage = lazy(
  () => import('./features/users/pages/UsersListPage'),
);

export const RolesListPage = lazy(
  () => import('./features/rbac/pages/RolesListPage'),
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
