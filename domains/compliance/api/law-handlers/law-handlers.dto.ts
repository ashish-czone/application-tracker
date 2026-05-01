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

const optionalNumber = z.unknown().transform((raw) => {
  if (raw == null || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
});

const booleanFromString = z.unknown().transform((raw) => raw === 'true' || raw === true);

export const LawHandlersListQuerySchema = z
  .object({
    page: optionalNumber,
    limit: optionalNumber,
    includeDeleted: booleanFromString,
  })
  .passthrough();

export type CreateLawHandlerDto = z.infer<typeof CreateLawHandlerSchema>;
export type UpdateLawHandlerDto = z.infer<typeof UpdateLawHandlerSchema>;
export type LawHandlerRow = z.infer<typeof LawHandlerRowSchema>;
export type LawHandlersListQuery = z.infer<typeof LawHandlersListQuerySchema>;
