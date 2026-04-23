import { Injectable, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { DatabaseService, eq, and, isNull, isNotNull } from '@packages/database';
import { OrgUnitService } from '@packages/org-units';
import { tasks } from '../schema/tasks';

// Reassign is only valid while the task is still actionable. Terminal states
// (completed / cancelled) are reopened via the workflow /transition endpoint,
// not via reassign.
const REASSIGN_ALLOWED_STATUSES = new Set(['pending', 'in_progress', 'blocked']);

@Injectable()
export class TaskClaimService {
  constructor(
    private readonly database: DatabaseService,
    private readonly orgUnitService: OrgUnitService,
  ) {}

  async pickup(taskId: string, userId: string): Promise<{ id: string; assigneeId: string; status: string }> {
    const [task] = await this.database.db
      .select({
        id: tasks.id,
        status: tasks.status,
        assigneeId: tasks.assigneeId,
        assigneeTeamId: tasks.assigneeTeamId,
      })
      .from(tasks)
      .where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt)));

    if (!task) throw new BadRequestException('Task not found');
    if (task.status !== 'pending') {
      throw new ConflictException(`Pickup allowed only on pending tasks (current: ${task.status})`);
    }
    if (task.assigneeId) throw new ConflictException('Task is already picked up');

    const memberIds = await this.orgUnitService.getMemberIds(task.assigneeTeamId);
    if (!memberIds.includes(userId)) {
      throw new ForbiddenException('You are not a member of the assigned team');
    }

    // Atomic: only takes effect if the row is still unclaimed AND still pending.
    const [updated] = await this.database.db
      .update(tasks)
      .set({ assigneeId: userId, status: 'in_progress' })
      .where(and(
        eq(tasks.id, taskId),
        isNull(tasks.assigneeId),
        isNotNull(tasks.assigneeTeamId),
        eq(tasks.status, 'pending'),
      ))
      .returning({ id: tasks.id, assigneeId: tasks.assigneeId, status: tasks.status });

    if (!updated) throw new ConflictException('Task was picked up or moved by someone else');

    return updated as { id: string; assigneeId: string; status: string };
  }

  async reassign(
    taskId: string,
    data: { teamId: string; userId?: string | null },
  ): Promise<{ id: string; assigneeId: string | null; assigneeTeamId: string }> {
    if (!data.teamId) {
      throw new BadRequestException('teamId is required — every task must belong to a team');
    }

    const [task] = await this.database.db
      .select({ id: tasks.id, status: tasks.status })
      .from(tasks)
      .where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt)));

    if (!task) throw new BadRequestException('Task not found');
    if (!REASSIGN_ALLOWED_STATUSES.has(task.status)) {
      throw new ConflictException(
        `Reassign allowed only while task is pending, in_progress, or blocked (current: ${task.status})`,
      );
    }

    const [updated] = await this.database.db
      .update(tasks)
      .set({
        assigneeTeamId: data.teamId,
        assigneeId: data.userId ?? null,
      })
      .where(eq(tasks.id, taskId))
      .returning({ id: tasks.id, assigneeId: tasks.assigneeId, assigneeTeamId: tasks.assigneeTeamId });

    return updated as { id: string; assigneeId: string | null; assigneeTeamId: string };
  }

  async unclaim(taskId: string, userId: string): Promise<{ id: string }> {
    const [task] = await this.database.db
      .select({
        id: tasks.id,
        assigneeId: tasks.assigneeId,
        assigneeTeamId: tasks.assigneeTeamId,
      })
      .from(tasks)
      .where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt)));

    if (!task) throw new BadRequestException('Task not found');
    if (!task.assigneeTeamId) throw new BadRequestException('Only team-assigned tasks can be released');
    if (!task.assigneeId) throw new BadRequestException('Task is not picked up');
    if (task.assigneeId !== userId) {
      throw new ForbiddenException('You can only release tasks you picked up');
    }

    await this.database.db
      .update(tasks)
      .set({ assigneeId: null })
      .where(eq(tasks.id, taskId));

    return { id: taskId };
  }
}
