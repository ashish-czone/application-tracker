import { Inject, Injectable } from '@nestjs/common';
import { UsersService } from '@packages/users';
import { OrgUnitService } from '@packages/org-units';

@Injectable()
export class AppUsersService extends UsersService {
  @Inject(OrgUnitService) private readonly orgUnitService!: OrgUnitService;

  protected async cleanupOnSoftDelete(userId: string, _actorId: string): Promise<void> {
    await this.orgUnitService.handleUserDeactivated(userId);
  }
}
