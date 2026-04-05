import { Module, type DynamicModule, type MiddlewareConsumer, type NestModule, Inject } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseService } from '@packages/database';
import { TENANCY_CONFIG, type TenancyConfig } from './types';
import { TenantResolverMiddleware } from './middleware/tenant-resolver.middleware';
import { TenantJwtGuard } from './guards/tenant-jwt.guard';
import { TenantAwareDatabaseService } from './services/tenant-aware-database.service';
import { TenantPoolManager } from './services/tenant-pool-manager.service';
import { TenantRegistryService } from './services/tenant-registry.service';

export interface TenancyModuleAsyncOptions {
  useFactory: (...args: any[]) => TenancyConfig | Promise<TenancyConfig>;
  inject?: any[];
}

@Module({})
export class TenancyModule implements NestModule {
  constructor(
    @Inject(TENANCY_CONFIG) private readonly config: TenancyConfig,
  ) {}

  configure(consumer: MiddlewareConsumer) {
    if (this.config.resolver !== 'jwt') {
      consumer.apply(TenantResolverMiddleware).forRoutes('*');
    }
  }

  static register(config: TenancyConfig): DynamicModule {
    return {
      module: TenancyModule,
      global: true,
      providers: [
        { provide: TENANCY_CONFIG, useValue: config },
        ...TenancyModule.coreProviders(config),
      ],
      exports: [TENANCY_CONFIG, DatabaseService, TenantRegistryService],
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
        TenantPoolManager,
        TenantRegistryService,
        TenantResolverMiddleware,
        {
          provide: DatabaseService,
          useClass: TenantAwareDatabaseService,
        },
        {
          provide: APP_GUARD,
          useClass: TenantJwtGuard,
        },
      ],
      exports: [TENANCY_CONFIG, DatabaseService, TenantRegistryService],
    };
  }

  private static coreProviders(config: TenancyConfig) {
    return [
      TenantPoolManager,
      TenantRegistryService,
      TenantResolverMiddleware,
      {
        provide: DatabaseService,
        useClass: TenantAwareDatabaseService,
      },
      {
        provide: APP_GUARD,
        useClass: TenantJwtGuard,
      },
    ];
  }
}
