import { Module, type DynamicModule } from '@nestjs/common';
import { QueueService } from './services/queue.service';
import { QUEUE_MODULE_CONFIG } from './types';
import type { QueueModuleConfig } from './types';

@Module({})
export class QueueModule {
  static register(config: QueueModuleConfig): DynamicModule {
    return {
      module: QueueModule,
      global: true,
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
    useFactory: (...args: unknown[]) => QueueModuleConfig;
    inject?: unknown[];
  }): DynamicModule {
    return {
      module: QueueModule,
      global: true,
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
