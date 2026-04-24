import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { organizations } from '../schema/organizations';

export const OrganizationRowSchema = createSelectSchema(organizations);

export const CreateOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateOrganizationSchema = CreateOrganizationSchema.partial();

export type CreateOrganizationDto = z.infer<typeof CreateOrganizationSchema>;
export type UpdateOrganizationDto = z.infer<typeof UpdateOrganizationSchema>;
export type OrganizationRow = z.infer<typeof OrganizationRowSchema>;
