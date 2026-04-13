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
    this.rbacService.registerPermissions('queues', [
      { action: 'read', description: 'View queue dashboard and job data' },
      { action: 'manage', description: 'Pause, resume, retry, and clean queues' },
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
