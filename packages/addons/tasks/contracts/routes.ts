import { buildEntityRoutes, type EntityRoutes } from '@packages/entity-engine-contract';

/**
 * Tasks-specific route helpers on top of the generic entity routes. Kept in
 * the contract so UI callers (pickup/unclaim buttons, reassign dialogs)
 * build URLs from a typed helper instead of hand-coding paths that must
 * match the api-side @Controller('tasks') decorators.
 */
export interface TasksRoutes extends EntityRoutes {
  /** POST pick up a team-assigned task for the current user. */
  pickup: (id: string) => string;
  /** POST release a picked-up task back to the team pool. */
  unclaim: (id: string) => string;
  /** POST reassign a task to a different user or team (requires tasks.reassign). */
  reassign: (id: string) => string;
}

export const tasksRoutes: TasksRoutes = {
  ...buildEntityRoutes('tasks'),
  pickup: (id) => `/tasks/${id}/pickup`,
  unclaim: (id) => `/tasks/${id}/unclaim`,
  reassign: (id) => `/tasks/${id}/reassign`,
};
