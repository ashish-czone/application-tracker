import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { complianceLawHandlers } from '../schema/law-handlers';

export const LawHandlerRowSchema = createSelectSchema(complianceLawHandlers);

export const CreateLawHandlerSchema = createInsertSchema(complianceLawHandlers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateLawHandlerSchema = CreateLawHandlerSchema.partial();

export type CreateLawHandlerDto = z.infer<typeof CreateLawHandlerSchema>;
export type UpdateLawHandlerDto = z.infer<typeof UpdateLawHandlerSchema>;
export type LawHandlerRow = z.infer<typeof LawHandlerRowSchema>;
