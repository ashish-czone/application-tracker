import { Inject, Injectable } from '@nestjs/common';
import { TASKS_FIELDS } from '@packages/tasks-contract';
import { TASK_TEAM_MEMBERS_READER, type TaskTeamMembersReader } from '../task-team-members-reader.token';

/**
 * Subset of the JWT payload this service consumes. The `permissions` map is
 * attached by the auth pipeline; presence of a key (or `*` for superadmin)
 * means "granted".
 */
export interface TaskActionsUser {
  userId: string;
  permissions?: Record<string, unknown>;
}

/**
 * Task fields the action computation reads. A `Task` from the contract
 * already satisfies this shape; typed loosely so call sites can pass list
 * rows without casting.
 */
export interface TaskRowForActions {
  id: string;
  status: string;
  assigneeId?: string | null;
  assigneeTeamId?: string | null;
  deletedAt?: Date | string | null;
}

const REASSIGN_ALLOWED_STATUSES = new Set(['pending', 'in_progress', 'blocked']);

function hasPermission(user: TaskActionsUser, slug: string): boolean {
  const perms = user.permissions ?? {};
  if ('*' in perms) return true;
  return slug in perms;
}

/**
 * Walks `TASKS_FIELDS.status.workflow.transitions` and yields the target
 * states the user can transition to from `currentStatus`. Each transition's
 * `requiredPermissions` is checked; transitions without a required permission
 * (e.g. `in_progress -> blocked`) always pass.
 */
function allowedTransitionsFrom(currentStatus: string, user: TaskActionsUser): string[] {
  const fromBlock = TASKS_FIELDS.status.workflow.transitions.find((t) => t.from === currentStatus);
  if (!fromBlock) return [];

  const targets: string[] = [];
  for (const entry of fromBlock.to) {
    if (typeof entry === 'string') {
      targets.push(entry);
      continue;
    }
    const required = (entry as { requiredPermissions?: string[] }).requiredPermissions ?? [];
    const ok = required.every((slug) => hasPermission(user, slug));
    if (ok) targets.push(entry.state);
  }
  return targets;
}

/**
 * Computes the set of action verbs the requesting user can currently
 * perform on a given task. Surfaced on `GET /tasks` and `GET /tasks/:id`
 * so the UI can show/hide action buttons without re-deriving the rules.
 *
 * Verbs returned:
 *   - `update`, `delete`, `clone`, `restore` — CRUD verbs
 *   - `pickup`, `unclaim`, `reassign` — claim controller endpoints
 *   - `transition:<target>` — workflow transitions from the current status
 *
 * Authoritative checks still happen in the action endpoints; the verb list
 * is a UI affordance hint, not a security boundary.
 */
@Injectable()
export class TaskActionsService {
  constructor(
    @Inject(TASK_TEAM_MEMBERS_READER)
    private readonly teamMembersReader: TaskTeamMembersReader,
  ) {}

  async computeAllowedActions(task: TaskRowForActions, user: TaskActionsUser): Promise<string[]> {
    const teamId = task.assigneeTeamId ?? null;
    const teamMembers =
      teamId && hasPermission(user, 'tasks.pickup')
        ? new Set(await this.teamMembersReader.getMemberIds(teamId))
        : new Set<string>();
    return this.compute(task, user, (id) => (id === teamId ? teamMembers : new Set<string>()));
  }

  /**
   * Bulk variant for list endpoints — preloads team membership for every
   * unique team referenced by the row set so the per-row computation runs
   * without further DB hits. Returns a map keyed by task id.
   */
  async computeAllowedActionsForMany(
    rows: TaskRowForActions[],
    user: TaskActionsUser,
  ): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>();
    if (rows.length === 0) return result;

    // Skip the whole team-membership prefetch if the caller can't pickup;
    // that's the only verb that needs it.
    const canPickup = hasPermission(user, 'tasks.pickup');
    const memberCache = new Map<string, Set<string>>();

    if (canPickup) {
      const teamIds = new Set<string>();
      for (const row of rows) {
        if (row.assigneeTeamId) teamIds.add(row.assigneeTeamId);
      }
      for (const teamId of teamIds) {
        const ids = await this.teamMembersReader.getMemberIds(teamId);
        memberCache.set(teamId, new Set(ids));
      }
    }

    for (const row of rows) {
      result.set(row.id, this.compute(row, user, (id) => memberCache.get(id) ?? new Set()));
    }
    return result;
  }

  private compute(
    task: TaskRowForActions,
    user: TaskActionsUser,
    getTeamMembers: (teamId: string) => Set<string>,
  ): string[] {
    const allowed: string[] = [];
    const isDeleted = task.deletedAt != null;

    if (!isDeleted && hasPermission(user, 'tasks.update')) allowed.push('update');
    if (!isDeleted && hasPermission(user, 'tasks.delete')) allowed.push('delete');
    if (!isDeleted && hasPermission(user, 'tasks.create')) allowed.push('clone');
    if (isDeleted && hasPermission(user, 'tasks.update')) allowed.push('restore');

    // Pickup: pending, unassigned, member of the assignee team.
    if (
      !isDeleted &&
      hasPermission(user, 'tasks.pickup') &&
      task.status === 'pending' &&
      !task.assigneeId &&
      task.assigneeTeamId &&
      getTeamMembers(task.assigneeTeamId).has(user.userId)
    ) {
      allowed.push('pickup');
    }

    // Unclaim: the picker is the only one who can release a team-pool task.
    if (
      !isDeleted &&
      hasPermission(user, 'tasks.pickup') &&
      task.assigneeTeamId &&
      task.assigneeId === user.userId
    ) {
      allowed.push('unclaim');
    }

    // Reassign: only while the task is still actionable.
    if (
      !isDeleted &&
      hasPermission(user, 'tasks.reassign') &&
      REASSIGN_ALLOWED_STATUSES.has(task.status)
    ) {
      allowed.push('reassign');
    }

    if (!isDeleted) {
      for (const target of allowedTransitionsFrom(task.status, user)) {
        allowed.push(`transition:${target}`);
      }
    }

    return allowed;
  }
}
