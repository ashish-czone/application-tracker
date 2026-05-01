import type { ComplianceFrequency, LawGroupKey } from '@domains/compliance-contract';

export type RuleStatusKey = 'draft' | 'active' | 'deprecated';
export type RuleJurisdictionKey = 'central' | 'state' | 'municipal';

export interface ComplianceRulesListParams {
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
  status?: RuleStatusKey;
  frequencies?: ComplianceFrequency[];
  jurisdictions?: RuleJurisdictionKey[];
  lawGroups?: LawGroupKey[];
  lawIds?: string[];
  q?: string;
}
