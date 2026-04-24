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

export type CreateComplianceFilingDto = z.infer<typeof CreateComplianceFilingSchema>;
export type UpdateComplianceFilingDto = z.infer<typeof UpdateComplianceFilingSchema>;
export type ComplianceFilingRow = z.infer<typeof ComplianceFilingRowSchema>;
