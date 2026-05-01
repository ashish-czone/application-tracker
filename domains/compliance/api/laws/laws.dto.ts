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

export type CreateLawDto = z.infer<typeof CreateLawSchema>;
export type UpdateLawDto = z.infer<typeof UpdateLawSchema>;
export type LawRow = z.infer<typeof LawRowSchema>;
export type LawsListQuery = z.infer<typeof LawsListQuerySchema>;
