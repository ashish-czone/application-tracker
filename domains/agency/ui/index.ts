export * from './components/blocks';
export * from './portals/admin/features/pages';
export * from './portals/customer/features/pages';

// Menus split between admin (editor) and customer (public renderer); we
// re-export both halves explicitly here. `Paginated` is omitted because
// pages already exports a structurally identical type — consumers can
// grab it from the explicit pages sub-path if they need it.
export {
  createMenusApi,
  type MenusUiApi,
  useMenu,
  useMenuItems,
  useCreateMenuItem,
  useUpdateMenuItem,
  useDeleteMenuItem,
  useMoveMenuItem,
  usePagesForPicker,
  buildMenuItemTree,
  computeSortOrderForIndex,
  type MenuItemNode,
  MenuEditor,
  type MenuEditorProps,
  MenuEditorPage,
  MenuItemDialog,
  type MenuItemDialogValue,
  type LinkType,
  type Target,
  type MenuRecord,
  type MenuItemRecord,
  type CreateMenuItemInput,
  type UpdateMenuItemInput,
  type MoveMenuItemInput,
  type PageLite,
} from './portals/admin/features/menus';

export {
  MenuRenderer,
  type MenuRendererProps,
  type MenuLinkComponent,
  type PublicMenuResponse,
  type PublicMenuItemDto,
  type PublicLinkType,
  type PublicTarget,
} from './portals/customer/features/menus';

import type { EntityUIConfig } from '@packages/entity-engine-ui';
import { MENUS_UI_CONFIG } from './entity-configs/menus.ui';
import { MENU_ITEMS_UI_CONFIG } from './entity-configs/menu-items.ui';
import { PAGES_UI_CONFIG } from './entity-configs/pages.ui';
import { SECTIONS_UI_CONFIG } from './entity-configs/sections.ui';

export const agencyEntityUIConfigs: EntityUIConfig[] = [
  MENUS_UI_CONFIG,
  MENU_ITEMS_UI_CONFIG,
  PAGES_UI_CONFIG,
  SECTIONS_UI_CONFIG,
];

export { MENUS_UI_CONFIG, MENU_ITEMS_UI_CONFIG, PAGES_UI_CONFIG, SECTIONS_UI_CONFIG };
