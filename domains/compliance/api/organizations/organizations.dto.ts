import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { organizations } from './organizations.schema';

export const OrganizationRowSchema = createSelectSchema(organizations);

export const CreateOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateOrganizationSchema = CreateOrganizationSchema.partial();

const optionalNumber = z.unknown().transform((raw) => {
  if (raw == null || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
});

const booleanFromString = z.unknown().transform((raw) => raw === 'true' || raw === true);

export const OrganizationsListQuerySchema = z
  .object({
    page: optionalNumber,
    limit: optionalNumber,
    includeDeleted: booleanFromString,
  })
  .passthrough();

export type CreateOrganizationDto = z.infer<typeof CreateOrganizationSchema>;
export type UpdateOrganizationDto = z.infer<typeof UpdateOrganizationSchema>;
export type OrganizationRow = z.infer<typeof OrganizationRowSchema>;
export type OrganizationsListQuery = z.infer<typeof OrganizationsListQuerySchema>;
