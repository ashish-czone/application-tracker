import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { clients } from './schema/clients';

export const ClientRowSchema = createSelectSchema(clients);

/**
 * Identity fields (`clientName` / `website` / `industry`) live on
 * `directory.companies`, not `recruit_clients`. The form collects them and
 * the service routes them to the directory via `findOrCreate` / `update`.
 * They're declared here directly because drizzle-zod can't infer them from
 * the table schema.
 */
const IdentityInput = z.object({
  clientName: z.string().min(1).max(255),
  website: z.string().url().optional(),
  industry: z.string().nullable().optional(),
});

const ClientCommercialInsert = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  deletedBy: true,
  createdBy: true,
  companyId: true,
});

export const CreateClientSchema = ClientCommercialInsert.merge(IdentityInput);

export const UpdateClientSchema = CreateClientSchema.partial();

export type CreateClientDto = z.infer<typeof CreateClientSchema>;
export type UpdateClientDto = z.infer<typeof UpdateClientSchema>;
export type ClientRow = z.infer<typeof ClientRowSchema>;
