import { Inject, Injectable } from '@nestjs/common';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { DatabaseService } from '@packages/database';
import { EntityService, type BaseListQuery } from '@packages/entity-engine';
import type { DataAccessContext } from '@packages/rbac';
import { tasks } from '../schema/tasks';
import { features } from '../schema/features';
import { milestones } from '../schema/milestones';
import { projects } from '../schema/projects';

export interface MyTaskRow {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  featureId: string;
  featureName: string;
  milestoneId: string;
  milestoneName: string;
  projectId: string;
  projectName: string;
  projectColor: string | null;
  projectIcon: string | null;
}

@Injectable()
export class TasksService {
  constructor(
    @Inject('ENTITY_SERVICE_tasks') private readonly entityService: EntityService,
    private readonly database: DatabaseService,
  ) {}

  list(query: BaseListQuery, accessCtx?: DataAccessContext) {
    return this.entityService.list(query, accessCtx);
  }

  findOne(id: string, accessCtx?: DataAccessContext) {
    return this.entityService.findOneOrFail(id, accessCtx);
  }

  create(input: Record<string, unknown>, actorId: string) {
    return this.entityService.create(input, actorId);
  }

  update(id: string, input: Record<string, unknown>, actorId: string, accessCtx?: DataAccessContext) {
    return this.entityService.update(id, input, actorId, accessCtx);
  }

  softDelete(id: string, actorId: string, accessCtx?: DataAccessContext) {
    return this.entityService.softDelete(id, actorId, accessCtx);
  }

  restore(id: string) {
    return this.entityService.restore(id);
  }

  getListLayout() {
    return this.entityService.getListLayout();
  }

  /**
   * Wrap the engine's transition so completedAt flips deterministically with
   * status. Without this, a "task done" mark would update status but leave
   * completedAt stale, breaking the dashboard rollup which keys off the
   * combination. Engine emits the standard StatusChanged event after commit.
   */
  async transition(
    id: string,
    fieldKey: string,
    to: string,
    actorId: string,
    options?: { reason?: string; comment?: string },
    accessCtx?: DataAccessContext,
  ) {
    const result = await this.entityService.transition(id, fieldKey, to, actorId, options, accessCtx);

    if (fieldKey === 'status') {
      const completedAt = to === 'done' ? new Date() : null;
      await this.database.db
        .update(tasks)
        .set({ completedAt })
        .where(eq(tasks.id, id));
      return { ...result, completedAt };
    }
    return result;
  }

  /**
   * Tasks assigned to a given user, joined with feature/milestone/project
   * context so the My Tasks page can group rows by project without N+1
   * round-trips. Excludes soft-deleted tasks and soft-deleted parents.
   */
  async listForAssignee(userId: string): Promise<MyTaskRow[]> {
    const rows = await this.database.db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        dueDate: tasks.dueDate,
        featureId: features.id,
        featureName: features.name,
        milestoneId: milestones.id,
        milestoneName: milestones.name,
        projectId: projects.id,
        projectName: projects.name,
        projectColor: projects.color,
        projectIcon: projects.icon,
      })
      .from(tasks)
      .innerJoin(features, eq(features.id, tasks.featureId))
      .innerJoin(milestones, eq(milestones.id, features.milestoneId))
      .innerJoin(projects, eq(projects.id, milestones.projectId))
      .where(
        and(
          eq(tasks.assigneeId, userId),
          isNull(tasks.deletedAt),
          isNull(features.deletedAt),
          isNull(milestones.deletedAt),
          isNull(projects.deletedAt),
        ),
      )
      .orderBy(sql`${projects.name} ASC`, sql`${tasks.dueDate} ASC NULLS LAST`);

    return rows;
  }
}
