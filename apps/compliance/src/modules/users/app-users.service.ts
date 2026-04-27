import { Inject, Injectable } from '@nestjs/common';
import { UsersService } from '@packages/users';
import { OrgUnitService } from '@packages/org-units';
import { ComplianceFilingsAssigneeCleanupService } from '@domains/compliance-api/compliance-filings/compliance-filings-assignee-cleanup.service';

@Injectable()
export class AppUsersService extends UsersService {
  @Inject(OrgUnitService) private readonly orgUnitService!: OrgUnitService;
  @Inject(ComplianceFilingsAssigneeCleanupService)
  private readonly filingsAssigneeCleanup!: ComplianceFilingsAssigneeCleanupService;

  protected async cleanupOnSoftDelete(userId: string, actorId: string): Promise<void> {
    await this.orgUnitService.handleUserDeactivated(userId);
    await this.filingsAssigneeCleanup.clearAssigneeForUser(userId, actorId);
  }
}
