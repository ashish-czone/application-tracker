import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { complianceClientRegistrations } from '../schema/client-registrations';

export const ClientRegistrationRowSchema = createSelectSchema(complianceClientRegistrations);

export const CreateClientRegistrationSchema = createInsertSchema(complianceClientRegistrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateClientRegistrationSchema = CreateClientRegistrationSchema.partial();

export type CreateClientRegistrationDto = z.infer<typeof CreateClientRegistrationSchema>;
export type UpdateClientRegistrationDto = z.infer<typeof UpdateClientRegistrationSchema>;
export type ClientRegistrationRow = z.infer<typeof ClientRegistrationRowSchema>;
