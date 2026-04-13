import type { Type } from '@nestjs/common';
import { RECRUIT_DOMAIN_NAME } from '../index';
import { RecruitDomainModule } from './recruit.module';

/**
 * Backend manifest shape for a domain package.
 *
 * Kept inline here (rather than in a shared types package) until a second
 * domain exists to validate the contract. When that happens, this type
 * graduates to a shared home.
 */
export interface DomainBackendManifest {
  name: string;
  displayName: string;
  module: Type<unknown>;
}

export const recruitBackend: DomainBackendManifest = {
  name: RECRUIT_DOMAIN_NAME,
  displayName: 'Recruit',
  module: RecruitDomainModule,
};

export { RecruitDomainModule };
