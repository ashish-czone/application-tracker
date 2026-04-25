import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { complianceFilings } from '../schema/compliance-filings';

export const ComplianceFilingRowSchema = createSelectSchema(complianceFilings);

export const CreateComplianceFilingSchema = createInsertSchema(complianceFilings, {
  title: (s) => s.min(1),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  deletedBy: true,
  createdBy: true,
});

export const UpdateComplianceFilingSchema = CreateComplianceFilingSchema.partial();

/**
 * Body shape for POST /compliance-filings/:id/transition. Drives the filing
 * workflow (pending → in_progress → review → completed/rejected etc.) via
 * the engine. The same shape is used across compliance entities so client
 * code can target every transition endpoint with one helper.
 */
export const TransitionComplianceFilingSchema = z.object({
  fieldKey: z.string().min(1),
  to: z.string().min(1),
  reason: z.string().max(200).optional(),
  comment: z.string().max(2000).optional(),
});

export type CreateComplianceFilingDto = z.infer<typeof CreateComplianceFilingSchema>;
export type UpdateComplianceFilingDto = z.infer<typeof UpdateComplianceFilingSchema>;
export type ComplianceFilingRow = z.infer<typeof ComplianceFilingRowSchema>;
