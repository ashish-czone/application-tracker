import type { DomainBackendManifest } from '@packages/domains';
import { AgencyDomainModule } from './agency.module';

export const agencyBackend: DomainBackendManifest = {
  name: 'agency',
  displayName: 'Agency',
  module: AgencyDomainModule,
};

export { AgencyDomainModule };
export { AGENCY_PERMISSIONS, AGENCY_PERMISSION_REGISTRATIONS } from './permissions';
export type { AgencyPermission } from './permissions';

export { pages, sections } from './pages/schema';
export { PAGES_CONFIG } from './pages/pages.config';
export { SECTIONS_CONFIG } from './pages/sections.config';
export { PagesModule } from './pages/pages.module';
export { PagesPublicService } from './pages/services/pages-public.service';
export type {
  PublicPageResponse,
  PublicPageDto,
  PublicSectionDto,
  PublicPageIndexEntry,
  PublicPagesIndexResponse,
} from './pages/services/pages-public.service';

export { menus, menuItems } from './menus/schema';
export { MENU_CONFIG } from './menus/menus.config';
export { menuItemConfig } from './menus/menu-items.config';
export { MenusModule } from './menus/menus.module';
export { MenusPublicService, buildMenuTree } from './menus/services/menus-public.service';
export type {
  PublicMenuResponse,
  PublicMenuItemDto,
} from './menus/services/menus-public.service';
