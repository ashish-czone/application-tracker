import { z } from 'zod';
import {
  GeneratedCandidateRowSchema,
  GeneratedCreateCandidateSchema,
} from './candidates.dto.generated';

// User-owned. Add field-level validators, `.refine()` cross-field rules,
// and custom transforms here. The generator will not overwrite this file.

export const CreateCandidateSchema = GeneratedCreateCandidateSchema.extend({
  email: z.string().email().max(160),
  secondaryEmail: z.string().email().max(160).optional(),
  website: z.string().url().optional(),
  linkedinUrl: z.string().url().optional(),
  facebookUrl: z.string().url().optional(),
});

export const UpdateCandidateSchema = CreateCandidateSchema.partial();
export const CandidateRowSchema = GeneratedCandidateRowSchema;

export type CreateCandidateDto = z.infer<typeof CreateCandidateSchema>;
export type UpdateCandidateDto = z.infer<typeof UpdateCandidateSchema>;
export type CandidateRow = z.infer<typeof CandidateRowSchema>;
