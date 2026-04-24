import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { complianceLaws } from '../schema/laws';

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

export type CreateLawDto = z.infer<typeof CreateLawSchema>;
export type UpdateLawDto = z.infer<typeof UpdateLawSchema>;
export type LawRow = z.infer<typeof LawRowSchema>;
