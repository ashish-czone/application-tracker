import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService, and, eq } from '@packages/database';
import { EntityService, type BaseListQuery } from '@packages/entity-engine';
import type { DataAccessContext } from '@packages/rbac';
import { tasks } from '../schema/tasks';
import type { CreateTaskDto, UpdateTaskDto } from '../dto/tasks.dto';

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

  create(input: CreateTaskDto, actorId: string) {
    return this.entityService.create(input, actorId);
  }

  update(id: string, input: UpdateTaskDto, actorId: string, accessCtx?: DataAccessContext) {
    return this.entityService.update(id, input, actorId, accessCtx);
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
}
