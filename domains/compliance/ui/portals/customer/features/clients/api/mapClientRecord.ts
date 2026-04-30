import type { Handler } from '../../../../../types';
import type { ClientRow, ClientStatus, ClientRiskLevel } from '../types';
import type { ClientRecord } from '../../../../../hooks/useClientsApi';

const UNASSIGNED_HANDLER: Handler = {
  id: 'unassigned',
  name: 'Unassigned',
  initials: '—',
};

const STATUS_VALUES: ClientStatus[] = ['active', 'onboarding', 'dormant'];
const RISK_VALUES: ClientRiskLevel[] = ['healthy', 'at-risk', 'critical'];

const AVATAR_PALETTE = [
  'hsl(218 56% 24%)',
  'hsl(140 31% 33%)',
  'hsl(19 75% 44%)',
  'hsl(42 62% 45%)',
  'hsl(218 40% 40%)',
  'hsl(215 25% 35%)',
  'hsl(145 42% 30%)',
  'hsl(260 30% 38%)',
  'hsl(210 48% 28%)',
  'hsl(175 35% 32%)',
  'hsl(200 55% 30%)',
  'hsl(230 38% 36%)',
];

function hashToIndex(input: string, modulo: number): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % modulo;
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function colorForClient(id: string, name: string): string {
  const seed = `${id}:${name}`;
  return AVATAR_PALETTE[hashToIndex(seed, AVATAR_PALETTE.length)];
}

function normalizeStatus(status: string | null | undefined): ClientStatus {
  if (status && (STATUS_VALUES as string[]).includes(status)) {
    return status as ClientStatus;
  }
  return 'onboarding';
}

function normalizeRisk(risk: string | null | undefined): ClientRiskLevel {
  if (risk && (RISK_VALUES as string[]).includes(risk)) {
    return risk as ClientRiskLevel;
  }
  return 'healthy';
}

function buildHandler(record: ClientRecord): Handler {
  const id = record.complianceAccountManagerId;
  const name = record.complianceAccountManagerId__label;
  if (!id || !name) return UNASSIGNED_HANDLER;
  return {
    id,
    name,
    initials: initialsFromName(name),
  };
}

export function mapClientRecordToRow(record: ClientRecord): ClientRow {
  return {
    id: record.id,
    name: record.name,
    legalName: record.legalName ?? '',
    taxIdentifier: record.taxId ?? '',
    initials: initialsFromName(record.name),
    color: colorForClient(record.id, record.name),
    status: normalizeStatus(record.complianceStatus),
    risk: normalizeRisk(record.risk),
    registeredLaws: record.registeredLaws ?? 0,
    openFilings: record.openFilings ?? 0,
    overdueFilings: record.overdueFilings ?? 0,
    onTimePct: record.onTimePct ?? 0,
    primaryHandler: buildHandler(record),
    primaryContactEmail: record.email ?? '',
    onboardedDate: record.complianceOnboardedAt ? record.complianceOnboardedAt.slice(0, 10) : '',
    lastFilingDate: record.lastFilingDate ?? '',
  };
}
