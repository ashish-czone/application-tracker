import type { DomainBackendManifest } from '@packages/domains';
import { ComplianceDomainModule } from './compliance.module';

export const complianceBackend: DomainBackendManifest = {
  name: 'compliance',
  displayName: 'Compliance',
  module: ComplianceDomainModule,
};

export { ComplianceDomainModule };
export * from './schema';
