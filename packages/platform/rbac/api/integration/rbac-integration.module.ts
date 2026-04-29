import {
  type DynamicModule,
  Inject,
  Injectable,
  Module,
  type OnModuleInit,
  type Type,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { RbacService } from '../services/rbac.service';
import { ScopeResolverRegistry, type ScopeResolver } from '../scope-resolver';
import type { PermissionManifest } from '../permission-manifest';

export interface RbacFeatureConfig {
  manifests?: PermissionManifest[];
  scopeResolvers?: Type<ScopeResolver>[];
}

export const RBAC_FEATURE_CONFIG = Symbol('RBAC_FEATURE_CONFIG');

@Injectable()
export class RbacFeatureRegistrations implements OnModuleInit {
  constructor(
    @Inject(RBAC_FEATURE_CONFIG) private readonly config: RbacFeatureConfig,
    private readonly rbacService: RbacService,
    private readonly scopeResolverRegistry: ScopeResolverRegistry,
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit(): void {
    const manifests = this.config.manifests ?? [];
    if (manifests.length > 0) {
      this.rbacService.registerManifests(manifests);
    }

    const resolverClasses = this.config.scopeResolvers ?? [];
    for (const ResolverClass of resolverClasses) {
      const resolver = this.moduleRef.get<ScopeResolver>(ResolverClass, { strict: false });
      this.scopeResolverRegistry.register(resolver);
    }
  }
}

@Module({})
export class RbacIntegrationModule {
  static forFeature(config: RbacFeatureConfig): DynamicModule {
    return {
      module: RbacIntegrationModule,
      providers: [
        { provide: RBAC_FEATURE_CONFIG, useValue: config },
        RbacFeatureRegistrations,
      ],
    };
  }
}
