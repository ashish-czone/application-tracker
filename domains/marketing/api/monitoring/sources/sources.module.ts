import { Module } from '@nestjs/common';
import { RbacIntegrationModule } from '@packages/rbac';
import { MonitoringSourcesController } from './sources.controller';
import { MonitoringSourcesService } from './sources.service';
import { PollerSchedulerService } from './poller-scheduler.service';
import { MONITORING_SOURCES_PERMISSION_MANIFESTS } from '../../permissions';

@Module({
  imports: [
    RbacIntegrationModule.forFeature({
      manifests: MONITORING_SOURCES_PERMISSION_MANIFESTS,
    }),
  ],
  controllers: [MonitoringSourcesController],
  providers: [MonitoringSourcesService, PollerSchedulerService],
  exports: [MonitoringSourcesService, PollerSchedulerService],
})
export class MonitoringSourcesModule {}
