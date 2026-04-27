import type { EntityUIConfig } from '@packages/entity-engine-ui';
import { PROJECTS_UI_CONFIG } from './entity-configs/projects.ui';
import { MILESTONES_UI_CONFIG } from './entity-configs/milestones.ui';
import { FEATURES_UI_CONFIG } from './entity-configs/features.ui';
import { TASKS_UI_CONFIG } from './entity-configs/tasks.ui';

export const projectsEntityUIConfigs: EntityUIConfig[] = [
  PROJECTS_UI_CONFIG,
  MILESTONES_UI_CONFIG,
  FEATURES_UI_CONFIG,
  TASKS_UI_CONFIG,
];

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
  useMilestones,
  useCreateMilestone,
  useUpdateMilestone,
  useDeleteMilestone,
  useTransitionMilestone,
  useFeatures,
  useCreateFeature,
  useUpdateFeature,
  useDeleteFeature,
  useTransitionFeature,
  useTasks,
  useMyTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useTransitionTask,
  useTransitionTaskFromMyList,
} from './api/hooks';

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

// Pages — exported here so the host app's main.tsx can mount them as routes.
export { ProjectsDashboardPage } from './pages/ProjectsDashboardPage';
export { ProjectDetailPage } from './pages/ProjectDetailPage';
export { MyTasksPage } from './pages/MyTasksPage';
