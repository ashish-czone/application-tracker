import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { vendors } from './schema/vendors';

/**
 * Row shape as returned by the DB. Useful as a typed response contract on
 * read endpoints.
 */
export const VendorRowSchema = createSelectSchema(vendors);

/**
 * Baseline create-contract for a vendor, derived from the Drizzle table.
 *
 * Refinements applied on top of the raw column types:
 * - `email`: enforce RFC email shape (column is just `text`)
 * - `website`: enforce URL shape when present
 *
 * Omitted fields are server-managed (id, timestamps) or audit columns the
 * service fills from the actor, not the request body.
 */
export const CreateVendorSchema = createInsertSchema(vendors, {
  email: (s) => s.email().max(120),
  website: (s) => s.url().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  deletedBy: true,
  createdBy: true,
});

export const UpdateVendorSchema = CreateVendorSchema.partial();

export type CreateVendorDto = z.infer<typeof CreateVendorSchema>;
export type UpdateVendorDto = z.infer<typeof UpdateVendorSchema>;
export type VendorRow = z.infer<typeof VendorRowSchema>;
