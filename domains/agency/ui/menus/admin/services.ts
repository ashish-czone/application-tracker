import type { ApiFn } from '@packages/platform-ui';
import type {
  CreateMenuItemInput,
  MenuItemRecord,
  MenuRecord,
  MoveMenuItemInput,
  Paginated,
  PageLite,
  UpdateMenuItemInput,
} from './types';

/**
 * The menu + menu-item routes come from entity-engine auto-generation:
 *   GET    /menus                 list
 *   GET    /menus/:id             find one
 *   GET    /menu-items            list (filtered by menuId)
 *   POST   /menu-items            create
 *   PATCH  /menu-items/:id        update
 *   DELETE /menu-items/:id        soft delete
 *   POST   /menu-items/:id/move   reparent + reorder (hierarchy + orderable flags)
 */
export function createMenusApi(api: ApiFn) {
  return {
    getMenu(id: string): Promise<MenuRecord> {
      return api.get(`/menus/${id}`);
    },

    listMenuItems(menuId: string): Promise<Paginated<MenuItemRecord>> {
      const qs = new URLSearchParams({
        menuId,
        _sort: 'sortOrder',
        limit: '500',
      });
      return api.get(`/menu-items?${qs}`);
    },

    createMenuItem(input: CreateMenuItemInput): Promise<MenuItemRecord> {
      return api.post('/menu-items', input);
    },

    updateMenuItem(id: string, input: UpdateMenuItemInput): Promise<MenuItemRecord> {
      return api.patch(`/menu-items/${id}`, input);
    },

    deleteMenuItem(id: string): Promise<void> {
      return api.delete(`/menu-items/${id}`);
    },

    moveMenuItem(id: string, input: MoveMenuItemInput): Promise<void> {
      return api.post(`/menu-items/${id}/move`, input);
    },

    listPagesForPicker(search?: string): Promise<Paginated<PageLite>> {
      const qs = new URLSearchParams({ limit: '50' });
      if (search) qs.set('search', search);
      return api.get(`/pages?${qs}`);
    },
  };
}

export type MenusUiApi = ReturnType<typeof createMenusApi>;
