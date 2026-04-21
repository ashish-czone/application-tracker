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
