import type { ApiFn } from '@packages/platform-ui';
import type {
  CreateFeatureInput,
  CreateMilestoneInput,
  CreateProjectInput,
  CreateTaskInput,
  FeatureRecord,
  MilestoneRecord,
  MyTaskRow,
  Paginated,
  ProjectDashboardCard,
  ProjectRecord,
  ProjectSummary,
  TaskRecord,
} from '../types';

/**
 * The CRUD routes for projects/milestones/features/tasks come from the
 * hand-written controllers backed by entity-engine. Custom endpoints:
 *   GET /projects-dashboard          rolled-up cards
 *   GET /projects-dashboard/:id/summary  full tree with rollup
 *   GET /tasks/mine                  current user's tasks
 *   POST /<entity>/:id/transition    workflow transition
 */
export function createProjectsApi(api: ApiFn) {
  return {
    // ---- Dashboard / Summary ----
    listDashboard(): Promise<ProjectDashboardCard[]> {
      return api.get('/projects-dashboard');
    },
    getProjectSummary(id: string): Promise<ProjectSummary> {
      return api.get(`/projects-dashboard/${id}/summary`);
    },

    // ---- Projects ----
    listProjects(opts: { search?: string; status?: string; includeDeleted?: boolean } = {}): Promise<Paginated<ProjectRecord>> {
      const qs = new URLSearchParams();
      if (opts.search) qs.set('search', opts.search);
      if (opts.status) qs.set('status', opts.status);
      if (opts.includeDeleted) qs.set('includeDeleted', 'true');
      qs.set('limit', '200');
      const q = qs.toString();
      return api.get(`/projects${q ? `?${q}` : ''}`);
    },
    getProject(id: string): Promise<ProjectRecord> {
      return api.get(`/projects/${id}`);
    },
    createProject(input: CreateProjectInput): Promise<ProjectRecord> {
      return api.post('/projects', input);
    },
    updateProject(id: string, input: Partial<CreateProjectInput>): Promise<ProjectRecord> {
      return api.patch(`/projects/${id}`, input);
    },
    deleteProject(id: string): Promise<void> {
      return api.delete(`/projects/${id}`);
    },
    restoreProject(id: string): Promise<ProjectRecord> {
      return api.post(`/projects/${id}/restore`);
    },
    transitionProject(id: string, to: string): Promise<ProjectRecord> {
      return api.post(`/projects/${id}/transition`, { fieldKey: 'status', to });
    },

    // ---- Milestones ----
    listMilestones(projectId: string): Promise<Paginated<MilestoneRecord>> {
      const qs = new URLSearchParams({ projectId, limit: '500' });
      return api.get(`/milestones?${qs}`);
    },
    createMilestone(input: CreateMilestoneInput): Promise<MilestoneRecord> {
      return api.post('/milestones', input);
    },
    updateMilestone(id: string, input: Partial<CreateMilestoneInput>): Promise<MilestoneRecord> {
      return api.patch(`/milestones/${id}`, input);
    },
    deleteMilestone(id: string): Promise<void> {
      return api.delete(`/milestones/${id}`);
    },
    transitionMilestone(id: string, to: string): Promise<MilestoneRecord> {
      return api.post(`/milestones/${id}/transition`, { fieldKey: 'status', to });
    },

    // ---- Features ----
    listFeatures(milestoneId: string): Promise<Paginated<FeatureRecord>> {
      const qs = new URLSearchParams({ milestoneId, limit: '500' });
      return api.get(`/features?${qs}`);
    },
    createFeature(input: CreateFeatureInput): Promise<FeatureRecord> {
      return api.post('/features', input);
    },
    updateFeature(id: string, input: Partial<CreateFeatureInput>): Promise<FeatureRecord> {
      return api.patch(`/features/${id}`, input);
    },
    deleteFeature(id: string): Promise<void> {
      return api.delete(`/features/${id}`);
    },
    transitionFeature(id: string, to: string): Promise<FeatureRecord> {
      return api.post(`/features/${id}/transition`, { fieldKey: 'status', to });
    },

    // ---- Tasks ----
    listTasks(opts: { featureId?: string; assigneeId?: string; includeDeleted?: boolean } = {}): Promise<Paginated<TaskRecord>> {
      const qs = new URLSearchParams();
      if (opts.featureId) qs.set('featureId', opts.featureId);
      if (opts.assigneeId) qs.set('assigneeId', opts.assigneeId);
      if (opts.includeDeleted) qs.set('includeDeleted', 'true');
      qs.set('limit', '500');
      return api.get(`/tasks?${qs}`);
    },
    listMyTasks(): Promise<MyTaskRow[]> {
      return api.get('/tasks/mine');
    },
    getTask(id: string): Promise<TaskRecord> {
      return api.get(`/tasks/${id}`);
    },
    createTask(input: CreateTaskInput): Promise<TaskRecord> {
      return api.post('/tasks', input);
    },
    updateTask(id: string, input: Partial<CreateTaskInput>): Promise<TaskRecord> {
      return api.patch(`/tasks/${id}`, input);
    },
    deleteTask(id: string): Promise<void> {
      return api.delete(`/tasks/${id}`);
    },
    transitionTask(id: string, to: string): Promise<TaskRecord & { completedAt: string | null }> {
      return api.post(`/tasks/${id}/transition`, { fieldKey: 'status', to });
    },
  };
}

export type ProjectsUiApi = ReturnType<typeof createProjectsApi>;
