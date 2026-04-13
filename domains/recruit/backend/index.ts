import type { DomainBackendManifest } from '@packages/domains';
import { RecruitDomainModule } from './recruit.module';

export const recruitBackend: DomainBackendManifest = {
  name: 'recruit',
  displayName: 'Recruit',
  module: RecruitDomainModule,
};

export { RecruitDomainModule };
