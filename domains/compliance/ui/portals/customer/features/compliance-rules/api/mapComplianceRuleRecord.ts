import {
  FREQUENCIES,
  inferLawGroup,
  type ComplianceFrequency,
} from '@domains/compliance-contract';
import type { Handler } from '../../../../../types';
import type { ComplianceRule, ComplianceRuleStatus } from '../types';
import type { ComplianceRuleRecord } from '../../../../../hooks/useComplianceRulesApi';

const UNASSIGNED_HANDLER: Handler = {
  id: 'unassigned',
  name: 'Unassigned',
  initials: '—',
};

const STATUS_VALUES: ComplianceRuleStatus[] = ['active', 'draft', 'deprecated'];

function normalizeStatus(status: string | null | undefined): ComplianceRuleStatus {
  if (status && (STATUS_VALUES as string[]).includes(status)) {
    return status as ComplianceRuleStatus;
  }
  return 'draft';
}

function normalizeFrequency(value: string | null | undefined): ComplianceFrequency {
  if (value && (FREQUENCIES as readonly string[]).includes(value)) {
    return value as ComplianceFrequency;
  }
  return 'monthly';
}

function normalizeJurisdiction(
  value: string | null | undefined,
): 'central' | 'state' | 'municipal' {
  if (value === 'state' || value === 'municipal') return value;
  return 'central';
}

export function mapComplianceRuleRecord(record: ComplianceRuleRecord): ComplianceRule {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    description: record.description ?? '',
    lawGroup: inferLawGroup(record.lawCode),
    lawCode: record.lawCode ?? '',
    lawName: record.lawName ?? '',
    jurisdiction: normalizeJurisdiction(record.lawJurisdiction),
    frequency: normalizeFrequency(record.frequency),
    status: normalizeStatus(record.status),
    // Aggregate metrics that don't yet have a backing endpoint.
    applicableClients: 0,
    filingsThisPeriod: 0,
    onTimePct: 0,
    owner: UNASSIGNED_HANDLER,
    lastReviewed: record.updatedAt ? record.updatedAt.slice(0, 10) : '',
  };
}
