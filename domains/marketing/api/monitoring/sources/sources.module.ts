import { Module } from '@nestjs/common';
import { RbacIntegrationModule } from '@packages/rbac';
import { MonitoringSourcesController } from './sources.controller';
import { MonitoringSourcesService } from './sources.service';
import { MONITORING_SOURCES_PERMISSION_MANIFESTS } from '../../permissions';

@Module({
  imports: [
    RbacIntegrationModule.forFeature({
      manifests: MONITORING_SOURCES_PERMISSION_MANIFESTS,
    }),
  ],
  controllers: [MonitoringSourcesController],
  providers: [MonitoringSourcesService],
  exports: [MonitoringSourcesService],
})
export class MonitoringSourcesModule {}
