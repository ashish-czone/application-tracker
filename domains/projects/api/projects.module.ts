import { Module } from '@nestjs/common';
import { RbacIntegrationModule } from '@packages/rbac';

import { ProjectsModule } from './projects/projects.module';
import { MilestonesModule } from './milestones/milestones.module';
import { FeaturesModule } from './features/features.module';
import { TasksModule } from './tasks/tasks.module';
import { DashboardModule } from './dashboard/dashboard.module';

import { PROJECTS_PERMISSION_MANIFESTS } from './permissions';

@Module({
  imports: [
    ProjectsModule,
    MilestonesModule,
    FeaturesModule,
    TasksModule,
    DashboardModule,
    RbacIntegrationModule.forFeature({ manifests: PROJECTS_PERMISSION_MANIFESTS }),
  ],
})
export class ProjectsDomainModule {}
