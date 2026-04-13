import { RECRUIT_DOMAIN_NAME } from '../index';

/**
 * Web manifest shape for a domain package.
 *
 * Kept minimal in PR 1 while candidates is the only migrated feature.
 * Future PRs will extend this with navigation, routes, and entity UI
 * configs as the rest of the Recruit frontend moves in.
 *
 * Like DomainBackendManifest, this type is defined inline here until a
 * second domain arrives to validate the contract — at which point it
 * graduates to a shared home.
 */
export interface DomainWebManifest {
  name: string;
  displayName: string;
}

export const recruitWeb: DomainWebManifest = {
  name: RECRUIT_DOMAIN_NAME,
  displayName: 'Recruit',
};
