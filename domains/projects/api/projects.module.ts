import { Module, type OnModuleInit } from '@nestjs/common';
import { RbacService } from '@packages/rbac';

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
  ],
})
export class ProjectsDomainModule implements OnModuleInit {
  constructor(private readonly rbac: RbacService) {}

  onModuleInit() {
    this.rbac.registerManifests(PROJECTS_PERMISSION_MANIFESTS);
  }
}
