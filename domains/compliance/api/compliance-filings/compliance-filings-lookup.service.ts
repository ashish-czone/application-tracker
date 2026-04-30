import { Injectable } from '@nestjs/common';
import { DatabaseService, and, eq, inArray } from '@packages/database';
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

  /**
   * Batched twin of `findByRuleClientPeriod`. Returns the set of
   * `${clientId}:${periodStart}` keys that already have a filing for the
   * given rule, scoped to the specific client/period combinations the
   * generator is about to consider. Used by the generator's pre-loop
   * lookup to collapse N×M sequential SELECT-then-INSERTs into one batched
   * existence check + one INSERT-with-race-guard per new row.
   *
   * Empty inputs short-circuit to an empty set so callers don't need to
   * special-case "no work."
   */
  async findExistingKeys(
    ruleId: string,
    clientIds: readonly string[],
    periodStarts: readonly string[],
  ): Promise<Set<string>> {
    if (clientIds.length === 0 || periodStarts.length === 0) return new Set();
    const rows = await this.database.db
      .select({
        clientId: complianceFilings.clientId,
        periodStart: complianceFilings.periodStart,
      })
      .from(complianceFilings)
      .where(
        and(
          eq(complianceFilings.ruleId, ruleId),
          inArray(complianceFilings.clientId, clientIds as string[]),
          inArray(complianceFilings.periodStart, periodStarts as string[]),
        ),
      );
    return new Set(rows.map((r) => `${r.clientId}:${r.periodStart}`));
  }
}
