import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { menuItems } from '../schema/menu-items';

export const MenuItemRowSchema = createSelectSchema(menuItems);

export const CreateMenuItemSchema = createInsertSchema(menuItems, {
  menuId: (s) => s.min(1),
  label: (s) => s.min(1),
  linkType: (s) => s.min(1),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  deletedBy: true,
});

export const UpdateMenuItemSchema = CreateMenuItemSchema.partial();

export type CreateMenuItemDto = z.infer<typeof CreateMenuItemSchema>;
export type UpdateMenuItemDto = z.infer<typeof UpdateMenuItemSchema>;
export type MenuItemRow = z.infer<typeof MenuItemRowSchema>;
