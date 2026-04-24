import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { applications } from './schema/applications';

export const ApplicationRowSchema = createSelectSchema(applications);

export const CreateApplicationSchema = createInsertSchema(applications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  deletedBy: true,
  createdBy: true,
});

export const UpdateApplicationSchema = CreateApplicationSchema.partial();

export type CreateApplicationDto = z.infer<typeof CreateApplicationSchema>;
export type UpdateApplicationDto = z.infer<typeof UpdateApplicationSchema>;
export type ApplicationRow = z.infer<typeof ApplicationRowSchema>;
