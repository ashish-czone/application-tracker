import { Module } from '@nestjs/common';
import { RbacIntegrationModule } from '@packages/rbac';
import { MonitoringKeywordsController } from './keywords.controller';
import { MonitoringKeywordsService } from './keywords.service';
import { MONITORING_KEYWORDS_PERMISSION_MANIFESTS } from '../../permissions';

@Module({
  imports: [
    RbacIntegrationModule.forFeature({
      manifests: MONITORING_KEYWORDS_PERMISSION_MANIFESTS,
    }),
  ],
  controllers: [MonitoringKeywordsController],
  providers: [MonitoringKeywordsService],
  exports: [MonitoringKeywordsService],
})
export class MonitoringKeywordsModule {}
