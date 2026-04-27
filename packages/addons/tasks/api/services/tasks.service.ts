import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService, and, eq, inArray, not } from '@packages/database';
import { EntityService, type BaseListQuery } from '@packages/entity-engine';
import type { DataAccessContext } from '@packages/rbac';
import { tasks } from '../schema/tasks';
import { applyCompletedAt } from '../tasks.config';
import type { CreateTaskDto, UpdateTaskDto } from '../dto/tasks.dto';
import {
  TaskActionsService,
  type TaskActionsUser,
  type TaskRowForActions,
} from './task-actions.service';

const TERMINAL_STATUSES = ['completed', 'cancelled'];

@Injectable()
export class TasksService {
  constructor(
    @Inject('ENTITY_SERVICE_tasks') private readonly entityService: EntityService,
    private readonly database: DatabaseService,
    private readonly taskActions: TaskActionsService,
  ) {}

  async list(query: BaseListQuery, accessCtx?: DataAccessContext, user?: TaskActionsUser) {
    const page = await this.entityService.list(query, accessCtx);
    if (!user) return page;
    const annotated = await this.taskActions.computeAllowedActionsForMany(
      page.data as unknown as TaskRowForActions[],
      user,
    );
    return {
      ...page,
      data: page.data.map((row) => ({
        ...row,
        allowedActions: annotated.get((row as { id: string }).id) ?? [],
      })),
    };
  }

  async findOne(id: string, accessCtx?: DataAccessContext, user?: TaskActionsUser) {
    const row = await this.entityService.findOneOrFail(id, accessCtx);
    if (!user) return row;
    const allowedActions = await this.taskActions.computeAllowedActions(
      row as unknown as TaskRowForActions,
      user,
    );
    return { ...row, allowedActions };
  }

  create(input: CreateTaskDto, actorId: string) {
    return this.entityService.create(applyCompletedAt(input as Record<string, unknown>), actorId);
  }

  update(id: string, input: UpdateTaskDto, actorId: string, accessCtx?: DataAccessContext) {
    return this.entityService.update(id, applyCompletedAt(input as Record<string, unknown>), actorId, accessCtx);
  }

  softDelete(id: string, actorId: string, accessCtx?: DataAccessContext) {
    return this.entityService.softDelete(id, actorId, accessCtx);
  }

  clone(id: string, actorId: string) {
    return this.entityService.clone(id, actorId);
  }

  restore(id: string) {
    return this.entityService.restore(id);
  }

  getListLayout() {
    return this.entityService.getListLayout();
  }

  /**
   * Idempotency lookup for automation-generated tasks. Callers pass the
   * `relatedEntityType` the task is attached to and the format-stable
   * `externalKey` they minted; a match returns the existing task id so
   * the caller can skip re-creation. Scoped by related entity type so
   * two domains can mint the same string without colliding.
   */
  async findByExternalKey(relatedEntityType: string, externalKey: string): Promise<{ id: string } | null> {
    const rows = await this.database.db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.relatedEntityType, relatedEntityType), eq(tasks.externalKey, externalKey)))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Null `assigneeId` on every open task owned by the given user. Called
   * synchronously from the app's UsersService.softDelete override so the
   * cleanup runs in the same flow as the user deactivation. Terminal-state
   * tasks (completed, cancelled) keep their original assignee for audit.
   * `assigneeTeamId` stays intact so the task falls back to team-level
   * pickup. Idempotent — second call updates zero rows.
   */
  async handleUserDeactivated(userId: string): Promise<{ clearedCount: number }> {
    const cleared = await this.database.db
      .update(tasks)
      .set({ assigneeId: null })
      .where(and(
        eq(tasks.assigneeId, userId),
        not(inArray(tasks.status, TERMINAL_STATUSES)),
      ))
      .returning({ id: tasks.id });
    return { clearedCount: cleared.length };
  }
}
