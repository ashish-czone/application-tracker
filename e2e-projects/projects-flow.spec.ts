import { test, expect } from './fixtures/auth';
import { apiClient, resetState } from './helpers';

interface CreatedRow { id: string }

interface DashboardCard {
  id: string;
  name: string;
  taskCount: number;
  doneTaskCount: number;
  percentComplete: number;
}

/**
 * Happy path for the projects domain: create a project → milestone → feature →
 * task via the API, then mark the task `done` and assert the dashboard rollup
 * recomputes (1/1 done = 100%). Drives the API for setup so each assertion is
 * deterministic; the UI-driven flows live in separate specs.
 */
test.describe('Projects domain — create-and-rollup flow', () => {
  test.beforeAll(async () => {
    await resetState();
  });

  test('project rollup updates as a task transitions to done', async () => {
    const slug = `e2e-demo-${Date.now()}`;
    const project = await apiClient.post<CreatedRow>('/projects', {
      name: 'E2E Demo Project',
      slug,
    });
    expect(project.id).toBeTruthy();

    const milestone = await apiClient.post<CreatedRow>('/milestones', {
      name: 'Milestone 1',
      projectId: project.id,
    });

    const feature = await apiClient.post<CreatedRow>('/features', {
      name: 'Feature 1',
      milestoneId: milestone.id,
    });

    const task = await apiClient.post<CreatedRow>('/tasks', {
      title: 'Task 1',
      featureId: feature.id,
    });

    // Before completion: 1 task open, 0 done.
    let cards = await apiClient.get<DashboardCard[]>('/projects-dashboard');
    let card = cards.find((c) => c.id === project.id);
    expect(card).toBeDefined();
    expect(card!.taskCount).toBe(1);
    expect(card!.doneTaskCount).toBe(0);
    expect(card!.percentComplete).toBe(0);

    // Drive the workflow: todo → in_progress → done.
    await apiClient.post(`/tasks/${task.id}/transition`, {
      fieldKey: 'status',
      to: 'in_progress',
    });
    await apiClient.post(`/tasks/${task.id}/transition`, {
      fieldKey: 'status',
      to: 'done',
    });

    cards = await apiClient.get<DashboardCard[]>('/projects-dashboard');
    card = cards.find((c) => c.id === project.id);
    expect(card).toBeDefined();
    expect(card!.taskCount).toBe(1);
    expect(card!.doneTaskCount).toBe(1);
    expect(card!.percentComplete).toBe(100);
  });

  test('UI dashboard surfaces the seeded project card', async ({ authedPage }) => {
    await authedPage.goto('/projects');
    await expect(authedPage.getByText('E2E Demo Project')).toBeVisible();
    // Card shows the rolled-up percentage; assert it reached 100% from the
    // previous test's transition. Card text is something like "1 of 1 · 100%".
    await expect(authedPage.getByText(/100%/).first()).toBeVisible();
  });
});
