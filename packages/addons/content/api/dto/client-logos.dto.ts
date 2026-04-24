import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { clientLogos } from '../schema/client-logos';

export const ClientLogoRowSchema = createSelectSchema(clientLogos);
export const CreateClientLogoSchema = createInsertSchema(clientLogos, {
  name: (s) => s.min(1),
  logoUrl: (s) => s.min(1),
}).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true, deletedBy: true });
export const UpdateClientLogoSchema = CreateClientLogoSchema.partial();

export type CreateClientLogoDto = z.infer<typeof CreateClientLogoSchema>;
export type UpdateClientLogoDto = z.infer<typeof UpdateClientLogoSchema>;
