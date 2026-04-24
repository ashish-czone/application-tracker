import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { jobOpenings } from './schema/job-openings';

export const JobOpeningRowSchema = createSelectSchema(jobOpenings);

export const CreateJobOpeningSchema = createInsertSchema(jobOpenings, {
  title: (s) => s.min(1),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  deletedBy: true,
  createdBy: true,
});

export const UpdateJobOpeningSchema = CreateJobOpeningSchema.partial();

export type CreateJobOpeningDto = z.infer<typeof CreateJobOpeningSchema>;
export type UpdateJobOpeningDto = z.infer<typeof UpdateJobOpeningSchema>;
export type JobOpeningRow = z.infer<typeof JobOpeningRowSchema>;
