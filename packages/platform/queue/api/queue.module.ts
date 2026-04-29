import { Module, type DynamicModule } from '@nestjs/common';
import { RbacIntegrationModule, type PermissionManifest } from '@packages/rbac';
import { QueueService } from './services/queue.service';
import { QueueDashboardController } from './controllers/queue-dashboard.controller';
import { QUEUE_MODULE_CONFIG } from './types';
import type { QueueModuleConfig } from './types';

const QUEUE_MANIFESTS: PermissionManifest[] = [
  { slug: 'queues.read',   module: 'queues', action: 'read',   label: 'View queues',   description: 'View queue dashboard and job data',     supportedScopes: ['any'] },
  { slug: 'queues.manage', module: 'queues', action: 'manage', label: 'Manage queues', description: 'Pause, resume, retry, and clean queues', supportedScopes: ['any'] },
];

@Module({})
export class QueueModule {
  static register(config: QueueModuleConfig): DynamicModule {
    return {
      module: QueueModule,
      global: true,
      imports: [RbacIntegrationModule.forFeature({ manifests: QUEUE_MANIFESTS })],
      controllers: [QueueDashboardController],
      providers: [
        {
          provide: QUEUE_MODULE_CONFIG,
          useValue: config,
        },
        QueueService,
      ],
      exports: [QueueService],
    };
  }

  static registerAsync(options: {
    useFactory: (...args: any[]) => QueueModuleConfig;
    inject?: any[];
  }): DynamicModule {
    return {
      module: QueueModule,
      global: true,
      imports: [RbacIntegrationModule.forFeature({ manifests: QUEUE_MANIFESTS })],
      controllers: [QueueDashboardController],
      providers: [
        {
          provide: QUEUE_MODULE_CONFIG,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
        QueueService,
      ],
      exports: [QueueService],
    };
  }
}
