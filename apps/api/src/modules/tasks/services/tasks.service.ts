import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, eq, and, or, isNull, ilike, asc, desc, count, tasks } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { WorkflowEngineService, WorkflowRegistryService, type AvailableTransition } from '@packages/workflows';
import type { PaginatedResponse } from '@packages/common';
import { TASKS_TASK_CREATED, TASKS_TASK_UPDATED, TASKS_TASK_DELETED } from '../events/types';

const TASK_WORKFLOW_SLUG = 'task-status';

export interface TaskResponse {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  dueDate: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListTasksQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  priority?: string;
  assigneeId?: string;
  sort?: 'title' | 'dueDate' | 'priority' | 'createdAt';
  order?: 'asc' | 'desc';
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: string;
  assigneeId?: string;
  dueDate?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  priority?: string;
  assigneeId?: string | null;
  dueDate?: string | null;
}

@Injectable()
export class TasksService {
  constructor(
    private readonly database: DatabaseService,
    private readonly domainEventEmitter: DomainEventEmitter,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly workflowRegistry: WorkflowRegistryService,
  ) {}

  async list(query: ListTasksQuery): Promise<PaginatedResponse<TaskResponse>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const offset = (page - 1) * limit;

    const conditions = [isNull(tasks.deletedAt)];

    if (query.search) {
      const pattern = `%${query.search}%`;
      conditions.push(ilike(tasks.title, pattern));
    }

    if (query.status) {
      conditions.push(eq(tasks.status, query.status));
    }

    if (query.priority) {
      conditions.push(eq(tasks.priority, query.priority));
    }

    if (query.assigneeId) {
      conditions.push(eq(tasks.assigneeId, query.assigneeId));
    }

    const whereClause = and(...conditions);

    const sortColumn = {
      title: tasks.title,
      dueDate: tasks.dueDate,
      priority: tasks.priority,
      createdAt: tasks.createdAt,
    }[query.sort ?? 'createdAt'];

    const orderFn = query.order === 'asc' ? asc : desc;

    const [{ total }] = await this.database.db
      .select({ total: count() })
      .from(tasks)
      .where(whereClause);

    const rows = await this.database.db
      .select()
      .from(tasks)
      .where(whereClause)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset);

    const data: TaskResponse[] = rows.map((row) => this.toResponse(row));

    return {
      data,
      meta: {
        total: Number(total),
        page,
        limit,
        totalPages: Math.ceil(Number(total) / limit),
      },
    };
  }

  async findOneOrFail(id: string): Promise<TaskResponse> {
    const [task] = await this.database.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))
      .limit(1);

    if (!task) throw new NotFoundException('Task not found');

    return this.toResponse(task);
  }

  async create(data: CreateTaskInput, actorId: string): Promise<TaskResponse> {
    // Get initial state from workflow definition
    const workflow = this.workflowRegistry.getBySlug(TASK_WORKFLOW_SLUG);
    const initialState = workflow?.initialState ?? 'open';

    const [task] = await this.database.db
      .insert(tasks)
      .values({
        title: data.title,
        description: data.description,
        status: initialState,
        priority: data.priority ?? 'medium',
        assigneeId: data.assigneeId,
        dueDate: data.dueDate,
        createdBy: actorId,
      })
      .returning();

    this.domainEventEmitter.emit(TASKS_TASK_CREATED, {
      entityType: 'tasks',
      entityId: task.id,
      actorId,
      payload: {
        title: task.title,
        status: task.status,
        priority: task.priority,
        assigneeId: task.assigneeId,
      },
    });

    return this.toResponse(task);
  }

  async update(id: string, data: UpdateTaskInput, actorId: string): Promise<TaskResponse> {
    await this.findOneOrFail(id);

    const updateValues: Record<string, unknown> = {};
    if (data.title !== undefined) updateValues.title = data.title;
    if (data.description !== undefined) updateValues.description = data.description;
    if (data.priority !== undefined) updateValues.priority = data.priority;
    if (data.assigneeId !== undefined) updateValues.assigneeId = data.assigneeId;
    if (data.dueDate !== undefined) updateValues.dueDate = data.dueDate;

    if (Object.keys(updateValues).length === 0) {
      return this.findOneOrFail(id);
    }

    const [updated] = await this.database.db
      .update(tasks)
      .set(updateValues)
      .where(eq(tasks.id, id))
      .returning();

    this.domainEventEmitter.emit(TASKS_TASK_UPDATED, {
      entityType: 'tasks',
      entityId: id,
      actorId,
      payload: {
        changes: Object.keys(updateValues),
      },
    });

    return this.toResponse(updated);
  }

  async softDelete(id: string, actorId: string): Promise<void> {
    const task = await this.findOneOrFail(id);

    await this.database.db
      .update(tasks)
      .set({ deletedAt: new Date(), deletedBy: actorId })
      .where(eq(tasks.id, id));

    this.domainEventEmitter.emit(TASKS_TASK_DELETED, {
      entityType: 'tasks',
      entityId: id,
      actorId,
      payload: {
        title: task.title,
      },
    });
  }

  async transitionStatus(
    id: string,
    toState: string,
    actorId: string,
    comment?: string,
  ): Promise<TaskResponse> {
    const task = await this.findOneOrFail(id);

    // Validate and record transition via workflow engine
    await this.workflowEngine.transition({
      workflowSlug: TASK_WORKFLOW_SLUG,
      entityType: 'task',
      entityId: id,
      fromState: task.status,
      toState,
      actorId,
      comment,
    });

    // Update the entity's status field
    const [updated] = await this.database.db
      .update(tasks)
      .set({ status: toState })
      .where(eq(tasks.id, id))
      .returning();

    return this.toResponse(updated);
  }

  async getAvailableTransitions(id: string): Promise<AvailableTransition[]> {
    const task = await this.findOneOrFail(id);
    return this.workflowEngine.getAvailableTransitions(TASK_WORKFLOW_SLUG, task.status);
  }

  private toResponse(row: typeof tasks.$inferSelect): TaskResponse {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      assigneeId: row.assigneeId,
      dueDate: row.dueDate,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
