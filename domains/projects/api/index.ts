import type { DomainBackendManifest } from '@packages/domains';
import { ProjectsDomainModule } from './projects.module';

export const projectsBackend: DomainBackendManifest = {
  name: 'projects',
  displayName: 'Projects',
  module: ProjectsDomainModule,
};

export { ProjectsDomainModule };
export { PROJECTS_PERMISSIONS, PROJECTS_PERMISSION_MANIFESTS } from './permissions';
export type { ProjectsPermission } from './permissions';
export * from './schema';
export * from './events/types';

export { ProjectsService } from './projects/projects.service';
export { MilestonesService } from './milestones/milestones.service';
export { FeaturesService } from './features/features.service';
export { TasksService, type MyTaskRow } from './tasks/tasks.service';
