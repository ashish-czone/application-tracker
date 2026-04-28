import type {
  DomainRouteObject,
  DomainWebManifest,
  MenuItem,
} from '@packages/domains';
import type { ColumnRendererRegistration, EntityUIConfig } from '@packages/entity-engine-ui';
import { FolderKanban, CheckSquare } from 'lucide-react';

import { PROJECTS_UI_CONFIG } from './entity-configs/projects.ui';
import { MILESTONES_UI_CONFIG } from './entity-configs/milestones.ui';
import { FEATURES_UI_CONFIG } from './entity-configs/features.ui';
import { TASKS_UI_CONFIG } from './entity-configs/tasks.ui';

import { ProjectsDashboardPage } from './portals/team/features/dashboard/ProjectsDashboardPage';
import { ProjectDetailPage } from './portals/team/features/projects/ProjectDetailPage';
import { MyTasksPage } from './portals/team/features/my-tasks/MyTasksPage';
import { taskStatusInlineRenderer } from './components/TaskStatusInlineRenderer';

export const projectsEntityUIConfigs: EntityUIConfig[] = [
  PROJECTS_UI_CONFIG,
  MILESTONES_UI_CONFIG,
  FEATURES_UI_CONFIG,
  TASKS_UI_CONFIG,
];

/**
 * Cell renderers contributed by this domain. Pass via
 * `<WebShell extraColumnRenderers={projectsColumnRenderers} />`.
 */
export const projectsColumnRenderers: Record<string, ColumnRendererRegistration> = {
  TaskStatusInline: taskStatusInlineRenderer,
};

const routes: DomainRouteObject[] = [
  // /projects claims the `projects` slug, replacing the auto-generated entity
  // list with the dashboard. Milestones/features/tasks slugs are unclaimed,
  // so their auto-generated CRUD pages remain available.
  { path: '/projects',      element: <ProjectsDashboardPage />, permission: 'projects.read' },
  { path: '/projects/:id',  element: <ProjectDetailPage />,     permission: 'projects.read' },
  { path: '/my-tasks',      element: <MyTasksPage />,           permission: 'my-tasks.read' },
];

const menuItems: MenuItem[] = [
  { path: '/projects',  label: 'Projects',  icon: FolderKanban, permission: 'projects.read', position: 'before' },
  { path: '/my-tasks',  label: 'My Tasks',  icon: CheckSquare,  permission: 'my-tasks.read', position: 'before' },
];

export const projectsWeb: DomainWebManifest = {
  name: 'projects',
  displayName: 'Projects',
  routes,
  menuItems,
  entityUIConfigs: projectsEntityUIConfigs,
};

export {
  PROJECTS_UI_CONFIG,
  MILESTONES_UI_CONFIG,
  FEATURES_UI_CONFIG,
  TASKS_UI_CONFIG,
};

// API + hooks
export { createProjectsApi, type ProjectsUiApi } from './api/services';
export {
  useProjectsDashboard,
  useProjectSummary,
  useProjects,
  useProject,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useTransitionProject,
} from './hooks/useProjectsApi';
export {
  useMilestones,
  useCreateMilestone,
  useUpdateMilestone,
  useDeleteMilestone,
  useTransitionMilestone,
} from './hooks/useMilestonesApi';
export {
  useFeatures,
  useCreateFeature,
  useUpdateFeature,
  useDeleteFeature,
  useTransitionFeature,
} from './hooks/useFeaturesApi';
export {
  useTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useTransitionTask,
} from './hooks/useTasksApi';
export { useMyTasks, useTransitionTaskFromMyList } from './hooks/useMyTasksApi';

// Types
export type {
  ProjectStatus,
  MilestoneStatus,
  FeatureStatus,
  TaskStatus,
  Priority,
  ProjectRecord,
  MilestoneRecord,
  FeatureRecord,
  TaskRecord,
  ProjectDashboardCard,
  ProjectSummary,
  ProjectSummaryMilestone,
  ProjectSummaryFeature,
  ProjectSummaryTask,
  MyTaskRow,
  Paginated,
  CreateProjectInput,
  CreateMilestoneInput,
  CreateFeatureInput,
  CreateTaskInput,
} from './types';

// Pages — exported for consumers that need to embed them outside the manifest.
export { ProjectsDashboardPage, ProjectDetailPage, MyTasksPage };
