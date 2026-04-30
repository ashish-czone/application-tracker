import { Global, Module, Inject, Optional, type OnModuleInit } from '@nestjs/common';
import { LOOKUP_RESOLVER_TOKEN, type LookupResolver } from '@packages/entity-engine-contract';
import { RbacService } from './services/rbac.service';
import { RbacGuard } from './guards/rbac.guard';
import { RbacController } from './controllers/rbac.controller';
import { ScopeResolverRegistry } from './scope-resolver';
import { DataAccessScopeService } from './data-access-scope.service';
import { OwnScopeResolver } from './scope-resolvers/own.resolver';
import { AssignedScopeResolver } from './scope-resolvers/assigned.resolver';
import { PermissionManifestRegistry } from './permission-manifest';
import { roles } from './schema/roles';

@Global()
@Module({
  controllers: [RbacController],
  providers: [
    PermissionManifestRegistry,
    RbacService,
    RbacGuard,
    ScopeResolverRegistry,
    DataAccessScopeService,
    OwnScopeResolver,
    AssignedScopeResolver,
  ],
  exports: [
    RbacService,
    PermissionManifestRegistry,
    RbacGuard,
    ScopeResolverRegistry,
    DataAccessScopeService,
  ],
})
export class RbacModule implements OnModuleInit {
  constructor(
    private readonly rbacService: RbacService,
    private readonly scopeResolverRegistry: ScopeResolverRegistry,
    private readonly ownScopeResolver: OwnScopeResolver,
    private readonly assignedScopeResolver: AssignedScopeResolver,
    @Optional() @Inject(LOOKUP_RESOLVER_TOKEN) private readonly lookupResolver?: LookupResolver,
  ) {}

  onModuleInit() {
    this.rbacService.registerManifests([
      { slug: 'rbac.roles.read',       module: 'rbac', action: 'roles.read',       label: 'View roles',        description: 'View roles',                        supportedScopes: ['any'] },
      { slug: 'rbac.roles.manage',     module: 'rbac', action: 'roles.manage',     label: 'Manage roles',      description: 'Create, update, and delete roles',  supportedScopes: ['any'] },
      { slug: 'rbac.permissions.read', module: 'rbac', action: 'permissions.read', label: 'View permissions',  description: 'View available permissions',        supportedScopes: ['any'] },
    ]);

    this.scopeResolverRegistry.register(this.ownScopeResolver);
    this.scopeResolverRegistry.register(this.assignedScopeResolver);

    this.lookupResolver?.register({
      entity: 'roles',
      table: roles,
      labelField: 'name',
      valueField: 'id',
      searchFields: ['name'],
    });
  }
}
