import { Inject, Injectable } from '@nestjs/common';
import { UsersService } from '@packages/users';
import { TasksService } from '@packages/tasks';
import { OrgUnitService } from '@packages/org-units';

/**
 * App-level UsersService. Extends the library's UsersService and plugs the
 * domain-side cleanup this app needs when a user is soft-deleted. Runs
 * synchronously before the user row's `deletedAt` is stamped; throwing here
 * aborts the deactivation.
 *
 * Uses property injection (`@Inject`) so the subclass doesn't have to
 * redeclare the base constructor's param list — Nest carries the base
 * constructor metadata across and resolves the properties after base
 * construction.
 */
@Injectable()
export class AppUsersService extends UsersService {
  @Inject(TasksService) private readonly tasksService!: TasksService;
  @Inject(OrgUnitService) private readonly orgUnitService!: OrgUnitService;

  protected async cleanupOnSoftDelete(userId: string): Promise<void> {
    await this.tasksService.handleUserDeactivated(userId);
    await this.orgUnitService.handleUserDeactivated(userId);
  }
}
