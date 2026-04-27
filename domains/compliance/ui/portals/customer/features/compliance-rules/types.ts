import type { ComplianceFrequency } from '@domains/compliance-contract';
import type { Handler } from '../../../../shared/types';

// A ComplianceRule is the canonical filing requirement for a law / form /
// cadence combination. Concrete filings (the instances on the dashboard)
// are generated from rules at period roll-over. Rules are the registry
// view: one row per rule, not per client per period.

export type ComplianceRuleStatus = 'active' | 'draft' | 'deprecated';

export type LawGroupKey = 'gst' | 'itr' | 'tds' | 'roc' | 'pt' | 'pf' | 'labour';

export interface LawGroup {
  key: LawGroupKey;
  label: string;
  jurisdiction: 'central' | 'state';
  count: number;
}

export interface ComplianceRule {
  id: string;
  code: string;
  name: string;
  description: string;
  lawGroup: LawGroupKey;
  lawCode: string;
  lawName: string;
  jurisdiction: 'central' | 'state' | 'municipal';
  frequency: ComplianceFrequency;
  applicableClients: number;
  filingsThisPeriod: number;
  onTimePct: number;
  status: ComplianceRuleStatus;
  owner: Handler;
  lastReviewed: string;
}

// A rule template is a platform-shipped catalog entry. Firms instantiate
// (and optionally customise) a rule from a template. Templates are read-
// only for the firm; the platform team updates them with regulatory
// changes.
export interface RuleTemplate {
  id: string;
  code: string;
  name: string;
  description: string;
  lawGroup: LawGroupKey;
  lawCode: string;
  lawName: string;
  jurisdiction: 'central' | 'state' | 'municipal';
  frequency: ComplianceFrequency;
  dueDayOfMonth: number;
  dueMonthOffset: number;
  gracePeriodDays: number;
}
