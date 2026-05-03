import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { complianceLawHandlers } from './law-handlers.schema';

export const LawHandlerRowSchema = createSelectSchema(complianceLawHandlers);

export const CreateLawHandlerSchema = createInsertSchema(complianceLawHandlers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateLawHandlerSchema = CreateLawHandlerSchema.partial();

// ---- List query schema ---------------------------------------------------
// Validates the URL params the law-handlers list endpoint understands, then
// passes everything else through verbatim so the service-layer
// `buildListQuery` helper can pick up structured `filters`, bare-id
// passthroughs (`?orgEntityId=…`, `?lawId=…`, `?clientId=…`, `?isPrimary=…`),
// `search`, `sort`, and `order`. Page/limit stay undefined when missing
// (helper supplies defaults); includeDeleted only true on string "true".
//
// Mirrors `laws.dto.ts` post-PR-8. Closes the silent-filter gap the
// PR-7 per-unit panel hit when `?orgEntityId=…` was being dropped by
// `BaseCrudService.list`.

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

export const LawHandlersListQuerySchema = z
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

export type CreateLawHandlerDto = z.infer<typeof CreateLawHandlerSchema>;
export type UpdateLawHandlerDto = z.infer<typeof UpdateLawHandlerSchema>;
export type LawHandlerRow = z.infer<typeof LawHandlerRowSchema>;
export type LawHandlersListQuery = z.infer<typeof LawHandlersListQuerySchema>;
