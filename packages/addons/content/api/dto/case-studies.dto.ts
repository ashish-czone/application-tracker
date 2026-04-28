import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { caseStudies } from '../schema/case-studies';

export const CaseStudyRowSchema = createSelectSchema(caseStudies);
export const CreateCaseStudySchema = createInsertSchema(caseStudies, {
  title: (s) => s.min(1),
  slug: (s) => s.min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a-z 0-9 dashes only'),
  client: (s) => s.min(1),
  summary: (s) => s.min(1),
}).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true, deletedBy: true });
export const UpdateCaseStudySchema = CreateCaseStudySchema.partial();

export type CreateCaseStudyDto = z.infer<typeof CreateCaseStudySchema>;
export type UpdateCaseStudyDto = z.infer<typeof UpdateCaseStudySchema>;
