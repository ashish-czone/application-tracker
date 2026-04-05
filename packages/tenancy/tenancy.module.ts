import { Module, type DynamicModule } from '@nestjs/common';
import { TENANCY_CONFIG, type TenancyConfig } from './types';

export interface TenancyModuleAsyncOptions {
  useFactory: (...args: any[]) => TenancyConfig | Promise<TenancyConfig>;
  inject?: any[];
}

@Module({})
export class TenancyModule {
  static register(config: TenancyConfig): DynamicModule {
    return {
      module: TenancyModule,
      global: true,
      providers: [
        { provide: TENANCY_CONFIG, useValue: config },
      ],
      exports: [TENANCY_CONFIG],
    };
  }

  static registerAsync(options: TenancyModuleAsyncOptions): DynamicModule {
    return {
      module: TenancyModule,
      global: true,
      providers: [
        {
          provide: TENANCY_CONFIG,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
      ],
      exports: [TENANCY_CONFIG],
    };
  }
}
