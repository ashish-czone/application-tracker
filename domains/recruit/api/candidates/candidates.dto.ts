import { z } from 'zod';
import {
  GeneratedCandidateRowSchema,
  GeneratedCreateCandidateSchema,
  GeneratedUpdateCandidateSchema,
} from './candidates.dto.generated';

// User-owned. Add `.refine()` cross-field rules and custom transforms here.
// The generator will not overwrite this file. Schemas re-export from
// candidates.dto.generated.ts unless wrapped with custom logic.

export const CandidateRowSchema = GeneratedCandidateRowSchema;
export const CreateCandidateSchema = GeneratedCreateCandidateSchema;
export const UpdateCandidateSchema = GeneratedUpdateCandidateSchema;

export type CreateCandidateDto = z.infer<typeof CreateCandidateSchema>;
export type UpdateCandidateDto = z.infer<typeof UpdateCandidateSchema>;
export type CandidateRow = z.infer<typeof CandidateRowSchema>;
