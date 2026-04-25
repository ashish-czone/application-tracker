import { z } from 'zod';
import {
  GeneratedInterviewRowSchema,
  GeneratedCreateInterviewSchema,
} from './interviews.dto.generated';

// User-owned. Add field-level validators, `.refine()` cross-field rules,
// and custom transforms here. The generator will not overwrite this file.

export const CreateInterviewSchema = GeneratedCreateInterviewSchema.extend({
  videoLink: z.string().url().optional(),
});

export const UpdateInterviewSchema = CreateInterviewSchema.partial();
export const InterviewRowSchema = GeneratedInterviewRowSchema;

export type CreateInterviewDto = z.infer<typeof CreateInterviewSchema>;
export type UpdateInterviewDto = z.infer<typeof UpdateInterviewSchema>;
export type InterviewRow = z.infer<typeof InterviewRowSchema>;
