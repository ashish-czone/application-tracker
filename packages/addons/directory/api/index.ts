import { DirectoryModule } from './directory.module';

export { DirectoryModule };

export const directoryAddon = {
  module: DirectoryModule,
  migration: '@packages/directory',
} as const;

export { DIRECTORY_PERMISSIONS } from './permissions';
export type { DirectoryPermission } from './permissions';

export { companies, people } from './schema';
export type { Company, NewCompany, Person, NewPerson } from './schema';

export {
  DIRECTORY_COMPANY_CREATED,
  DIRECTORY_COMPANY_UPDATED,
  DIRECTORY_COMPANY_MERGED,
  DIRECTORY_PERSON_CREATED,
  DIRECTORY_PERSON_UPDATED,
  DIRECTORY_PERSON_MERGED,
} from './events/types';
export type {
  CompanyCreatedPayload,
  CompanyUpdatedPayload,
  CompanyMergedPayload,
  PersonCreatedPayload,
  PersonUpdatedPayload,
  PersonMergedPayload,
  CompanyCreatedEvent,
  CompanyUpdatedEvent,
  CompanyMergedEvent,
  PersonCreatedEvent,
  PersonUpdatedEvent,
  PersonMergedEvent,
} from './events/types';
