import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { candidates } from './schema/candidates';

export const CandidateRowSchema = createSelectSchema(candidates);

export const CreateCandidateSchema = createInsertSchema(candidates, {
  email: (s) => s.email().max(160),
  secondaryEmail: (s) => s.email().max(160).optional(),
  website: (s) => s.url().optional(),
  linkedinUrl: (s) => s.url().optional(),
  facebookUrl: (s) => s.url().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  deletedBy: true,
  createdBy: true,
});

export const UpdateCandidateSchema = CreateCandidateSchema.partial();

export type CreateCandidateDto = z.infer<typeof CreateCandidateSchema>;
export type UpdateCandidateDto = z.infer<typeof UpdateCandidateSchema>;
export type CandidateRow = z.infer<typeof CandidateRowSchema>;
