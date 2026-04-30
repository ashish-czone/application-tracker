import type { ClientsListParams, ClientRiskLevel, ClientStatusKey } from './clients-rollup.service';

const CLIENTS_LIST_DEFAULT_LIMIT = 25;
const CLIENTS_LIST_MAX_LIMIT = 100;

const VALID_STATUSES: ReadonlySet<ClientStatusKey> = new Set(['active', 'onboarding', 'dormant']);
const VALID_RISKS: ReadonlySet<ClientRiskLevel> = new Set(['healthy', 'at-risk', 'critical']);

/**
 * Translate compliance-clients shorthand URL params into the rollup service's
 * `ClientsListParams` shape. Caps `limit` at 100 (data-fetching rule) and
 * defaults to 25 — page-sized for the table.
 */
export function translateClientsQuery(raw: Record<string, unknown>): ClientsListParams {
  const limit = clampLimit(raw.limit);
  const page = clampPage(raw.page);
  const { sort, order } = parseSort(raw.sort, raw.order);

  return {
    page,
    limit,
    sort,
    order,
    status: parseEnum(raw.status, VALID_STATUSES),
    risk: parseEnum(raw.risk, VALID_RISKS),
    handlerId: stringOrUndefined(raw.handlerId),
    q: stringOrUndefined(raw.q),
  };
}

function clampLimit(raw: unknown): number {
  if (raw == null || raw === '') return CLIENTS_LIST_DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return CLIENTS_LIST_DEFAULT_LIMIT;
  return Math.min(Math.floor(n), CLIENTS_LIST_MAX_LIMIT);
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
    return {
      sort: field,
      order: direction === 'desc' ? 'desc' : 'asc',
    };
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

function stringOrUndefined(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export const __test__ = {
  CLIENTS_LIST_DEFAULT_LIMIT,
  CLIENTS_LIST_MAX_LIMIT,
};
