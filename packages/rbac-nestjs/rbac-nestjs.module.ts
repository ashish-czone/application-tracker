import { DynamicModule, Module, Global, type InjectionToken, type OptionalFactoryDependency } from '@nestjs/common';
import type { RbacModuleConfig } from '@packages/rbac';
import { RBAC_MODULE_CONFIG, RBAC_CONFIGS_MAP } from './constants';
import { RbacService } from './services/rbac.service';
import { RbacGuard } from './guards/rbac.guard';
import { PermissionRegistryService } from './services/permission-registry.service';

interface RbacNestjsModuleAsyncOptions {
  imports?: DynamicModule['imports'];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useFactory: (...args: any[]) => RbacModuleConfig | Promise<RbacModuleConfig>;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
}

@Global()
@Module({})
export class RbacNestjsModule {
  static register(config: RbacModuleConfig): DynamicModule {
    RBAC_CONFIGS_MAP.set(config.entityName, config);

    return {
      module: RbacNestjsModule,
      providers: [
        {
          provide: RBAC_MODULE_CONFIG,
          useValue: config,
        },
        RbacService,
        RbacGuard,
        PermissionRegistryService,
      ],
      exports: [RbacService, RbacGuard, PermissionRegistryService, RBAC_MODULE_CONFIG],
    };
  }

  static registerAsync(options: RbacNestjsModuleAsyncOptions): DynamicModule {
    return {
      module: RbacNestjsModule,
      imports: [...(options.imports ?? [])],
      providers: [
        {
          provide: RBAC_MODULE_CONFIG,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          useFactory: async (...args: any[]) => {
            const config = await options.useFactory(...args);
            RBAC_CONFIGS_MAP.set(config.entityName, config);
            return config;
          },
          inject: options.inject ?? [],
        },
        RbacService,
        RbacGuard,
        PermissionRegistryService,
      ],
      exports: [RbacService, RbacGuard, PermissionRegistryService, RBAC_MODULE_CONFIG],
    };
  }
}
