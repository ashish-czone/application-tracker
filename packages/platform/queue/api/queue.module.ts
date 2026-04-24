import { Module, type DynamicModule, type OnModuleInit } from '@nestjs/common';
import { RbacService } from '@packages/rbac';
import { QueueService } from './services/queue.service';
import { QueueDashboardController } from './controllers/queue-dashboard.controller';
import { QUEUE_MODULE_CONFIG } from './types';
import type { QueueModuleConfig } from './types';

@Module({})
export class QueueModule implements OnModuleInit {
  constructor(private readonly rbacService: RbacService) {}

  onModuleInit() {
    this.rbacService.registerManifests([
      { slug: 'queues.read',   module: 'queues', action: 'read',   label: 'View queues',   description: 'View queue dashboard and job data',    supportedScopes: ['any'] },
      { slug: 'queues.manage', module: 'queues', action: 'manage', label: 'Manage queues', description: 'Pause, resume, retry, and clean queues', supportedScopes: ['any'] },
    ]);
  }

  static register(config: QueueModuleConfig): DynamicModule {
    return {
      module: QueueModule,
      global: true,
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
