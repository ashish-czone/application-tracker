import { Global, Module, Inject, Optional, type OnModuleInit } from '@nestjs/common';
import { LOOKUP_RESOLVER_TOKEN, type LookupResolver } from '@packages/entity-engine-contract';
import { RbacService } from './services/rbac.service';
import { PermissionRegistryService } from './services/permission-registry.service';
import { RbacGuard } from './guards/rbac.guard';
import { RbacController } from './controllers/rbac.controller';
import { UserRolesRelationHandler } from './relation-handlers/user-roles-relation-handler';
import { ScopeResolverRegistry } from './scope-resolver';
import { OwnScopeResolver } from './scope-resolvers/own.resolver';
import { AssignedScopeResolver } from './scope-resolvers/assigned.resolver';
import { roles } from './schema/roles';

@Global()
@Module({
  controllers: [RbacController],
  providers: [
    PermissionRegistryService,
    RbacService,
    RbacGuard,
    UserRolesRelationHandler,
    ScopeResolverRegistry,
    OwnScopeResolver,
    AssignedScopeResolver,
  ],
  exports: [
    RbacService,
    PermissionRegistryService,
    RbacGuard,
    UserRolesRelationHandler,
    ScopeResolverRegistry,
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
    this.rbacService.registerPermissions('rbac', [
      { action: 'roles.read', description: 'View roles' },
      { action: 'roles.manage', description: 'Create, update, and delete roles' },
      { action: 'permissions.read', description: 'View available permissions' },
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
