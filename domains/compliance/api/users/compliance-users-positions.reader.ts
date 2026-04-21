import { Injectable } from '@nestjs/common';
import { OrgUnitService } from '@packages/org-units';
import type { UsersPositionsReader, UserPosition } from '@packages/users';

/**
 * Attaches org-unit memberships onto every user row in list/detail responses.
 * Registered against the `USERS_POSITIONS_READER` DI token from
 * `@packages/users`, which wires into the factory-built afterList /
 * afterFindOne hooks on the users entity config.
 *
 * The compliance domain owns this integration because compliance is the app
 * that actually cares about position context — the users package stays
 * domain-agnostic, and the org-units addon owns the query.
 */
@Injectable()
export class ComplianceUsersPositionsReader implements UsersPositionsReader {
  constructor(private readonly orgUnits: OrgUnitService) {}

  async getPositionsByUserIds(userIds: string[]): Promise<Record<string, UserPosition[]>> {
    return this.orgUnits.getPositionsByUserIds(userIds);
  }
}
