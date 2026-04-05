import { Module, type DynamicModule } from '@nestjs/common';
import { ServiceAuthClient } from './services/service-auth-client';
import { ServiceAuthGuard } from './guards/service-auth.guard';
import {
  SERVICE_AUTH_CONFIG,
  type ServiceAuthConfig,
  type ServiceAuthModuleAsyncOptions,
} from './types';

@Module({})
export class ServiceAuthModule {
  static register(config: ServiceAuthConfig): DynamicModule {
    return {
      module: ServiceAuthModule,
      global: true,
      providers: [
        { provide: SERVICE_AUTH_CONFIG, useValue: config },
        ServiceAuthClient,
        ServiceAuthGuard,
      ],
      exports: [ServiceAuthClient, ServiceAuthGuard, SERVICE_AUTH_CONFIG],
    };
  }

  static registerAsync(options: ServiceAuthModuleAsyncOptions): DynamicModule {
    return {
      module: ServiceAuthModule,
      global: true,
      providers: [
        {
          provide: SERVICE_AUTH_CONFIG,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
        ServiceAuthClient,
        ServiceAuthGuard,
      ],
      exports: [ServiceAuthClient, ServiceAuthGuard, SERVICE_AUTH_CONFIG],
    };
  }
}
