import { Injectable, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { DatabaseService, eq, and, isNull, isNotNull } from '@packages/database';
import { OrgUnitService } from '@packages/org-units';
import { tasks } from '../schema/tasks';
import { assertTaskIsAdHoc } from '../tasks.config';

@Injectable()
export class TaskClaimService {
  constructor(
    private readonly database: DatabaseService,
    private readonly orgUnitService: OrgUnitService,
  ) {}

  async pickup(taskId: string, userId: string): Promise<{ id: string; assigneeId: string }> {
    await assertTaskIsAdHoc(taskId);

    const [task] = await this.database.db
      .select({
        id: tasks.id,
        assigneeId: tasks.assigneeId,
        assigneeTeamId: tasks.assigneeTeamId,
      })
      .from(tasks)
      .where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt)));

    if (!task) throw new BadRequestException('Task not found');
    if (!task.assigneeTeamId) throw new BadRequestException('Only team-assigned tasks can be picked up');
    if (task.assigneeId) throw new ConflictException('Task is already picked up');

    const memberIds = await this.orgUnitService.getMemberIds(task.assigneeTeamId);
    if (!memberIds.includes(userId)) {
      throw new ForbiddenException('You are not a member of the assigned team');
    }

    const [updated] = await this.database.db
      .update(tasks)
      .set({ assigneeId: userId })
      .where(and(eq(tasks.id, taskId), isNull(tasks.assigneeId), isNotNull(tasks.assigneeTeamId)))
      .returning({ id: tasks.id, assigneeId: tasks.assigneeId });

    if (!updated) throw new ConflictException('Task was picked up by someone else');

    return updated as { id: string; assigneeId: string };
  }

  async reassign(
    taskId: string,
    data: { teamId: string; userId?: string | null },
  ): Promise<{ id: string; assigneeId: string | null; assigneeTeamId: string }> {
    if (!data.teamId) {
      throw new BadRequestException('teamId is required — every task must belong to a team');
    }

    await assertTaskIsAdHoc(taskId);

    const [task] = await this.database.db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt)));

    if (!task) throw new BadRequestException('Task not found');

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
    await assertTaskIsAdHoc(taskId);

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
