import {
  FREQUENCIES,
  LAW_GROUP_KEYS,
  type ComplianceFrequency,
  type LawGroupKey,
} from '@domains/compliance-contract';

const RULES_LIST_DEFAULT_LIMIT = 25;
const RULES_LIST_MAX_LIMIT = 100;

export type RuleStatusKey = 'draft' | 'active' | 'deprecated';
export type RuleJurisdictionKey = 'central' | 'state' | 'municipal';

const VALID_STATUSES: ReadonlySet<RuleStatusKey> = new Set(['draft', 'active', 'deprecated']);
const VALID_JURISDICTIONS: ReadonlySet<RuleJurisdictionKey> = new Set([
  'central',
  'state',
  'municipal',
]);
const VALID_FREQUENCIES: ReadonlySet<ComplianceFrequency> = new Set(FREQUENCIES);
const VALID_LAW_GROUPS: ReadonlySet<LawGroupKey> = new Set(LAW_GROUP_KEYS);

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

/**
 * Translate compliance-rules shorthand URL params into the structured
 * `ComplianceRulesListParams` shape consumed by the rules list service.
 * Caps `limit` at 100 per the data-fetching rule, defaults to 25.
 */
export function translateRulesQuery(raw: Record<string, unknown>): ComplianceRulesListParams {
  const limit = clampLimit(raw.limit);
  const page = clampPage(raw.page);
  const { sort, order } = parseSort(raw.sort, raw.order);

  return {
    page,
    limit,
    sort,
    order,
    status: parseEnum(raw.status, VALID_STATUSES),
    frequencies: parseEnumCsv(raw.frequency, VALID_FREQUENCIES),
    jurisdictions: parseEnumCsv(raw.jurisdiction, VALID_JURISDICTIONS),
    lawGroups: parseEnumCsv(raw.lawGroup, VALID_LAW_GROUPS),
    lawIds: parseStringCsv(raw.lawId),
    q: stringOrUndefined(raw.q),
  };
}

function clampLimit(raw: unknown): number {
  if (raw == null || raw === '') return RULES_LIST_DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return RULES_LIST_DEFAULT_LIMIT;
  return Math.min(Math.floor(n), RULES_LIST_MAX_LIMIT);
}

function clampPage(raw: unknown): number {
  if (raw == null || raw === '') return 1;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

function parseSort(rawSort: unknown, rawOrder: unknown): { sort?: string; order?: 'asc' | 'desc' } {
  if (typeof rawSort === 'string' && rawSort.includes(':')) {
    const [field, direction] = rawSort.split(':');
    return { sort: field, order: direction === 'desc' ? 'desc' : 'asc' };
  }
  const sort = stringOrUndefined(rawSort);
  const order: 'asc' | 'desc' | undefined =
    rawOrder === 'asc' ? 'asc' : rawOrder === 'desc' ? 'desc' : undefined;
  return { sort, order };
}

function parseEnum<T extends string>(raw: unknown, allowed: ReadonlySet<T>): T | undefined {
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  return (allowed as ReadonlySet<string>).has(raw) ? (raw as T) : undefined;
}

function parseEnumCsv<T extends string>(raw: unknown, allowed: ReadonlySet<T>): T[] | undefined {
  const parts = parseStringCsv(raw);
  if (!parts) return undefined;
  const filtered = parts.filter((p): p is T => (allowed as ReadonlySet<string>).has(p));
  return filtered.length > 0 ? filtered : undefined;
}

function parseStringCsv(raw: unknown): string[] | undefined {
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  const parts = raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  return parts.length > 0 ? parts : undefined;
}

function stringOrUndefined(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export const __test__ = {
  RULES_LIST_DEFAULT_LIMIT,
  RULES_LIST_MAX_LIMIT,
};
