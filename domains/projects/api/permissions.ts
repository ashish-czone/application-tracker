import type { PermissionManifest } from '@packages/rbac';

// CRUD perms for projects/milestones/features/tasks are auto-registered by
// EntityEngineModule.forEntity(). The manifests below cover non-entity UI
// surfaces — currently the dashboard/summary aggregations and the My Tasks
// page. Keep slugs in sync with route-level permissions in the UI manifest.
export const PROJECTS_PERMISSIONS = {
  DASHBOARD_READ: 'projects-dashboard.read',
  MY_TASKS_READ: 'my-tasks.read',
} as const;

export type ProjectsPermission =
  (typeof PROJECTS_PERMISSIONS)[keyof typeof PROJECTS_PERMISSIONS];

export const PROJECTS_PERMISSION_MANIFESTS: PermissionManifest[] = [
  { slug: 'projects-dashboard.read', module: 'projects-dashboard', action: 'read', label: 'View projects dashboard', description: 'View the projects dashboard with rolled-up progress', supportedScopes: ['any'] },
  { slug: 'my-tasks.read',           module: 'my-tasks',           action: 'read', label: 'View My Tasks',           description: 'View tasks assigned to me across all projects',  supportedScopes: ['any'] },
];
