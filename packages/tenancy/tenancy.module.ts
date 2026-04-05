import { Module, type DynamicModule, type MiddlewareConsumer, type NestModule, Inject } from '@nestjs/common';
import { ModuleRef, APP_GUARD } from '@nestjs/core';
import { DatabaseService } from '@packages/database';
import { AppLoggerService } from '@packages/logger';
import { JWT_CLAIMS_ENRICHERS } from '@packages/auth-core';
import { ServiceAuthClient } from '@packages/service-auth';
import { TENANCY_CONFIG, TENANT_LOOKUP, type TenancyConfig, type TenantLookup } from './types';
import { TenantResolverMiddleware } from './middleware/tenant-resolver.middleware';
import { TenantJwtGuard } from './guards/tenant-jwt.guard';
import { CapabilityGuard } from './guards/capability.guard';
import { TenantClaimsEnricher } from './enrichers/tenant-claims-enricher';
import { TenantAwareDatabaseService } from './services/tenant-aware-database.service';
import { TenantPoolManager } from './services/tenant-pool-manager.service';
import { TenantRegistryService } from './services/tenant-registry.service';
import { TenantHttpLookup } from './services/tenant-http-lookup';

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
    // Always apply middleware — it handles header/subdomain resolution
    // (first stage). The TenantJwtGuard handles JWT resolution (second stage).
    consumer.apply(TenantResolverMiddleware).forRoutes('*');
  }

  static register(config: TenancyConfig): DynamicModule {
    return {
      module: TenancyModule,
      global: true,
      providers: [
        { provide: TENANCY_CONFIG, useValue: config },
        TenantPoolManager,
        TenantResolverMiddleware,
        TenantRegistryService,
        {
          provide: TENANT_LOOKUP,
          useExisting: config.controlPlaneUrl ? TenantHttpLookup : TenantRegistryService,
        },
        ...(config.controlPlaneUrl ? [TenantHttpLookup] : []),
        {
          provide: DatabaseService,
          useClass: TenantAwareDatabaseService,
        },
        {
          provide: APP_GUARD,
          useClass: TenantJwtGuard,
        },
        {
          provide: APP_GUARD,
          useClass: CapabilityGuard,
        },
        TenantClaimsEnricher,
        {
          provide: JWT_CLAIMS_ENRICHERS,
          useExisting: TenantClaimsEnricher,
        },
      ],
      exports: [TENANCY_CONFIG, TENANT_LOOKUP, DatabaseService, TenantRegistryService, JWT_CLAIMS_ENRICHERS],
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
        TenantResolverMiddleware,
        TenantRegistryService,
        {
          provide: TENANT_LOOKUP,
          useFactory: (
            config: TenancyConfig,
            registry: TenantRegistryService,
            moduleRef: ModuleRef,
          ): TenantLookup => {
            if (config.controlPlaneUrl) {
              const serviceAuth = moduleRef.get(ServiceAuthClient, { strict: false });
              const logger = moduleRef.get(AppLoggerService, { strict: false });
              return new TenantHttpLookup(config, serviceAuth, logger);
            }
            return registry;
          },
          inject: [TENANCY_CONFIG, TenantRegistryService, ModuleRef],
        },
        {
          provide: DatabaseService,
          useClass: TenantAwareDatabaseService,
        },
        {
          provide: APP_GUARD,
          useClass: TenantJwtGuard,
        },
        {
          provide: APP_GUARD,
          useClass: CapabilityGuard,
        },
        TenantClaimsEnricher,
        {
          provide: JWT_CLAIMS_ENRICHERS,
          useExisting: TenantClaimsEnricher,
        },
      ],
      exports: [TENANCY_CONFIG, TENANT_LOOKUP, DatabaseService, TenantRegistryService, JWT_CLAIMS_ENRICHERS],
    };
  }
}
