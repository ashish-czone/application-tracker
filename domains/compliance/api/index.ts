import type { DomainBackendManifest } from '@packages/domains';
import { ComplianceDomainModule } from './compliance.module';

export const complianceBackend: DomainBackendManifest = {
  name: 'compliance',
  displayName: 'Compliance',
  module: ComplianceDomainModule,
};

export { ComplianceDomainModule };
export { COMPLIANCE_PERMISSIONS, COMPLIANCE_PERMISSION_MANIFESTS } from './permissions';
export type { CompliancePermission } from './permissions';
export * from './schema';
