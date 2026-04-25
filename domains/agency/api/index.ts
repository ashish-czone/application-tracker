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
