import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { complianceRules } from '../schema/rules';

export const ComplianceRuleRowSchema = createSelectSchema(complianceRules);

export const CreateComplianceRuleSchema = createInsertSchema(complianceRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

/**
 * PATCH body shape. `status` transitions go through the workflow engine, not
 * PATCH — the service strips it defensively, but clients shouldn't send it.
 */
export const UpdateComplianceRuleSchema = CreateComplianceRuleSchema.partial();

export const DeprecateComplianceRuleSchema = z.object({
  alsoCancelInFlight: z.boolean().optional(),
  comment: z.string().max(2000).optional(),
});

export type CreateComplianceRuleDto = z.infer<typeof CreateComplianceRuleSchema>;
export type UpdateComplianceRuleDto = z.infer<typeof UpdateComplianceRuleSchema>;
export type DeprecateComplianceRuleDto = z.infer<typeof DeprecateComplianceRuleSchema>;
export type ComplianceRuleRow = z.infer<typeof ComplianceRuleRowSchema>;
