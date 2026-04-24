import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { subscriptions } from '../schema/subscriptions';

export const SubscriptionRowSchema = createSelectSchema(subscriptions);
export const CreateSubscriptionSchema = createInsertSchema(subscriptions, {
  clientId: (s) => s.min(1),
  planId: (s) => s.min(1),
}).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true, deletedBy: true });
export const UpdateSubscriptionSchema = CreateSubscriptionSchema.partial();

export type CreateSubscriptionDto = z.infer<typeof CreateSubscriptionSchema>;
export type UpdateSubscriptionDto = z.infer<typeof UpdateSubscriptionSchema>;
