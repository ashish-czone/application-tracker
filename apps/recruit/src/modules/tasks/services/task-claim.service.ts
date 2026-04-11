import { Injectable, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { DatabaseService, eq, and, isNull, isNotNull } from '@packages/database';
import { OrgUnitService } from '@packages/org-units';
import { tasks } from '@packages/tasks';

@Injectable()
export class TaskClaimService {
  constructor(
    private readonly database: DatabaseService,
    private readonly orgUnitService: OrgUnitService,
  ) {}

  async claim(taskId: string, userId: string): Promise<{ id: string; assigneeId: string }> {
    const [task] = await this.database.db
      .select({
        id: tasks.id,
        assigneeId: tasks.assigneeId,
        assigneeTeamId: tasks.assigneeTeamId,
      })
      .from(tasks)
      .where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt)));

    if (!task) throw new BadRequestException('Task not found');
    if (!task.assigneeTeamId) throw new BadRequestException('Only team-assigned tasks can be claimed');
    if (task.assigneeId) throw new ConflictException('Task is already claimed');

    const memberIds = await this.orgUnitService.getMemberIds(task.assigneeTeamId);
    if (!memberIds.includes(userId)) {
      throw new ForbiddenException('You are not a member of the assigned team');
    }

    // Optimistic locking: only update if assignee_id is still null
    const [updated] = await this.database.db
      .update(tasks)
      .set({ assigneeId: userId })
      .where(and(eq(tasks.id, taskId), isNull(tasks.assigneeId), isNotNull(tasks.assigneeTeamId)))
      .returning({ id: tasks.id, assigneeId: tasks.assigneeId });

    if (!updated) throw new ConflictException('Task was claimed by someone else');

    return updated;
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
    if (!task.assigneeId) throw new BadRequestException('Task is not claimed');
    if (task.assigneeId !== userId) {
      throw new ForbiddenException('You can only release tasks you claimed');
    }

    await this.database.db
      .update(tasks)
      .set({ assigneeId: null })
      .where(eq(tasks.id, taskId));

    return { id: taskId };
  }
}
