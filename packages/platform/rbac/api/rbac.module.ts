import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { RbacService } from './services/rbac.service';
import { PermissionRegistryService } from './services/permission-registry.service';
import { RbacGuard } from './guards/rbac.guard';
import { RbacController } from './controllers/rbac.controller';
import { UserRolesRelationHandler } from './relation-handlers/user-roles-relation-handler';

@Global()
@Module({
  controllers: [RbacController],
  providers: [PermissionRegistryService, RbacService, RbacGuard, UserRolesRelationHandler],
  exports: [RbacService, PermissionRegistryService, RbacGuard, UserRolesRelationHandler],
})
export class RbacModule implements OnModuleInit {
  constructor(private readonly rbacService: RbacService) {}

  onModuleInit() {
    this.rbacService.registerPermissions('rbac', [
      { action: 'roles.read', description: 'View roles' },
      { action: 'roles.manage', description: 'Create, update, and delete roles' },
      { action: 'permissions.read', description: 'View available permissions' },
    ]);
  }
}
