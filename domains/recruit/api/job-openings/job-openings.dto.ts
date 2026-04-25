import { z } from 'zod';
import {
  GeneratedJobOpeningRowSchema,
  GeneratedCreateJobOpeningSchema,
} from './job-openings.dto.generated';

// User-owned. Add field-level validators, `.refine()` cross-field rules,
// and custom transforms here. The generator will not overwrite this file.

export const CreateJobOpeningSchema = GeneratedCreateJobOpeningSchema.extend({
  title: z.string().min(1),
});

export const UpdateJobOpeningSchema = CreateJobOpeningSchema.partial();
export const JobOpeningRowSchema = GeneratedJobOpeningRowSchema;

export type CreateJobOpeningDto = z.infer<typeof CreateJobOpeningSchema>;
export type UpdateJobOpeningDto = z.infer<typeof UpdateJobOpeningSchema>;
export type JobOpeningRow = z.infer<typeof JobOpeningRowSchema>;
