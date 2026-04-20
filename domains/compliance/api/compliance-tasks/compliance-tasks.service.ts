import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, and, eq, gte, lte, desc, asc, inArray, isNull } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { tasks } from '@packages/tasks/schema/tasks';
import { applyCompletedAt } from '@packages/tasks';
import { complianceTasks } from '../schema/compliance-tasks';
import { COMPLIANCE_TASK_GENERATED } from '../events/types';

const TASK_KIND = 'compliance';

export interface ComplianceTaskCreateInput {
  title: string;
  dueDate: string;
  ruleId: string;
  clientId: string;
  lawId: string;
  periodStart: string;
  periodEnd: string;
  priority?: string;
  description?: string | null;
  assigneeId?: string | null;
  assigneeTeamId?: string | null;
}

export interface ComplianceTaskUpdateInput {
  title?: string;
  dueDate?: string | null;
  priority?: string;
  description?: string | null;
  assigneeId?: string | null;
  assigneeTeamId?: string | null;
  status?: string;
}

export interface ComplianceTaskFilters {
  clientId?: string;
  ruleId?: string;
  lawId?: string;
  status?: string | string[];
  periodFrom?: string;
  periodTo?: string;
  dueFrom?: string;
  dueTo?: string;
  assigneeId?: string;
  assigneeTeamId?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'dueDate' | 'periodStart' | 'createdAt';
  direction?: 'asc' | 'desc';
}

export interface ComplianceTaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  assigneeTeamId: string | null;
  dueDate: string | null;
  completedAt: Date | null;
  ruleId: string;
  clientId: string;
  lawId: string;
  periodStart: string;
  periodEnd: string;
  externalKey: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Owns creation, update, and list of compliance-kinded tasks — the tasks
 * table row plus its compliance_tasks extension. Always transactional: a
 * compliance task is meaningless without its (rule, client, period) tuple,
 * so the two rows are never written apart.
 *
 * Idempotency uses the platform primitive on tasks: `external_key` lives
 * on the base `tasks` row (unique per (kind, external_key)) and every kind
 * reuses the same column. The action and seed check
 * `findByRuleClientPeriod` / `findByExternalKey` before calling `create`.
 * The natural-key unique constraint on (rule_id, client_id, period_start)
 * in compliance_tasks is the domain-level guard rail that survives
 * key-format changes.
 *
 * Events: emits `tasks.Created` (mirroring the entity-engine CRUD stream so
 * audit and automation listeners receive compliance tasks too) and
 * `COMPLIANCE_TASK_GENERATED` (the compliance-domain event that previously
 * lived in the automation action — now centralized here so both the action
 * and any future UI create path fire it).
 */
@Injectable()
export class ComplianceTasksService {
  constructor(
    private readonly database: DatabaseService,
    private readonly events: DomainEventEmitter,
  ) {}

  async create(input: ComplianceTaskCreateInput, actorId: string): Promise<ComplianceTaskRow> {
    const externalKey = this.buildExternalKey(input.ruleId, input.clientId, input.periodStart);

    const { taskRow, extRow } = await this.database.db.transaction(async (tx) => {
      const [task] = await tx
        .insert(tasks)
        .values({
          title: input.title,
          description: input.description ?? null,
          priority: input.priority ?? 'medium',
          assigneeId: input.assigneeId ?? null,
          assigneeTeamId: input.assigneeTeamId ?? null,
          dueDate: input.dueDate,
          kind: TASK_KIND,
          externalKey,
          createdBy: actorId,
        })
        .returning();

      const [ext] = await tx
        .insert(complianceTasks)
        .values({
          taskId: task.id,
          ruleId: input.ruleId,
          clientId: input.clientId,
          lawId: input.lawId,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
        })
        .returning();

      return { taskRow: task, extRow: ext };
    });

    this.events.emitDynamic('tasks.Created', {
      entityType: 'tasks',
      entityId: taskRow.id,
      actorId,
      payload: { after: taskRow as unknown as Record<string, unknown> },
    });

    this.events.emitDynamic(COMPLIANCE_TASK_GENERATED, {
      entityType: 'compliance_rule',
      entityId: extRow.ruleId,
      actorId: actorId === 'system' ? null : actorId,
      payload: {
        ruleId: extRow.ruleId,
        clientId: extRow.clientId,
        lawId: extRow.lawId,
        taskId: taskRow.id,
        externalKey: taskRow.externalKey ?? externalKey,
        periodStart: extRow.periodStart,
        periodEnd: extRow.periodEnd,
        dueDate: taskRow.dueDate ?? '',
      },
    });

    return this.toRow(taskRow, extRow);
  }

  async update(
    taskId: string,
    input: ComplianceTaskUpdateInput,
    actorId: string,
  ): Promise<ComplianceTaskRow> {
    const existing = await this.findOneRaw(taskId);
    if (!existing) throw new NotFoundException(`Compliance task ${taskId} not found`);

    const taskPatch: Record<string, unknown> = {};
    if (input.title !== undefined) taskPatch.title = input.title;
    if (input.description !== undefined) taskPatch.description = input.description;
    if (input.priority !== undefined) taskPatch.priority = input.priority;
    if (input.assigneeId !== undefined) taskPatch.assigneeId = input.assigneeId;
    if (input.assigneeTeamId !== undefined) taskPatch.assigneeTeamId = input.assigneeTeamId;
    if (input.dueDate !== undefined) taskPatch.dueDate = input.dueDate;
    if (input.status !== undefined) taskPatch.status = input.status;

    // Share the completedAt rule with TASKS_CONFIG.beforeUpdate — moving TO
    // `completed` stamps now(), moving AWAY clears it, and patches that
    // don't touch status are left alone. The generic /tasks path rejects
    // kinded rows, so this is where the stamping actually runs for them.
    const finalPatch = applyCompletedAt(taskPatch);

    const { taskRow, extRow } = await this.database.db.transaction(async (tx) => {
      let updatedTask = existing.task;
      if (Object.keys(finalPatch).length > 0) {
        const [row] = await tx
          .update(tasks)
          .set(finalPatch)
          .where(eq(tasks.id, taskId))
          .returning();
        updatedTask = row;
      }
      return { taskRow: updatedTask, extRow: existing.ext };
    });

    this.events.emitDynamic('tasks.Updated', {
      entityType: 'tasks',
      entityId: taskRow.id,
      actorId,
      payload: {
        before: existing.task as unknown as Record<string, unknown>,
        after: taskRow as unknown as Record<string, unknown>,
      },
    });

    return this.toRow(taskRow, extRow);
  }

  /**
   * Hard-deletes the task row. ON DELETE CASCADE on compliance_tasks.task_id
   * removes the extension row in the same statement.
   */
  async delete(taskId: string, actorId: string): Promise<void> {
    const existing = await this.findOneRaw(taskId);
    if (!existing) throw new NotFoundException(`Compliance task ${taskId} not found`);

    await this.database.db.delete(tasks).where(eq(tasks.id, taskId));

    this.events.emitDynamic('tasks.Deleted', {
      entityType: 'tasks',
      entityId: taskId,
      actorId,
      payload: { before: existing.task as unknown as Record<string, unknown> },
    });
  }

  async findByExternalKey(externalKey: string): Promise<{ taskId: string } | null> {
    const rows = await this.database.db
      .select({ taskId: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.kind, TASK_KIND), eq(tasks.externalKey, externalKey)))
      .limit(1);
    return rows[0] ?? null;
  }

  async findByRuleClientPeriod(
    ruleId: string,
    clientId: string,
    periodStart: string,
  ): Promise<{ taskId: string } | null> {
    const rows = await this.database.db
      .select({ taskId: complianceTasks.taskId })
      .from(complianceTasks)
      .where(
        and(
          eq(complianceTasks.ruleId, ruleId),
          eq(complianceTasks.clientId, clientId),
          eq(complianceTasks.periodStart, periodStart),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async list(filters: ComplianceTaskFilters = {}): Promise<{
    rows: ComplianceTaskRow[];
    total: number;
  }> {
    const conditions = [isNull(tasks.deletedAt)];
    if (filters.clientId) conditions.push(eq(complianceTasks.clientId, filters.clientId));
    if (filters.ruleId) conditions.push(eq(complianceTasks.ruleId, filters.ruleId));
    if (filters.lawId) conditions.push(eq(complianceTasks.lawId, filters.lawId));
    if (filters.assigneeId) conditions.push(eq(tasks.assigneeId, filters.assigneeId));
    if (filters.assigneeTeamId) conditions.push(eq(tasks.assigneeTeamId, filters.assigneeTeamId));
    if (filters.periodFrom) conditions.push(gte(complianceTasks.periodStart, filters.periodFrom));
    if (filters.periodTo) conditions.push(lte(complianceTasks.periodStart, filters.periodTo));
    if (filters.dueFrom) conditions.push(gte(tasks.dueDate, filters.dueFrom));
    if (filters.dueTo) conditions.push(lte(tasks.dueDate, filters.dueTo));
    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      conditions.push(inArray(tasks.status, statuses));
    }

    const where = and(...conditions);

    const orderCol =
      filters.orderBy === 'periodStart'
        ? complianceTasks.periodStart
        : filters.orderBy === 'createdAt'
          ? tasks.createdAt
          : tasks.dueDate;
    const orderFn = filters.direction === 'asc' ? asc : desc;

    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    const rows = await this.database.db
      .select({
        task: tasks,
        ext: complianceTasks,
      })
      .from(complianceTasks)
      .innerJoin(tasks, eq(complianceTasks.taskId, tasks.id))
      .where(where)
      .orderBy(orderFn(orderCol))
      .limit(limit)
      .offset(offset);

    const countRows = await this.database.db
      .select({ id: complianceTasks.taskId })
      .from(complianceTasks)
      .innerJoin(tasks, eq(complianceTasks.taskId, tasks.id))
      .where(where);

    return {
      rows: rows.map((r) => this.toRow(r.task, r.ext)),
      total: countRows.length,
    };
  }

  async findOne(taskId: string): Promise<ComplianceTaskRow | null> {
    const raw = await this.findOneRaw(taskId);
    return raw ? this.toRow(raw.task, raw.ext) : null;
  }

  private async findOneRaw(
    taskId: string,
  ): Promise<{ task: typeof tasks.$inferSelect; ext: typeof complianceTasks.$inferSelect } | null> {
    const rows = await this.database.db
      .select({ task: tasks, ext: complianceTasks })
      .from(complianceTasks)
      .innerJoin(tasks, eq(complianceTasks.taskId, tasks.id))
      .where(and(eq(complianceTasks.taskId, taskId), isNull(tasks.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  private buildExternalKey(ruleId: string, clientId: string, periodStart: string): string {
    return `${ruleId}:${clientId}:${periodStart}`;
  }

  private toRow(
    task: typeof tasks.$inferSelect,
    ext: typeof complianceTasks.$inferSelect,
  ): ComplianceTaskRow {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assigneeId: task.assigneeId,
      assigneeTeamId: task.assigneeTeamId,
      dueDate: task.dueDate,
      completedAt: task.completedAt,
      ruleId: ext.ruleId,
      clientId: ext.clientId,
      lawId: ext.lawId,
      periodStart: ext.periodStart,
      periodEnd: ext.periodEnd,
      externalKey: task.externalKey ?? this.buildExternalKey(ext.ruleId, ext.clientId, ext.periodStart),
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }
}
