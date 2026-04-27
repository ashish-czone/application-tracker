import { TasksModule, type TasksModuleOptions } from './tasks.module';

export { tasks } from './schema/tasks';
export { TASKS_CONFIG, applyCompletedAt } from './tasks.config';
export { TasksModule, type TasksModuleOptions };

/**
 * Migration-only addon: include this when the app uses the `tasks` schema
 * (e.g. for seeding) but does not load `TasksModule` itself. The module
 * requires a per-app `teamMembersReader` config; apps that want the full
 * module should use `tasksModuleAddon(opts)` instead.
 */
export const tasksAddon = {
  migration: '@packages/tasks',
} as const;

/**
 * Full-bundle factory for apps that want both the table AND the configured
 * module. Pass the `teamMembersReader` binding as you would to
 * `TasksModule.forRoot`.
 */
export function tasksModuleAddon(opts: TasksModuleOptions) {
  return {
    module: TasksModule.forRoot(opts),
    migration: '@packages/tasks',
  } as const;
}
export { TasksService } from './services/tasks.service';
export {
  TASK_TEAM_MEMBERS_READER,
  type TaskTeamMembersReader,
} from './task-team-members-reader.token';
