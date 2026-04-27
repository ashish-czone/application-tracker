import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { complianceClientRegistrations } from '../schema/client-registrations';

export const ClientRegistrationRowSchema = createSelectSchema(complianceClientRegistrations);

// drizzle-zod infers `z.date()` for timestamptz columns, which can't be hit
// over JSON. Override the writable timestamp columns so callers can POST ISO
// 8601 strings (or already-parsed Date objects); coerce.date() accepts both
// and rejects anything that doesn't parse to a valid Date.
//
// Both `registeredAt` (`notNull().defaultNow()`) and `deactivatedAt`
// (nullable) are optional on insert — preserve that or the override turns
// what should be optional fields into required ones.
export const CreateClientRegistrationSchema = createInsertSchema(complianceClientRegistrations, {
  registeredAt: z.coerce.date().optional(),
  deactivatedAt: z.coerce.date().nullable().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateClientRegistrationSchema = CreateClientRegistrationSchema.partial();

export type CreateClientRegistrationDto = z.infer<typeof CreateClientRegistrationSchema>;
export type UpdateClientRegistrationDto = z.infer<typeof UpdateClientRegistrationSchema>;
export type ClientRegistrationRow = z.infer<typeof ClientRegistrationRowSchema>;
