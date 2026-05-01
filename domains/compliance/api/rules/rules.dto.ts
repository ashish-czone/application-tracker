import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { complianceRules } from './rules.schema';

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

/**
 * Body shape for POST /compliance-rules/:id/transition. Generic transition
 * endpoint delegating to the engine's `EntityService.transition` so the
 * platform's workflow guards, condition evaluation, and history rows
 * apply uniformly.
 */
export const TransitionComplianceRuleSchema = z.object({
  fieldKey: z.string().min(1),
  to: z.string().min(1),
  reason: z.string().max(200).optional(),
  comment: z.string().max(2000).optional(),
});

export type CreateComplianceRuleDto = z.infer<typeof CreateComplianceRuleSchema>;
export type UpdateComplianceRuleDto = z.infer<typeof UpdateComplianceRuleSchema>;
export type DeprecateComplianceRuleDto = z.infer<typeof DeprecateComplianceRuleSchema>;
export type ComplianceRuleRow = z.infer<typeof ComplianceRuleRowSchema>;
