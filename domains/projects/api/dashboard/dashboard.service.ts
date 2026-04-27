import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { DatabaseService } from '@packages/database';
import { projects } from '../schema/projects';
import { milestones } from '../schema/milestones';
import { features } from '../schema/features';
import { tasks } from '../schema/tasks';

export interface ProjectDashboardCard {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  ownerId: string | null;
  status: string;
  priority: string;
  color: string | null;
  icon: string | null;
  startDate: string | null;
  targetDate: string | null;
  taskCount: number;
  doneTaskCount: number;
  percentComplete: number;
  milestoneCount: number;
  overdueTaskCount: number;
}

export interface ProjectSummaryTask {
  id: string;
  title: string;
  status: string;
  assigneeId: string | null;
  dueDate: string | null;
  sortOrder: number;
}

export interface ProjectSummaryFeature {
  id: string;
  name: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  sortOrder: number;
  percentComplete: number;
  taskCount: number;
  doneTaskCount: number;
  tasks: ProjectSummaryTask[];
}

export interface ProjectSummaryMilestone {
  id: string;
  name: string;
  status: string;
  dueDate: string | null;
  sortOrder: number;
  percentComplete: number;
  taskCount: number;
  doneTaskCount: number;
  features: ProjectSummaryFeature[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  ownerId: string | null;
  status: string;
  priority: string;
  color: string | null;
  icon: string | null;
  startDate: string | null;
  targetDate: string | null;
  percentComplete: number;
  taskCount: number;
  doneTaskCount: number;
  milestones: ProjectSummaryMilestone[];
}

const TASK_DONE = 'done';

function pct(done: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

@Injectable()
export class DashboardService {
  constructor(private readonly database: DatabaseService) {}

  /**
   * One row per live project with rolled-up task counts. Computed live in a
   * single query with two LEFT JOIN aggregations — no materialized columns.
   * `overdueTaskCount` excludes done tasks; due-date comparison uses the DB
   * server's current date, which is fine for an approximate dashboard chip.
   */
  async listDashboard(): Promise<ProjectDashboardCard[]> {
    const todayInDb = sql`CURRENT_DATE`;

    const rows = await this.database.db
      .select({
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        description: projects.description,
        ownerId: projects.ownerId,
        status: projects.status,
        priority: projects.priority,
        color: projects.color,
        icon: projects.icon,
        startDate: projects.startDate,
        targetDate: projects.targetDate,
        milestoneCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${milestones}
          WHERE ${milestones.projectId} = ${projects.id}
            AND ${milestones.deletedAt} IS NULL
        )`,
        taskCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${tasks}
          INNER JOIN ${features} ON ${features.id} = ${tasks.featureId}
          INNER JOIN ${milestones} ON ${milestones.id} = ${features.milestoneId}
          WHERE ${milestones.projectId} = ${projects.id}
            AND ${tasks.deletedAt} IS NULL
            AND ${features.deletedAt} IS NULL
            AND ${milestones.deletedAt} IS NULL
        )`,
        doneTaskCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${tasks}
          INNER JOIN ${features} ON ${features.id} = ${tasks.featureId}
          INNER JOIN ${milestones} ON ${milestones.id} = ${features.milestoneId}
          WHERE ${milestones.projectId} = ${projects.id}
            AND ${tasks.deletedAt} IS NULL
            AND ${features.deletedAt} IS NULL
            AND ${milestones.deletedAt} IS NULL
            AND ${tasks.status} = ${TASK_DONE}
        )`,
        overdueTaskCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${tasks}
          INNER JOIN ${features} ON ${features.id} = ${tasks.featureId}
          INNER JOIN ${milestones} ON ${milestones.id} = ${features.milestoneId}
          WHERE ${milestones.projectId} = ${projects.id}
            AND ${tasks.deletedAt} IS NULL
            AND ${features.deletedAt} IS NULL
            AND ${milestones.deletedAt} IS NULL
            AND ${tasks.status} <> ${TASK_DONE}
            AND ${tasks.dueDate} IS NOT NULL
            AND ${tasks.dueDate} < ${todayInDb}
        )`,
      })
      .from(projects)
      .where(isNull(projects.deletedAt))
      .orderBy(sql`${projects.targetDate} ASC NULLS LAST`, sql`${projects.name} ASC`);

    return rows.map((r) => ({
      ...r,
      percentComplete: pct(r.doneTaskCount, r.taskCount),
    }));
  }

  /**
   * Full project tree — milestones, their features, their tasks — with
   * rolled-up percentComplete at every level. Single fetch per layer rather
   * than an N+1 join, keeping the JSON shape easy to read on the frontend.
   * Soft-deleted children are excluded; the project itself 404s if deleted.
   */
  async getProjectSummary(projectId: string): Promise<ProjectSummary> {
    const projectRow = await this.database.db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
      .limit(1)
      .then((r) => r[0]);

    if (!projectRow) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    const milestoneRows = await this.database.db
      .select()
      .from(milestones)
      .where(and(eq(milestones.projectId, projectId), isNull(milestones.deletedAt)))
      .orderBy(milestones.sortOrder, milestones.id);

    const milestoneIds = milestoneRows.map((m) => m.id);

    const featureRows = milestoneIds.length === 0
      ? []
      : await this.database.db
          .select()
          .from(features)
          .where(
            and(
              isNull(features.deletedAt),
              sql`${features.milestoneId} = ANY(${milestoneIds})`,
            ),
          )
          .orderBy(features.sortOrder, features.id);

    const featureIds = featureRows.map((f) => f.id);

    const taskRows = featureIds.length === 0
      ? []
      : await this.database.db
          .select()
          .from(tasks)
          .where(
            and(
              isNull(tasks.deletedAt),
              sql`${tasks.featureId} = ANY(${featureIds})`,
            ),
          )
          .orderBy(tasks.sortOrder, tasks.id);

    const tasksByFeature = new Map<string, typeof taskRows>();
    for (const t of taskRows) {
      const list = tasksByFeature.get(t.featureId) ?? [];
      list.push(t);
      tasksByFeature.set(t.featureId, list);
    }

    const featuresByMilestone = new Map<string, ProjectSummaryFeature[]>();
    for (const f of featureRows) {
      const fTasks = tasksByFeature.get(f.id) ?? [];
      const doneTaskCount = fTasks.filter((t) => t.status === TASK_DONE).length;
      const featureNode: ProjectSummaryFeature = {
        id: f.id,
        name: f.name,
        status: f.status,
        priority: f.priority,
        assigneeId: f.assigneeId,
        sortOrder: f.sortOrder,
        taskCount: fTasks.length,
        doneTaskCount,
        percentComplete: pct(doneTaskCount, fTasks.length),
        tasks: fTasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          assigneeId: t.assigneeId,
          dueDate: t.dueDate,
          sortOrder: t.sortOrder,
        })),
      };
      const list = featuresByMilestone.get(f.milestoneId) ?? [];
      list.push(featureNode);
      featuresByMilestone.set(f.milestoneId, list);
    }

    let projectTaskTotal = 0;
    let projectTaskDone = 0;

    const milestoneNodes: ProjectSummaryMilestone[] = milestoneRows.map((m) => {
      const mFeatures = featuresByMilestone.get(m.id) ?? [];
      const taskCount = mFeatures.reduce((sum, f) => sum + f.taskCount, 0);
      const doneTaskCount = mFeatures.reduce((sum, f) => sum + f.doneTaskCount, 0);
      projectTaskTotal += taskCount;
      projectTaskDone += doneTaskCount;
      return {
        id: m.id,
        name: m.name,
        status: m.status,
        dueDate: m.dueDate,
        sortOrder: m.sortOrder,
        taskCount,
        doneTaskCount,
        percentComplete: pct(doneTaskCount, taskCount),
        features: mFeatures,
      };
    });

    return {
      id: projectRow.id,
      name: projectRow.name,
      slug: projectRow.slug,
      description: projectRow.description,
      ownerId: projectRow.ownerId,
      status: projectRow.status,
      priority: projectRow.priority,
      color: projectRow.color,
      icon: projectRow.icon,
      startDate: projectRow.startDate,
      targetDate: projectRow.targetDate,
      taskCount: projectTaskTotal,
      doneTaskCount: projectTaskDone,
      percentComplete: pct(projectTaskDone, projectTaskTotal),
      milestones: milestoneNodes,
    };
  }
}
