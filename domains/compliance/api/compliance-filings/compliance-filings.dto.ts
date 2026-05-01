import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { complianceFilings } from '../schema/compliance-filings';

export const ComplianceFilingRowSchema = createSelectSchema(complianceFilings);

// drizzle-zod infers `z.date()` for the timestamptz `completedAt` column, so
// any JSON caller has to send a Date instance — unreachable. The preprocess
// step turns `''` (what browser date inputs emit when blank) into null so the
// request isn't rejected as `Expected date, received string`; accepted
// writeable shapes are then: omitted, null, Date, ISO 8601 string.
const completedAtSchema = z.preprocess(
  (v) => (v === '' ? null : v),
  z.coerce.date().nullable().optional(),
);

export const CreateComplianceFilingSchema = createInsertSchema(complianceFilings, {
  title: (s) => s.min(1),
  completedAt: completedAtSchema,
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  deletedBy: true,
  createdBy: true,
});

export const UpdateComplianceFilingSchema = CreateComplianceFilingSchema.partial();

/**
 * Body shape for POST /compliance-filings/:id/transition. Drives the filing
 * workflow (pending → in_progress → review → completed/rejected etc.) via
 * the engine. The same shape is used across compliance entities so client
 * code can target every transition endpoint with one helper.
 */
export const TransitionComplianceFilingSchema = z.object({
  fieldKey: z.string().min(1),
  to: z.string().min(1),
  reason: z.string().max(200).optional(),
  comment: z.string().max(2000).optional(),
});

// ---- List query schema ----------------------------------------------------
// Pure URL-validation half of the old compliance-filings-query.ts. The
// domain half (bucket expansion, structured filter translation) lives in
// compliance-filings.filters.ts and consumes the schema's typed output.
//
// "DTOs validate; helpers translate" — see compliance-filings.filters.ts
// header.

export type FilingBucket = 'overdue' | 'due-today' | 'upcoming' | 'filed';
const FILING_BUCKETS = ['overdue', 'due-today', 'upcoming', 'filed'] as const;

const FILINGS_LIST_DEFAULT_LIMIT = 20;
const FILINGS_LIST_MAX_LIMIT = 100;

const clampedLimit = z.unknown().transform((raw) => {
  if (raw == null || raw === '') return FILINGS_LIST_DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return FILINGS_LIST_DEFAULT_LIMIT;
  return Math.min(Math.floor(n), FILINGS_LIST_MAX_LIMIT);
});

// Filings page deliberately stays undefined when missing — the engine
// supplies its own default. Differs from rules/clients which clamp to 1.
const optionalPage = z.unknown().transform((raw) => {
  if (raw == null || raw === '') return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return undefined;
  return Math.floor(n);
});

const optionalString = z
  .string()
  .optional()
  .transform((s) => {
    if (!s) return undefined;
    const trimmed = s.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  });

const optionalEnum = <T extends string>(allowed: readonly T[]) =>
  z
    .string()
    .optional()
    .transform((s) => {
      if (!s) return undefined;
      const trimmed = s.trim();
      return (allowed as readonly string[]).includes(trimmed) ? (trimmed as T) : undefined;
    });

const optionalStringCsv = z
  .string()
  .optional()
  .transform((s) => {
    if (!s) return undefined;
    const parts = s
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    return parts.length > 0 ? parts : undefined;
  });

const booleanFromString = z.unknown().transform((raw) => raw === 'true' || raw === true);

export interface FilingsListQuery extends Record<string, unknown> {
  page?: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
  includeDeleted: boolean;
  bucket?: FilingBucket;
  status?: string[];
  dueBefore?: string;
  dueAfter?: string;
  notCompleted: boolean;
  /** Pre-existing engine-style structured filters JSON, passed through verbatim. */
  filters?: string;
}

/**
 * URL query schema for `GET /compliance-filings`. Validates and coerces every
 * known shorthand parameter; passes engine-known fields (clientId, lawId,
 * ruleId, assigneeId, assigneeTeamId, search, today, etc.) through unchanged
 * via `.passthrough()` so they reach `buildBaseListQuery` for engine handoff.
 *
 * Behaviour preserved from the prior parser:
 *  - limit clamps silently to default (20) / max (100)
 *  - page defaults to undefined (engine supplies its own default)
 *  - sort=field:dir parses to split sort + order
 *  - includeDeleted only true when string "true"
 *  - status splits CSV; bucket validates against the FilingBucket enum
 */
export const FilingsListQuerySchema = z
  .object({
    page: optionalPage,
    limit: clampedLimit,
    sort: optionalString,
    order: optionalEnum(['asc', 'desc'] as const),
    includeDeleted: booleanFromString,
    bucket: optionalEnum(FILING_BUCKETS),
    status: optionalStringCsv,
    dueBefore: optionalString,
    dueAfter: optionalString,
    notCompleted: booleanFromString,
    filters: optionalString,
  })
  .passthrough()
  .transform((raw): FilingsListQuery => {
    let sort = raw.sort;
    let order = raw.order;
    if (typeof raw.sort === 'string' && raw.sort.includes(':')) {
      const [field, dir] = raw.sort.split(':');
      sort = field;
      order = dir === 'asc' ? 'asc' : 'desc';
    }
    return {
      ...raw,
      sort,
      order,
    };
  });

export type CreateComplianceFilingDto = z.infer<typeof CreateComplianceFilingSchema>;
export type UpdateComplianceFilingDto = z.infer<typeof UpdateComplianceFilingSchema>;
export type ComplianceFilingRow = z.infer<typeof ComplianceFilingRowSchema>;
