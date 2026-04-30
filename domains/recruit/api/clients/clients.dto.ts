import { z } from 'zod';

/**
 * The recruit "client" concept is a directory `clients` row with
 * `recruit_became_client_at` set. Identity fields (clientName/website/
 * industry) route to base directory columns; commercial fields route
 * to recruit-prefixed columns (about, contactNumber, source,
 * billing/shipping addresses, lifecycle markers).
 *
 * The DTO is hand-written rather than derived from a Drizzle table —
 * it's the API surface; storage details (recruit_ prefixes, address
 * jsonb shape) are an implementation detail of ClientsService.
 */

const IdentityInput = z.object({
  clientName: z.string().min(1).max(255),
  website: z.string().url().optional(),
  industry: z.string().nullable().optional(),
});

const CommercialInput = z.object({
  contactNumber: z.string().nullable().optional(),
  about: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  billingStreet: z.string().nullable().optional(),
  billingCity: z.string().nullable().optional(),
  billingProvince: z.string().nullable().optional(),
  billingCode: z.string().nullable().optional(),
  billingCountry: z.string().nullable().optional(),
  shippingStreet: z.string().nullable().optional(),
  shippingCity: z.string().nullable().optional(),
  shippingProvince: z.string().nullable().optional(),
  shippingCode: z.string().nullable().optional(),
  shippingCountry: z.string().nullable().optional(),
});

export const CreateClientSchema = IdentityInput.merge(CommercialInput);
export const UpdateClientSchema = CreateClientSchema.partial();

export type CreateClientDto = z.infer<typeof CreateClientSchema>;
export type UpdateClientDto = z.infer<typeof UpdateClientSchema>;
