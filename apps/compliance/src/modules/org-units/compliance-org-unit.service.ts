import { Injectable, BadRequestException } from '@nestjs/common';
import { OrgUnitService } from '@packages/org-units';
import { eq, sql } from '@packages/database';
import { complianceLawHandlers } from '@domains/compliance-api';

/**
 * I22 — reject deleting an org unit while any `compliance_law_handlers` row
 * references it. Subclasses the platform `OrgUnitService` and overrides the
 * `assertCanDelete()` template method; everything else inherits unchanged.
 */
@Injectable()
export class ComplianceOrgUnitService extends OrgUnitService {
  protected async assertCanDelete(id: string): Promise<void> {
    const [row] = await this.database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(complianceLawHandlers)
      .where(eq(complianceLawHandlers.orgEntityId, id));

    const count = row?.count ?? 0;
    if (count > 0) {
      throw new BadRequestException({
        code: 'HANDLERS_REFERENCE_UNIT',
        message: `Cannot delete org unit: ${count} law handler${count === 1 ? '' : 's'} reference${count === 1 ? 's' : ''} it. Reassign the handler${count === 1 ? '' : 's'} first.`,
        count,
      });
    }
  }
}
