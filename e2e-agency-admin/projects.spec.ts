import { test, expect, readStoredTokens } from './fixtures/auth';
import { apiClient, resetState, uniqueName, uniqueSlug } from './helpers';

interface ProjectRecord {
  id: string;
  name: string;
  slug: string;
  status: string;
}

interface MilestoneRecord {
  id: string;
  projectId: string;
  name: string;
}

interface FeatureRecord {
  id: string;
  milestoneId: string;
  name: string;
}

interface TaskRecord {
  id: string;
  featureId: string;
  title: string;
  status: string;
  assigneeId: string | null;
}

async function buildProjectTree(opts: {
  projectName: string;
  ownerId: string;
  taskAssigneeId?: string;
  doneTasks?: number;
  todoTasks?: number;
}): Promise<{
  project: ProjectRecord;
  milestone: MilestoneRecord;
  feature: FeatureRecord;
  tasks: TaskRecord[];
}> {
  const project = await apiClient.post<ProjectRecord>('/projects', {
    name: opts.projectName,
    slug: uniqueSlug(opts.projectName),
    ownerId: opts.ownerId,
  });
  const milestone = await apiClient.post<MilestoneRecord>('/milestones', {
    projectId: project.id,
    name: 'Discovery',
  });
  const feature = await apiClient.post<FeatureRecord>('/features', {
    milestoneId: milestone.id,
    name: 'Welcome screen',
  });

  const tasks: TaskRecord[] = [];
  const total = (opts.doneTasks ?? 0) + (opts.todoTasks ?? 0);
  for (let i = 0; i < total; i += 1) {
    const t = await apiClient.post<TaskRecord>('/tasks', {
      featureId: feature.id,
      title: `Task ${i + 1}`,
      assigneeId: opts.taskAssigneeId,
    });
    tasks.push(t);
  }
  for (let i = 0; i < (opts.doneTasks ?? 0); i += 1) {
    await apiClient.post(`/tasks/${tasks[i].id}/transition`, {
      fieldKey: 'status',
      to: 'done',
    });
  }
  return { project, milestone, feature, tasks };
}

test.describe('Projects domain (smoke)', () => {
  test.beforeAll(async () => {
    // Per-spec reset: agency reset re-seeds system + e2e-admin only, so
    // every test starts with zero projects/milestones/features/tasks.
    await resetState();
  });

  test('dashboard renders empty state when there are no projects', async ({ authedPage }) => {
    await authedPage.goto('/projects');
    // Scope to <main> — WebShell's top banner also renders an <h1> with the page title.
    await expect(
      authedPage.getByRole('main').getByRole('heading', { name: 'Projects' }),
    ).toBeVisible();
    // Empty-state quote rendered by EmptyState.
    await expect(
      authedPage.getByText(/A project is just a list of intentions/i),
    ).toBeVisible();
  });

  test('dashboard shows projects created via the API with rolled-up counts', async ({
    authedPage,
  }) => {
    const { userId } = readStoredTokens();
    const projectName = uniqueName('Alpha');
    await buildProjectTree({
      projectName,
      ownerId: userId,
      doneTasks: 2,
      todoTasks: 2,
    });

    await authedPage.goto('/projects');
    // Card renders the project name; rolled-up percent is "50%" for 2/4.
    const card = authedPage.getByText(projectName).first();
    await expect(card).toBeVisible();
    await expect(authedPage.getByText('50%').first()).toBeVisible();
  });

  test('detail page renders milestone → feature → task hierarchy', async ({ authedPage }) => {
    const { userId } = readStoredTokens();
    const projectName = uniqueName('Beta');
    const { project } = await buildProjectTree({
      projectName,
      ownerId: userId,
      todoTasks: 1,
    });

    await authedPage.goto(`/projects/${project.id}`);
    await expect(
      authedPage.getByRole('main').getByRole('heading', { name: projectName }),
    ).toBeVisible();
    // Milestones tab is the default; accordion should expose the seeded names.
    await expect(authedPage.getByText('Discovery').first()).toBeVisible();
  });

  test('My Tasks page lists tasks assigned to the e2e-admin', async ({ authedPage }) => {
    const { userId } = readStoredTokens();
    const projectName = uniqueName('Gamma');
    await buildProjectTree({
      projectName,
      ownerId: userId,
      taskAssigneeId: userId,
      todoTasks: 2,
    });

    await authedPage.goto('/my-tasks');
    await expect(
      authedPage.getByRole('main').getByRole('heading', { name: 'My Tasks' }),
    ).toBeVisible();
    // Project group card renders the project name and at least one task title.
    await expect(authedPage.getByText(projectName).first()).toBeVisible();
    await expect(authedPage.getByText('Task 1').first()).toBeVisible();
  });

  test('main nav exposes Projects and My Tasks links', async ({ authedPage }) => {
    await authedPage.goto('/projects');
    await expect(authedPage.getByRole('link', { name: 'Projects' }).first()).toBeVisible();
    await expect(authedPage.getByRole('link', { name: 'My Tasks' }).first()).toBeVisible();
  });
});
