import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { clients } from '../schema/clients';

export const ClientRowSchema = createSelectSchema(clients);

export const CreateClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateClientSchema = CreateClientSchema.partial();

/**
 * Body shape for POST /clients/:id/transition. `status` is the only workflow
 * field on clients today; the controller still accepts a generic `fieldKey`
 * so the endpoint stays future-proof if another workflow field is added.
 */
export const TransitionClientSchema = z.object({
  fieldKey: z.string().min(1),
  to: z.string().min(1),
  reason: z.string().max(200).optional(),
  comment: z.string().max(2000).optional(),
});

export type CreateClientDto = z.infer<typeof CreateClientSchema>;
export type UpdateClientDto = z.infer<typeof UpdateClientSchema>;
export type TransitionClientDto = z.infer<typeof TransitionClientSchema>;
export type ClientRow = z.infer<typeof ClientRowSchema>;
