import { FREQUENCIES, type ComplianceFrequency } from '@domains/compliance-contract';
import type { Handler } from '../../../../../types';
import type { ComplianceRule, ComplianceRuleStatus, LawGroupKey } from '../types';
import type { ComplianceRuleRecord, LawRecord } from '../../../../../hooks/useComplianceRulesApi';

const UNASSIGNED_HANDLER: Handler = {
  id: 'unassigned',
  name: 'Unassigned',
  initials: '—',
};

const STATUS_VALUES: ComplianceRuleStatus[] = ['active', 'draft', 'deprecated'];

const LAW_CODE_TO_GROUP: Record<string, LawGroupKey> = {
  GST: 'gst',
  IT: 'itr',
  ITR: 'itr',
  TDS: 'tds',
  ROC: 'roc',
  PT: 'pt',
  EPF: 'pf',
  ESI: 'pf',
  PF: 'pf',
};

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

function inferLawGroup(lawCode: string | undefined): LawGroupKey {
  if (!lawCode) return 'gst';
  return LAW_CODE_TO_GROUP[lawCode.toUpperCase()] ?? 'gst';
}

export function mapComplianceRuleRecord(
  record: ComplianceRuleRecord,
  law: LawRecord | undefined,
): ComplianceRule {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    description: record.description ?? '',
    lawGroup: inferLawGroup(law?.code),
    lawCode: law?.code ?? '',
    lawName: law?.name ?? '',
    jurisdiction: normalizeJurisdiction(law?.jurisdiction),
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
