import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { orders } from '../schema/orders';

export const OrderRowSchema = createSelectSchema(orders);
export const CreateOrderSchema = createInsertSchema(orders, {
  orderNumber: (s) => s.min(1),
  clientId: (s) => s.min(1),
}).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true, deletedBy: true });
export const UpdateOrderSchema = CreateOrderSchema.partial();

export type CreateOrderDto = z.infer<typeof CreateOrderSchema>;
export type UpdateOrderDto = z.infer<typeof UpdateOrderSchema>;
