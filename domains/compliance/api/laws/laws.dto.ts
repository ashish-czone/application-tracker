import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { complianceLaws } from './laws.schema';

export const LawRowSchema = createSelectSchema(complianceLaws);

export const CreateLawSchema = createInsertSchema(complianceLaws, {
  name: (s) => s.min(1),
  code: (s) => s.min(1),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  path: true,
  depth: true,
});

export const UpdateLawSchema = CreateLawSchema.partial();

// ---- List query schema ---------------------------------------------------
// Validates the URL params the laws list endpoint understands, then
// passes everything else through verbatim so the service-layer
// `buildListQuery` helper can pick up structured `filters`, bare-id
// passthroughs (`?jurisdiction=central`), `search`, `sort`, and
// `order`. Page/limit stay undefined when missing (helper supplies
// defaults); includeDeleted only true on string "true".

const optionalNumber = z.unknown().transform((raw) => {
  if (raw == null || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
});

const booleanFromString = z.unknown().transform((raw) => raw === 'true' || raw === true);

const optionalSortString = z
  .string()
  .optional()
  .transform((s) => {
    if (!s) return undefined;
    const trimmed = s.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  });

const optionalOrder = z
  .union([z.literal('asc'), z.literal('desc')])
  .optional();

const optionalSearchString = z
  .string()
  .optional()
  .transform((s) => {
    if (!s) return undefined;
    const trimmed = s.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  });

const optionalFiltersString = z
  .string()
  .optional()
  .transform((s) => (s && s.length > 0 ? s : undefined));

export const LawsListQuerySchema = z
  .object({
    page: optionalNumber,
    limit: optionalNumber,
    includeDeleted: booleanFromString,
    search: optionalSearchString,
    sort: optionalSortString,
    order: optionalOrder,
    filters: optionalFiltersString,
  })
  .passthrough()
  .transform((raw) => {
    // Support `sort=field:dir` shorthand the way compliance-filings
    // does — the frontend's TanStack table click maps to this shape.
    let sort = raw.sort;
    let order = raw.order;
    if (typeof raw.sort === 'string' && raw.sort.includes(':')) {
      const [field, dir] = raw.sort.split(':');
      sort = field || undefined;
      order = dir === 'asc' ? 'asc' : 'desc';
    }
    return { ...raw, sort, order };
  });

// ---- Options query schema ------------------------------------------------
// Backs `GET /laws/options` (typeahead). `search` ILIKEs name + code; `ids`
// (CSV) bypasses search and hydrates labels for already-selected chips.
// `limit` clamps low — typeaheads don't need hundreds of rows.

const OPTIONS_DEFAULT_LIMIT = 25;
const OPTIONS_MAX_LIMIT = 50;

const optionalString = z
  .string()
  .optional()
  .transform((s) => {
    if (!s) return undefined;
    const trimmed = s.trim();
    return trimmed.length > 0 ? trimmed : undefined;
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

const optionsClampedLimit = z.unknown().transform((raw) => {
  if (raw == null || raw === '') return OPTIONS_DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return OPTIONS_DEFAULT_LIMIT;
  return Math.min(Math.floor(n), OPTIONS_MAX_LIMIT);
});

export interface LawsOptionsQuery {
  search?: string;
  ids?: string[];
  limit: number;
}

export const LawsOptionsQuerySchema = z
  .object({
    search: optionalString,
    ids: optionalStringCsv,
    limit: optionsClampedLimit,
  })
  .passthrough()
  .transform((raw): LawsOptionsQuery => ({
    search: raw.search,
    ids: raw.ids,
    limit: raw.limit,
  }));

export type CreateLawDto = z.infer<typeof CreateLawSchema>;
export type UpdateLawDto = z.infer<typeof UpdateLawSchema>;
export type LawRow = z.infer<typeof LawRowSchema>;
export type LawsListQuery = z.infer<typeof LawsListQuerySchema>;
