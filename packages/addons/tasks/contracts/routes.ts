import { buildEntityRoutes, type EntityRoutes } from '@packages/entity-engine-contract';

/**
 * Tasks-specific route helpers on top of the generic entity routes. Kept in
 * the contract so UI callers (claim/unclaim buttons, assign dialogs) build
 * URLs from a typed helper instead of hand-coding paths that must match the
 * api-side @Controller('tasks') decorators.
 */
export interface TasksRoutes extends EntityRoutes {
  /** POST claim a team-assigned task for the current user. */
  claim: (id: string) => string;
  /** POST release a claimed team task back to the team pool. */
  unclaim: (id: string) => string;
  /** POST assign a task to a user or team (requires tasks.assign). */
  assign: (id: string) => string;
}

export const tasksRoutes: TasksRoutes = {
  ...buildEntityRoutes('tasks'),
  claim: (id) => `/tasks/${id}/claim`,
  unclaim: (id) => `/tasks/${id}/unclaim`,
  assign: (id) => `/tasks/${id}/assign`,
};
