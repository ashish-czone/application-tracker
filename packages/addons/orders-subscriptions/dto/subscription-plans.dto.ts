import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { subscriptionPlans } from '../schema/subscription-plans';

export const SubscriptionPlanRowSchema = createSelectSchema(subscriptionPlans);
export const CreateSubscriptionPlanSchema = createInsertSchema(subscriptionPlans, {
  name: (s) => s.min(1),
  slug: (s) => s.min(1),
}).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true, deletedBy: true });
export const UpdateSubscriptionPlanSchema = CreateSubscriptionPlanSchema.partial();

export type CreateSubscriptionPlanDto = z.infer<typeof CreateSubscriptionPlanSchema>;
export type UpdateSubscriptionPlanDto = z.infer<typeof UpdateSubscriptionPlanSchema>;
