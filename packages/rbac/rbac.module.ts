import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { RbacService } from './services/rbac.service';
import { PermissionRegistryService } from './services/permission-registry.service';
import { RbacGuard } from './guards/rbac.guard';
import { RbacController } from './controllers/rbac.controller';
import { FieldPermissionsController } from './controllers/field-permissions.controller';

@Global()
@Module({
  controllers: [RbacController, FieldPermissionsController],
  providers: [PermissionRegistryService, RbacService, RbacGuard],
  exports: [RbacService, PermissionRegistryService, RbacGuard],
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
