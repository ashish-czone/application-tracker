export * from './components/blocks';
export * from './blocks';
export * from './portals/admin/features/pages';
// Re-export menus, omitting `Paginated` (also exported from `./pages` —
// the two list shapes are structurally identical; consumers can grab
// `Paginated` from either side via the explicit sub-path if they need to).
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
  MenuRenderer,
  type MenuRendererProps,
  type MenuLinkComponent,
  type PublicMenuResponse,
  type PublicMenuItemDto,
  type PublicLinkType,
  type PublicTarget,
} from './menus';

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
