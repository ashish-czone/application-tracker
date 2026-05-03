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
// Replaces controller's inline page/limit/includeDeleted coercion. Same
// behaviour: page/limit stay undefined when missing (engine supplies
// defaults), includeDeleted only true on string "true".

const optionalNumber = z.unknown().transform((raw) => {
  if (raw == null || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
});

const booleanFromString = z.unknown().transform((raw) => raw === 'true' || raw === true);

export const LawsListQuerySchema = z
  .object({
    page: optionalNumber,
    limit: optionalNumber,
    includeDeleted: booleanFromString,
  })
  .passthrough();

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
