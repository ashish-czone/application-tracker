import { randomUUID } from 'crypto';
import type { DrizzleDB } from '@packages/database';
import { users } from '@packages/database';
import { projects } from '../../schema/projects';
import { milestones } from '../../schema/milestones';
import { features } from '../../schema/features';
import { tasks } from '../../schema/tasks';

/**
 * Direct-insert fixtures for projects integration tests. Bypasses the
 * entity-engine service layer (and its beforeCreate hooks) because these
 * are *prereqs* for the entity under test — each test exercises the
 * target HTTP endpoint itself. Fixture rows carry the minimum fields
 * needed to satisfy NOT-NULL + FK constraints.
 */

let seq = 0;
const unique = (prefix: string) => `${prefix}-${Date.now()}-${++seq}`;

export async function createUser(
  db: DrizzleDB,
  overrides: Partial<typeof users.$inferInsert> = {},
): Promise<{ id: string }> {
  const id = overrides.id ?? randomUUID();
  await db.insert(users).values({
    id,
    email: overrides.email ?? `${unique('user')}@example.com`,
    firstName: overrides.firstName ?? 'Test',
    lastName: overrides.lastName ?? 'User',
    userType: overrides.userType ?? 'admin',
    ...overrides,
  });
  return { id };
}

export async function createProject(
  db: DrizzleDB,
  createdBy: string,
  overrides: Partial<typeof projects.$inferInsert> = {},
): Promise<{ id: string; slug: string }> {
  const id = overrides.id ?? randomUUID();
  const slug = overrides.slug ?? unique('project');
  await db.insert(projects).values({
    id,
    name: overrides.name ?? `Project ${slug}`,
    slug,
    status: overrides.status ?? 'planning',
    priority: overrides.priority ?? 'medium',
    createdBy,
    ...overrides,
  });
  return { id, slug };
}

export async function createMilestone(
  db: DrizzleDB,
  projectId: string,
  createdBy: string,
  overrides: Partial<typeof milestones.$inferInsert> = {},
): Promise<{ id: string }> {
  const id = overrides.id ?? randomUUID();
  await db.insert(milestones).values({
    id,
    projectId,
    name: overrides.name ?? unique('Milestone'),
    status: overrides.status ?? 'pending',
    sortOrder: overrides.sortOrder ?? 0,
    createdBy,
    ...overrides,
  });
  return { id };
}

export async function createFeature(
  db: DrizzleDB,
  milestoneId: string,
  createdBy: string,
  overrides: Partial<typeof features.$inferInsert> = {},
): Promise<{ id: string }> {
  const id = overrides.id ?? randomUUID();
  await db.insert(features).values({
    id,
    milestoneId,
    name: overrides.name ?? unique('Feature'),
    status: overrides.status ?? 'backlog',
    priority: overrides.priority ?? 'medium',
    sortOrder: overrides.sortOrder ?? 0,
    createdBy,
    ...overrides,
  });
  return { id };
}

export async function createTask(
  db: DrizzleDB,
  featureId: string,
  createdBy: string,
  overrides: Partial<typeof tasks.$inferInsert> = {},
): Promise<{ id: string }> {
  const id = overrides.id ?? randomUUID();
  await db.insert(tasks).values({
    id,
    featureId,
    title: overrides.title ?? unique('Task'),
    status: overrides.status ?? 'todo',
    sortOrder: overrides.sortOrder ?? 0,
    createdBy,
    ...overrides,
  });
  return { id };
}

/**
 * Convenience: builds a full project tree (1 project → 1 milestone →
 * 1 feature → N tasks). Returns the IDs at every level so tests can
 * target deep nodes without re-creating the prereqs each time.
 */
export async function createProjectTree(
  db: DrizzleDB,
  createdBy: string,
  taskCount = 3,
): Promise<{
  projectId: string;
  milestoneId: string;
  featureId: string;
  taskIds: string[];
}> {
  const project = await createProject(db, createdBy);
  const milestone = await createMilestone(db, project.id, createdBy);
  const feature = await createFeature(db, milestone.id, createdBy);
  const taskIds: string[] = [];
  for (let i = 0; i < taskCount; i++) {
    const t = await createTask(db, feature.id, createdBy, { sortOrder: i });
    taskIds.push(t.id);
  }
  return {
    projectId: project.id,
    milestoneId: milestone.id,
    featureId: feature.id,
    taskIds,
  };
}
