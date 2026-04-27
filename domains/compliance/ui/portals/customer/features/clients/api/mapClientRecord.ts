import type { Handler } from '../../../../../shared/types';
import type { ClientRow, ClientStatus, ClientRiskLevel } from '../types';
import type { ClientDetail } from '../types';
import type { ClientRecord } from '../../../../../hooks/useClientsApi';

const UNASSIGNED_HANDLER: Handler = {
  id: 'unassigned',
  name: 'Unassigned',
  initials: '—',
};

const STATUS_VALUES: ClientStatus[] = ['active', 'onboarding', 'dormant'];

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

export function mapClientRecordToRow(record: ClientRecord): ClientRow {
  const risk: ClientRiskLevel = 'healthy';
  return {
    id: record.id,
    name: record.name,
    legalName: record.legalName,
    taxIdentifier: record.taxId ?? '',
    initials: initialsFromName(record.name),
    color: colorForClient(record.id, record.name),
    status: normalizeStatus(record.status),
    risk,
    registeredLaws: 0,
    openFilings: 0,
    overdueFilings: 0,
    onTimePct: 0,
    primaryHandler: UNASSIGNED_HANDLER,
    primaryContactEmail: record.email ?? '',
    onboardedDate: record.onboardedAt ? record.onboardedAt.slice(0, 10) : '',
    lastFilingDate: '',
  };
}

function formatAddress(record: ClientRecord): string | null {
  const parts = [
    record.addressLine1,
    record.addressLine2,
    [record.city, record.state].filter(Boolean).join(', '),
    record.postalCode,
  ]
    .map((v) => (v ?? '').toString().trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * Merge a real API record into the mock detail template. Identity fields
 * (name, legalName, taxIdentifier, status, onboardedDate, address, notes)
 * come from the record; aggregate and related-entity fields (laws, filings,
 * activity, counts) remain mocked until the corresponding endpoints exist.
 */
export function mergeClientDetail(record: ClientRecord, mock: ClientDetail): ClientDetail {
  const row = mapClientRecordToRow(record);
  const address = formatAddress(record);
  return {
    ...mock,
    id: row.id,
    name: row.name,
    legalName: row.legalName,
    taxIdentifier: row.taxIdentifier,
    initials: row.initials,
    color: row.color,
    status: row.status,
    primaryContactEmail: row.primaryContactEmail || mock.primaryContactEmail,
    onboardedDate: row.onboardedDate || mock.onboardedDate,
    address: address ?? mock.address,
  };
}
