import type { DomainBackendManifest } from '@packages/domains';
import { RECRUIT_DOMAIN_NAME } from '../index';
import { RecruitDomainModule } from './recruit.module';

export const recruitBackend: DomainBackendManifest = {
  name: RECRUIT_DOMAIN_NAME,
  displayName: 'Recruit',
  module: RecruitDomainModule,
};

export { RecruitDomainModule };
