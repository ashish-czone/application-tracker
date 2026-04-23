import { Injectable } from '@nestjs/common';
import { DatabaseService, and, eq } from '@packages/database';
import { complianceFilings } from '../schema/compliance-filings';

/**
 * Domain-specific natural-key lookup for compliance filings. Lives outside
 * the entity-engine because the (rule, client, periodStart) tuple is
 * compliance-specific — the engine doesn't know about that semantic. The
 * generate action and seeds need a cheap pre-create check before calling
 * EntityService.create(). Survives key-format changes because it does not
 * rely on the compliance_filings.external_key composite.
 */
@Injectable()
export class ComplianceFilingsLookupService {
  constructor(private readonly database: DatabaseService) {}

  async findByRuleClientPeriod(
    ruleId: string,
    clientId: string,
    periodStart: string,
  ): Promise<{ id: string } | null> {
    const rows = await this.database.db
      .select({ id: complianceFilings.id })
      .from(complianceFilings)
      .where(
        and(
          eq(complianceFilings.ruleId, ruleId),
          eq(complianceFilings.clientId, clientId),
          eq(complianceFilings.periodStart, periodStart),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }
}
