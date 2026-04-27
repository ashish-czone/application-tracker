import { createOrgUnit, type OrgUnit } from './org-units';
import { getSystemLaw, type Law, type SystemLawCode } from './laws';
import { createLawHandler } from './law-handlers';
import { createClient, type CreatedClient, type CreateClientOverrides } from './clients';
import { createComplianceRule, type ComplianceRule, type CreateRuleOptions } from './rules';
import { createClientRegistration, type ClientRegistration } from './registrations';
import { createComplianceFiling, type ComplianceFiling, type CreateFilingOptions } from './filings';

export interface ComplianceChain {
  team: OrgUnit;
  law: Law;
  client: CreatedClient;
  rule: ComplianceRule;
  registration: ClientRegistration;
  filing: ComplianceFiling;
}

export interface CreateComplianceChainOptions {
  lawCode?: SystemLawCode;
  client?: CreateClientOverrides;
  rule?: Partial<Omit<CreateRuleOptions, 'lawId'>>;
  filing?: Partial<Omit<CreateFilingOptions, 'ruleId' | 'clientId' | 'lawId' | 'assigneeTeamId'>>;
}

/**
 * Bootstraps the full compliance entity graph for tests that exercise
 * the team → law → client → rule → registration → filing join. Use only
 * when the spec actually traverses the chain — a spec asserting on
 * clients alone should call `createClient()` directly and skip the rest.
 *
 * Each call creates a fresh team, client, rule, registration, and one
 * filing. The law (`GST` by default) is system-seeded and shared across
 * calls but its UUID is freshly assigned per `resetState()` so the
 * helper looks it up on every invocation.
 */
export async function createComplianceChain(
  opts: CreateComplianceChainOptions = {},
): Promise<ComplianceChain> {
  const team = await createOrgUnit({ level: 'Team' });
  const law = await getSystemLaw(opts.lawCode ?? 'GST');
  await createLawHandler({ lawId: law.id, orgEntityId: team.id });

  const client = await createClient(opts.client);
  const rule = await createComplianceRule({ ...opts.rule, lawId: law.id });
  const registration = await createClientRegistration(client.id, law.id);
  const filing = await createComplianceFiling({
    ...opts.filing,
    ruleId: rule.id,
    clientId: client.id,
    lawId: law.id,
    assigneeTeamId: team.id,
  });

  return { team, law, client, rule, registration, filing };
}
