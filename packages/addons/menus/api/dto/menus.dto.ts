import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { menus } from '../schema/menus';

export const MenuRowSchema = createSelectSchema(menus);

export const CreateMenuSchema = createInsertSchema(menus, {
  name: (s) => s.min(1),
  slug: (s) => s.min(1),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  deletedBy: true,
});

export const UpdateMenuSchema = CreateMenuSchema.partial();

export type CreateMenuDto = z.infer<typeof CreateMenuSchema>;
export type UpdateMenuDto = z.infer<typeof UpdateMenuSchema>;
export type MenuRow = z.infer<typeof MenuRowSchema>;
