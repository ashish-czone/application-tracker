import { Module } from '@nestjs/common';
import { RbacIntegrationModule } from '@packages/rbac';
import { MonitoringItemsController } from './items.controller';
import { MonitoringItemsService } from './items.service';
import { MonitoringKeywordsModule } from '../keywords/keywords.module';
import { MONITORING_ITEMS_PERMISSION_MANIFESTS } from '../../permissions';

@Module({
  imports: [
    RbacIntegrationModule.forFeature({
      manifests: MONITORING_ITEMS_PERMISSION_MANIFESTS,
    }),
    MonitoringKeywordsModule,
  ],
  controllers: [MonitoringItemsController],
  providers: [MonitoringItemsService],
  exports: [MonitoringItemsService],
})
export class MonitoringItemsModule {}
